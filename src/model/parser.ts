import { load, JSON_SCHEMA } from 'js-yaml';
import schema from '../../schema/archmodel.schema.json';
import type { ArchitectureConnection, Diagnostic, Edge, Entity, Kind, Model, Relation, TraceRelation } from './types.js';
export const MODEL_LIMITS = { sourceLength: 500_000, entities: 400, edges: 2000, depth: 20 } as const;
export const collections: Record<string,Kind> = {products:'product',capabilities:'capability',behaviors:'behavior',scenarios:'scenario',qualities:'quality',policies:'policy',decisions:'decision',components:'component',realizations:'realization',verifications:'verification',evidence:'evidence',contracts:'contract'};
const isRecord = (v: unknown): v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
type Schema = {type?: string|string[]; minLength?:number; pattern?:string; enum?:unknown[]; const?:unknown; $ref?:string; oneOf?:Schema[]; items?:Schema; properties?:Record<string,Schema>; additionalProperties?:boolean|Schema; required?:string[]; 'x-design-required'?:string[]};
const definitions = schema.$defs as Record<string, Schema>;
export function parseModel(source: string): Model {
 const model:Model={version:'0.1',entities:[],edges:[],connections:[],diagnostics:[],source:{}};
 const report=(code:string,path:string,message:string,severity:Diagnostic['severity']='error',entityId?:string,field?:string)=>model.diagnostics.push({code,path,message,severity,entityId,field});
 if(source.length>MODEL_LIMITS.sourceLength){report('LIMIT','$','入力は500,000文字以内にしてください');return model;}
 let raw:unknown;
 try {raw=load(source,{schema:JSON_SCHEMA});}catch(e){report('YAML','$',e instanceof Error?e.message:String(e));return model;}
 if(!isRecord(raw)){report('TYPE','$','モデルはYAMLオブジェクトで記述してください');return model;}
 const visited=new WeakSet<object>();let objectCount=0;
 function guard(value:unknown,path:string,depth:number):void {
  if(!value||typeof value!=='object')return;
  if(visited.has(value)){report('ALIAS',path,'共有・循環YAMLエイリアスは利用できません');return;}
  visited.add(value);
  if(depth>MODEL_LIMITS.depth||++objectCount>20_000){report('LIMIT',path,'入力構造の上限を超えています');return;}
  for(const [key,child]of Object.entries(value))guard(child,`${path}.${key}`,depth+1);
 }
 guard(raw,'$',0);
 if(model.diagnostics.length)return model;
 model.source=raw;
 const seen=new WeakSet<object>();
 function check(value:unknown, rule:Schema,path:string,depth=0):void {
  if(depth>MODEL_LIMITS.depth){report('LIMIT',path,'ネストが深すぎます');return;}
  if(rule.$ref)rule=definitions[rule.$ref.split('/').pop()!]!;
  if(rule.oneOf)rule=rule.oneOf.find(r=>isRecord(value)?!!r.$ref:r.type==='string')!;
  if(rule.const!==undefined&&value!==rule.const)report('VERSION',path,`値は ${rule.const} である必要があります`);
  if(rule.enum&&!rule.enum.includes(value))report('ENUM',path,`許可された値: ${rule.enum.join(', ')}`);
  const type=Array.isArray(value)?'array':value===null?'null':typeof value;
  if(rule.type&&!(Array.isArray(rule.type)?rule.type:[rule.type]).includes(type)){report('TYPE',path,`${rule.type} を指定してください`);return;}
  if(typeof value==='string'&&((rule.minLength&&value.trim().length<rule.minLength)||(rule.pattern&&!new RegExp(rule.pattern).test(value))))report('FORMAT',path,'空でない文字列または有効なIDを指定してください');
  if(value&&typeof value==='object'){
   if(seen.has(value)){report('ALIAS',path,'循環参照・共有YAMLエイリアスは利用できません');return;} seen.add(value);
   if(Array.isArray(value)&&rule.items)value.forEach((v,i)=>check(v,rule.items!,`${path}[${i}]`,depth+1));
   else if(isRecord(value)){
    for(const key of rule.required??[])if(value[key]===undefined)report('REQUIRED',`${path}.${key}`,`${key} は必須です`);
    for(const [key,v]of Object.entries(value)){
     const sub=rule.properties?.[key];
     if(sub)check(v,sub,`${path}.${key}`,depth+1);
     else if(rule.additionalProperties===false)report('UNKNOWN_FIELD',`${path}.${key}`,`不明な項目: ${key}`);
     else if(isRecord(rule.additionalProperties))check(v,rule.additionalProperties as Schema,`${path}.${key}`,depth+1);
    }
   }
  }
 }
 check(raw,schema as Schema,'$');
 // Structural errors never enter graph normalization, so malformed references cannot crash a view.
 if(model.diagnostics.some(d=>d.severity==='error'))return model;
 const ids=new Map<string,Entity>(); const pending: Array<Edge&{path:string}>=[];
 const queue=(from:string,to:string,relation:Relation,path:string)=>pending.push({from,to,relation,path});
 const relFields:Record<string,Relation>={has:'has',realized_by:'realizedBy',implemented_by:'implementedBy',verified_by:'verifiedBy',applies_to:'appliesTo',affects:'affects',evidenced_by:'evidencedBy',uses:'uses',provides:'provides',consumes:'consumes'};
 function add(data:Record<string,unknown>,kind:Kind,path:string,parent?:Entity):void {
  if(model.entities.length>=MODEL_LIMITS.entities){report('LIMIT',path,'要素は400件以内にしてください');return;}
  const id=data.id as string;
  if(ids.has(id)){report('DUPLICATE_ID',path,`IDが重複しています: ${id}`);return;}
  const entity:Entity={id,kind,name:typeof data.name==='string'?data.name:id,path,data};ids.set(id,entity);model.entities.push(entity);
  if(parent)queue(parent.id,id,'has',path);
  for(const field of definitions[kind]['x-design-required']??[]) {
   const v=data[field]; const hasNested=field==='behaviors'&&Array.isArray(data.has)&&data.has.length>0;
   if(!hasNested&&(v===undefined||v===''||(Array.isArray(v)&&!v.length)))report('MISSING_FIELD',`${path}.${field}`,`${kind} ${id}: ${field} が未定義です`,'warning',id,field);
  }
  for(const [key,value] of Object.entries(data)){
   if(relFields[key])for(const to of value as string[])queue(id,to,relFields[key],`${path}.${key}`);
   if(key==='realizes')for(const from of value as string[])queue(from,id,'realizedBy',`${path}.${key}`);
   if(key==='verifies')for(const from of value as string[])queue(from,id,'verifiedBy',`${path}.${key}`);
   if(collections[key]&&Array.isArray(value))value.forEach((v,i)=>typeof v==='string'?queue(id,v,'has',`${path}.${key}[${i}]`):add(v,collections[key],`${path}.${key}[${i}]`,entity));
   if(key==='quality'&&isRecord(value))for(const [attribute,q]of Object.entries(value)){
    const attrs=definitions.quality.properties!.attribute.enum!;
    if(!attrs.includes(attribute)){report('ENUM',`${path}.quality.${attribute}`,'不明な品質属性です');continue;}
    if((q as Record<string,unknown>).attribute!==undefined&&(q as Record<string,unknown>).attribute!==attribute){report('QUALITY_ATTRIBUTE',`${path}.quality.${attribute}`,'品質キーとattributeが一致しません');continue;}
    add({...q as Record<string,unknown>,name:(q as Record<string,unknown>).name??`${data.name??data.id} / ${attribute}`,attribute},'quality',`${path}.quality.${attribute}`,entity);
   }
  }
 }
 if(isRecord(raw.product))add(raw.product,'product','$.product');
 for(const [key,kind]of Object.entries(collections))if(Array.isArray(raw[key]))(raw[key] as Record<string,unknown>[]).forEach((v,i)=>add(v,kind,`$.${key}[${i}]`));
 const allowed:Record<TraceRelation,Partial<Record<Kind,Kind[]>>>={
  has:{product:['capability','policy','decision','component','realization','verification'],capability:['behavior','quality'],behavior:['scenario']},
  realizedBy:{behavior:['component'],quality:['component'],policy:['component']},implementedBy:{component:['realization']},
  verifiedBy:{scenario:['verification'],quality:['verification'],policy:['verification'],behavior:['verification'],realization:['verification'],component:['verification'],contract:['verification']},
  appliesTo:{policy:['product','capability','behavior','component','realization']},affects:{decision:['product','capability','quality','component','realization','behavior','policy']},
  evidencedBy:{verification:['evidence'],quality:['evidence']},uses:{behavior:['contract']},provides:{component:['contract']},consumes:{component:['contract']}
 };
 const edgeKeys=new Set<string>();
 for(const edge of pending){
  const from=ids.get(edge.from),to=ids.get(edge.to);
  if(!from||!to){report('UNKNOWN_REFERENCE',edge.path,`参照先がありません: ${!from?edge.from:edge.to}`);continue;}
  if(!allowed[edge.relation as TraceRelation][from.kind]?.includes(to.kind)){report('RELATION_TYPE',edge.path,`${from.kind} → ${edge.relation} → ${to.kind} は不正です`);continue;}
  const key=JSON.stringify([edge.from,edge.relation,edge.to]);if(edgeKeys.has(key))continue;edgeKeys.add(key);
  if(model.edges.length>=MODEL_LIMITS.edges){report('LIMIT',edge.path,'関連は2000件以内にしてください');break;}
  model.edges.push({from:edge.from,to:edge.to,relation:edge.relation});
 }
 const connectionIds=new Set(ids.keys());
 for(const [i,rawConnection]of ((raw.relations??[]) as ArchitectureConnection[]).entries()){
  const path=`$.relations[${i}]`,c=rawConnection;
  if(connectionIds.has(c.id)){report('DUPLICATE_ID',path,`IDが重複しています: ${c.id}`);continue;}connectionIds.add(c.id);
  const from=ids.get(c.from),to=ids.get(c.to);
  if(!from||!to){report('UNKNOWN_REFERENCE',path,'接続のfrom/toが存在しません');continue;}
  if(!['component','realization'].includes(from.kind)||!['component','realization'].includes(to.kind)){report('RELATION_TYPE',path,'接続端点はComponentまたはRealizationに限ります');continue;}
  if(c.contract&&ids.get(c.contract)?.kind!=='contract'){report('CONTRACT_REFERENCE',path,'contractは既存ContractのIDを指定してください');continue;}
  if(model.edges.length>=MODEL_LIMITS.edges){report('LIMIT',path,'関連は2000件以内にしてください');break;}
  model.connections.push({...c});
  model.edges.push({from:c.from,to:c.to,relation:c.type,id:c.id,...(c.protocol?{protocol:c.protocol}:{}),...(c.contract?{contract:c.contract}:{}),...(c.label?{label:c.label}:{})});
 }
 return model;
}
