import {reviewRows,reviewScopeIds} from './reviews.js';
import {validateModel} from './analysis.js';
import type {Model} from './types.js';
/** The design checklist includes unstarted Product/Capability scopes without mutating legacy YAML. */
export function designReviewTargets(model:Model):string[]{
 return [...new Set([...model.entities.filter(e=>['product','capability'].includes(e.kind)).map(e=>e.id),...reviewScopeIds(model)])];
}
export function designCoverage(model:Model,target?:string){
 const targets=target?[target]:designReviewTargets(model);
 const diagnostics=validateModel(model);
 const scopes=targets.map(id=>{
  const rows=reviewRows(model,id).map(row=>({...row,concluded:!!row.record&&['applicable','not_applicable','deferred'].includes(row.status)&&row.gaps.length===0}));
  return {target:id,tracked:reviewScopeIds(model).includes(id),rows,total:rows.length,concluded:rows.filter(r=>r.concluded).length,resolved:rows.filter(r=>r.resolved).length,deferred:rows.filter(r=>r.status==='deferred').length};
 });
 const total=scopes.reduce((n,s)=>n+s.total,0),concluded=scopes.reduce((n,s)=>n+s.concluded,0),resolved=scopes.reduce((n,s)=>n+s.resolved,0);
 return {scopes,total,concluded,resolved,unconcluded:total-concluded,conclusionsComplete:total>0&&total===concluded&&!diagnostics.some(d=>d.severity==='error'),resolvedComplete:total>0&&total===resolved&&!diagnostics.some(d=>d.severity==='error')};
}
/** Detail projection keeps full canonical fields and explicitly lists boundary links. */
export function designFocus(model:Model,target:string,perspective?:string){
 const entity=model.entities.find(e=>e.id===target);if(!entity)throw new RangeError(`Unknown target: ${target}`);
 const row=perspective?reviewRows(model,target).find(r=>r.perspective.id===perspective):undefined;
 if(perspective&&!row)throw new RangeError(`Unknown perspective: ${perspective}`);
 const ids=new Set<string>([target]);
 if(row){for(const id of row.record?.addresses??[])ids.add(id);}
 else {
  // Descend from this capability, never traverse up through Product into siblings.
  const queue=[target];for(let i=0;i<queue.length;i++)for(const edge of model.edges)if(edge.from===queue[i]&&['has','realizedBy','implementedBy','verifiedBy','evidencedBy','uses','provides','consumes'].includes(edge.relation)&&!ids.has(edge.to)){ids.add(edge.to);queue.push(edge.to);}
  for(const edge of model.edges)if(['appliesTo','affects'].includes(edge.relation)&&ids.has(edge.to))ids.add(edge.from);
 }
 const edges=model.edges.filter(e=>ids.has(e.from)||ids.has(e.to));
 const boundaryIds=new Set(edges.flatMap(e=>[e.from,e.to]).filter(id=>!ids.has(id)));
 return {entities:model.entities.filter(e=>ids.has(e.id)),edges,boundary:model.entities.filter(e=>boundaryIds.has(e.id)),diagnostics:validateModel(model).filter(d=>d.entityId&&ids.has(d.entityId))};
}
