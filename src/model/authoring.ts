import {dump} from 'js-yaml';
import schema from '../../schema/archmodel.schema.json';
import {parseModel,collections} from './parser.js';
import type {DesignReview,Entity,Kind,Model,TraceRelation} from './types.js';
export const EMPTY_MODEL="version: '0.1'\n";
export const entryPoints=[
 {id:'pm',label:'プロダクトから',role:'プロダクトマネージャ',kind:'product' as Kind,description:'誰に、どんな価値を届けるか。ProductからCapabilityを広げます。'},
 {id:'architect',label:'技術・構成から',role:'アーキテクト',kind:'realization' as Kind,description:'実行環境や既存リソースから、論理責務と根拠をつなぎます。'},
 {id:'se',label:'振る舞いから',role:'SE',kind:'behavior' as Kind,description:'TriggerとOutcomesからBehaviorを定義し、Scenarioと実装をつなぎます。'}
] as const;
export interface FieldDefinition {type?:string|string[];enum?:unknown[];items?:FieldDefinition;$ref?:string;oneOf?:FieldDefinition[]}
export const definitions=schema.$defs as unknown as Record<Kind,{properties:Record<string,FieldDefinition>; 'x-design-required':string[]}>;
export const referenceFields:Record<string,TraceRelation>={has:'has',realized_by:'realizedBy',implemented_by:'implementedBy',verified_by:'verifiedBy',applies_to:'appliesTo',affects:'affects',evidenced_by:'evidencedBy',uses:'uses',provides:'provides',consumes:'consumes'};
const nestedFields=new Set([...Object.keys(collections),'quality','realizes','verifies']);
export function editableFields(kind:Kind){return Object.entries(definitions[kind].properties).filter(([key])=>key!=='id'&&!nestedFields.has(key)&&!referenceFields[key]);}
function checked(source:string):Model{
 const m=parseModel(source);const errors=m.diagnostics.filter(d=>d.severity==='error');if(errors.length)throw new Error(errors.map(d=>`${d.path}: ${d.message}`).join('\n'));return m;
}
function encode(source:Record<string,unknown>){const text=dump(source,{noRefs:true,lineWidth:100});checked(text);return text;}
function locate(source:Record<string,unknown>,path:string):Record<string,unknown>{
 let current:unknown=source;
 for(const match of path.matchAll(/\.([A-Za-z_]+)|\[(\d+)\]/g))current=(current as Record<string,unknown>)[match[1]??match[2]];
 if(!current||typeof current!=='object'||Array.isArray(current))throw new Error('編集対象が見つかりません');return current as Record<string,unknown>;
}
export function suggestId(model:Model,kind:Kind){let i=1;const ids=new Set([...model.entities.map(e=>e.id),...model.connections.map(e=>e.id),...(model.reviews??[]).map(e=>e.id)]);while(ids.has(`${kind}-${i}`))i++;return `${kind}-${i}`;}
export function saveEntity(source:string,kind:Kind,data:Record<string,unknown>,existingId?:string):string{
 const model=checked(source);const raw=model.source;
 if(existingId){
  const e=model.entities.find(e=>e.id===existingId);if(!e||e.kind!==kind)throw new Error('編集対象が見つかりません');
  if(data.id!==existingId)throw new Error('IDは編集できません');const target=locate(raw,e.path);
  // Preserve nested definitions and relationships. Edit only fields owned by this form.
  for(const [key]of editableFields(kind)){if(data[key]===undefined)delete target[key];else target[key]=data[key];}
 }else{
  const key=Object.entries(collections).find(([,k])=>k===kind)![0];raw[key]??=[];(raw[key] as unknown[]).push(data);
 }
 return encode(raw);
}
export function linkEntities(source:string,fromId:string,field:string,toId:string):string{
 if(!referenceFields[field])throw new Error('不明な関連です');const m=checked(source);const from=m.entities.find(e=>e.id===fromId);if(!from||!m.entities.some(e=>e.id===toId))throw new Error('関連先がありません');
 const target=locate(m.source,from.path);const values=(target[field]??[]) as string[];target[field]=[...new Set([...values,toId])];return encode(m.source);
}
/** Reuses parser rules rather than maintaining a second list of allowed endpoint pairs. */
export function availableLinks(model:Model,fromId:string){
 const from=model.entities.find(e=>e.id===fromId);if(!from)return [];
 const result:Array<{field:string;relation:TraceRelation;target:Entity}>=[];
 for(const [field,relation]of Object.entries(referenceFields)){
  if(!definitions[from.kind].properties[field])continue;
  for(const target of model.entities){
   if(target.id===fromId)continue;
   if(model.edges.some(e=>e.from===fromId&&e.to===target.id&&e.relation===relation))continue;
   const minimal={version:'0.1',[Object.entries(collections).find(([,k])=>k===from.kind)![0]]:[{id:fromId,[field]:[target.id]}]};
   const collection=Object.entries(collections).find(([,k])=>k===target.kind)![0];
   (minimal as Record<string,unknown>)[collection]=[...((minimal as Record<string,unknown>)[collection] as unknown[]??[]),{id:target.id}];
   if(!parseModel(dump(minimal)).diagnostics.some(d=>d.severity==='error'))result.push({field,relation,target});
  }
 }
 return result;
}
export function ownerOverview(model:Model){
 const owners=[...new Set(model.entities.map(e=>String(e.data.owner??'未担当')))];
 return owners.map(owner=>({owner,entities:model.entities.filter(e=>String(e.data.owner??'未担当')===owner)}));
}
function flatDocument(entities:Entity[],model:Model):Record<string,unknown>{
 const raw:Record<string,unknown>={version:'0.1',...(model.source.extensions?{extensions:model.source.extensions}:{})};const ids=new Set(entities.map(e=>e.id));
 for(const e of entities){
  const data:Record<string,unknown>={id:e.id};
  for(const [key,value]of Object.entries(e.data))if(!nestedFields.has(key)&&!referenceFields[key])data[key]=value;
  for(const [field,relation]of Object.entries(referenceFields)){
   const targets=model.edges.filter(x=>x.from===e.id&&x.relation===relation&&ids.has(x.to)).map(x=>x.to);if(targets.length)data[field]=targets;
  }
  const key=Object.entries(collections).find(([,kind])=>kind===e.kind)![0];raw[key]??=[];(raw[key] as unknown[]).push(data);
 }
 if(model.source.review_catalog)raw.review_catalog=model.source.review_catalog;
 if(model.source.review_scopes)raw.review_scopes=(model.reviewScopes??[]).filter(id=>ids.has(id));
 if(model.source.reviews)raw.reviews=(model.reviews??[]).filter(r=>ids.has(r.target)).map(r=>{
  const addresses=r.addresses?.filter(id=>ids.has(id));
  return {...r,...(addresses?{addresses}:{}),...(addresses&&addresses.length!==r.addresses?.length?{status:'in_review'}:{})};
 });
 raw.relations=model.connections.filter(c=>ids.has(c.from)&&ids.has(c.to)&&(!c.contract||ids.has(c.contract)));return raw;
}
/** Import is additive and atomic. Existing IDs must be identical; conflicting edits are never overwritten. */
export function mergeContribution(base:string,incoming:string):string{
 const a=checked(base),b=checked(incoming),left=flatDocument(a.entities,a),right=flatDocument(b.entities,b);
 const occupied=new Map<string,{key:string;value:unknown}>();for(const [key,value]of Object.entries(left))if(key!=='review_scopes'&&Array.isArray(value))for(const e of value)occupied.set(key==='review_catalog'?`catalog:${e.id}`:e.id,{key,value:e});
 const stable=(v:unknown):string=>JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
 for(const [key,values]of Object.entries(right))if(key!=='review_scopes'&&Array.isArray(values))for(const item of values){
  const identity=key==='review_catalog'?`catalog:${item.id}`:item.id;
  if(occupied.has(identity)){if(occupied.get(identity)!.key!==key||stable(occupied.get(identity)!.value)!==stable(item))throw new Error(`ID「${item.id}」の内容が異なります。取り込まずに保持しました。IDまたは内容を整理してください。`);continue;}
  left[key]??=[];(left[key] as unknown[]).push(item);occupied.set(identity,{key,value:item});
 }
 if(left.review_scopes||right.review_scopes)left.review_scopes=[...new Set([...(left.review_scopes as string[]??[]),...(right.review_scopes as string[]??[])])];
 if(right.extensions!==undefined){if(left.extensions!==undefined&&stable(left.extensions)!==stable(right.extensions))throw new Error('文書のextensionsが競合しています');left.extensions=right.extensions;}
 return encode(left);
}

