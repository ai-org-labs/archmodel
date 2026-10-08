import {validateModel} from './analysis.js';
import {designFocus,designReviewTargets} from './coverage.js';
import {reviewRows,reviewStatusLabels} from './reviews.js';
import type {Entity,Kind,Model} from './types.js';
export const traceStages=[
 {id:'behavior',name:'振る舞い',field:'has'},
 {id:'scenario',name:'具体例',field:'has'},
 {id:'quality',name:'品質要求',field:'has'},
 {id:'component',name:'論理責務',field:'realized_by'},
 {id:'realization',name:'技術実現',field:'implemented_by'},
 {id:'verification',name:'検証',field:'verified_by'},
 {id:'evidence',name:'証跡',field:'evidenced_by'}
] as const;
export type CoverageTone='recorded'|'missing'|'pending'|'excluded'|'failed';
/** Observable structure only: presence and passing checks never imply design completeness. */
export function mapCompleteness(model:Model,target?:string){
 const targets=target?[target]:designReviewTargets(model);
 const diagnostics=validateModel(model);
 const entityById=new Map(model.entities.map(e=>[e.id,e]));
 const linked=(id:string,relation:string,kind:Kind)=>model.edges.some(e=>e.from===id&&e.relation===relation&&entityById.get(e.to)?.kind===kind);
 const rows=targets.map(id=>{
  const entities=designFocus(model,id).entities;
  const of=(...kinds:Kind[])=>entities.filter(e=>kinds.includes(e.kind));
  const cells=traceStages.map(stage=>{
   const items=of(stage.id);const gaps:{id:string;label:string}[]=[];
   const requireLink=(parents:Entity[],relation:string,kind:Kind,label:string)=>{for(const e of parents)if(!linked(e.id,relation,kind))gaps.push({id:e.id,label:`${e.name}：${label}`});};
   if(stage.id==='behavior')requireLink(of('capability'),'has','behavior','振る舞い未接続');
   if(stage.id==='scenario')requireLink(of('behavior'),'has','scenario','具体例未接続');
   if(stage.id==='component')requireLink(of('behavior','quality','policy'),'realizedBy','component','論理責務未接続');
   if(stage.id==='realization')requireLink(of('component'),'implementedBy','realization','技術実現未接続');
   if(stage.id==='verification')requireLink(of('scenario','quality','policy','contract'),'verifiedBy','verification','検証未接続');
   if(stage.id==='evidence')requireLink(of('verification'),'evidencedBy','evidence','証跡未接続');
   for(const e of items){const fields=diagnostics.filter(d=>d.entityId===e.id&&d.code==='MISSING_FIELD').map(d=>d.field).filter(Boolean);if(fields.length)gaps.push({id:e.id,label:`${e.name}：未入力 ${fields.join(', ')}`});}
   const failed=items.filter(e=>e.kind==='verification'&&e.data.result==='failed');
   const unknown=items.filter(e=>e.kind==='verification'&&e.data.result!=='passed'&&e.data.result!=='failed');
   const summary=!items.length?'— 記録なし':stage.id==='verification'?`${items.filter(e=>e.data.result==='passed').length} passed · ${failed.length} failed · ${unknown.length} 未実施/不明`:`${items.length}件の記録`;
   const tone:CoverageTone=failed.length?'failed':gaps.length||!items.length?'missing':unknown.length?'pending':'recorded';
   return {stage,items,gaps,summary,tone};
  });
  const reviews=reviewRows(model,id).map(row=>{
   const addresses=(row.record?.addresses??[]).map(id=>entityById.get(id)!).filter(Boolean);
   const tone:CoverageTone=row.gaps.length?'missing':row.status==='not_applicable'?'excluded':row.status==='applicable'?'recorded':row.status==='deferred'||row.status==='in_review'?'pending':'missing';
   const label=row.gaps.length?`${reviewStatusLabels[row.status]}・根拠不足`:row.status==='applicable'?'対象・設計参照あり':reviewStatusLabels[row.status];
   const verifications=[...new Map(addresses.flatMap(e=>designFocus(model,e.id).entities.filter(n=>n.kind==='verification')).map(e=>[e.id,e])).values()];
   return {...row,addresses,verifications,tone,label};
  });
  return {target:entityById.get(id)!,targetGaps:diagnostics.filter(d=>d.entityId===id&&d.code==='MISSING_FIELD').map(d=>d.field).filter(Boolean),cells,reviews};
 });
 const mapped=new Set(rows.flatMap(r=>designFocus(model,r.target.id).entities.map(e=>e.id)));
 return {rows,unassigned:model.entities.filter(e=>!mapped.has(e.id))};
}