/** Delete only the selected entity; keep its children as independently editable nodes. */
export function deleteEntity(source:string,id:string):string{
 const model=checked(source);
 if(!model.entities.some(e=>e.id===id))throw new Error('削除対象が見つかりません');
 return encode(flatDocument(model.entities.filter(e=>e.id!==id),model));
}

/** Start explicit tracking without manufacturing decisions for missing perspectives. */
export function startReview(source:string,target:string):string{
 const m=checked(source);if(!m.entities.some(e=>e.id===target))throw new Error('検討対象がありません');
 m.source.review_scopes=[...new Set([...(m.reviewScopes??[]),target])];return encode(m.source);
}
export function saveReview(source:string,review:DesignReview):string{
 const m=checked(source);const records=[...(m.reviews??[])];
 const index=records.findIndex(r=>r.target===review.target&&r.perspective===review.perspective);
 if(index>=0){if(records[index].id!==review.id)throw new Error('検討記録のIDは変更できません');records[index]=review;}else records.push(review);
 m.source.reviews=records;m.source.review_scopes=[...new Set([...(m.reviewScopes??[]),review.target])];return encode(m.source);
}
export function suggestReviewId(model:Model,target:string,perspective:string):string{
 const old=model.reviews?.find(r=>r.target===target&&r.perspective===perspective);if(old)return old.id;
 const occupied=new Set([...model.entities.map(e=>e.id),...model.connections.map(e=>e.id),...(model.reviews??[]).map(r=>r.id)]);
 const base=`review-${target}-${perspective}`;let id=base,n=1;while(occupied.has(id))id=`${base}-${n++}`;return id;
}
