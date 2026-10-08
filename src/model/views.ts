import {designFocus,designCoverage} from './coverage.js';
import {reviewRows,reviewScopeIds,reviewSummary} from './reviews.js';
import { dump } from 'js-yaml';
import { renderDiagram } from '../focused/render.js';
import type { DiagramColor, DiagramModel } from '../focused/types.js';
import {connectionTypes} from './types.js';
import type { Kind, Model, TraversalOptions } from './types.js';
import { outgoing, relatedIds, validateModel } from './analysis.js';
export type View = 'capability'|'behavior'|'architecture'|'policy'|'decision'|'verification'|'implementation'|'impact'|'connections'|'contracts';
const viewKinds:Record<View,Kind[]>={capability:['product','capability','behavior','scenario','quality'],behavior:['capability','behavior','scenario'],architecture:['behavior','quality','policy','component','realization'],policy:['policy','product','capability','behavior','component','realization'],decision:['decision','capability','quality','component','realization'],verification:['scenario','quality','policy','verification','evidence'],implementation:['component','realization'],impact:[],connections:['component','realization'],contracts:['behavior','component','contract','verification']};
const colors:Partial<Record<Kind,DiagramColor>>={product:'purple',capability:'blue',behavior:'green',scenario:'gray',quality:'orange',component:'purple',realization:'blue',verification:'green',policy:'orange'};
export function projectView(model:Model,view:View='capability',focus?:string,scope?:TraversalOptions):DiagramModel{
 const selected=focus?relatedIds(model,focus,scope??{depth:2,direction:'both',relationTypes:view==='connections'?connectionTypes:undefined}):undefined;
 const endpoints=new Set(model.connections.flatMap(e=>[e.from,e.to]));
 const entities=model.entities.filter(e=>(view!=='connections'||endpoints.has(e.id))&&(view==='impact'||viewKinds[view].includes(e.kind))&&(!selected||selected.has(e.id)));
 const ids=new Set(entities.map(e=>e.id));
 return {kind:'system',direction:'LR',title:`ArchModel · ${view}`,groups:[],diagnostics:[],nodes:entities.map(e=>({id:e.id,label:e.name,description:`${e.kind} · ${e.data.status??'draft'}`,shape:'card',color:colors[e.kind]??'gray',line:0})),edges:model.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)&&(view!=='connections'||connectionTypes.includes(e.relation as typeof connectionTypes[number]))).map(e=>({from:e.from,to:e.to,label:[e.label??e.relation,e.protocol,e.contract].filter(Boolean).join(' · '),style:'solid',bidirectional:false,line:0}))};
}
export function renderView(model:Model,view:View='capability',focus?:string,scope?:TraversalOptions){
 const errors=validateModel(model).filter(d=>d.severity==='error');
 if(errors.length)throw new Error(errors.map(d=>`${d.path}: ${d.message}`).join('\n'));
 return renderDiagram(projectView(model,view,focus,scope));
}
export function qualityMatrix(model:Model){
 return model.entities.filter(e=>e.kind==='capability').map(c=>({id:c.id,name:c.name,qualities:outgoing(model,c.id,'has').map(edge=>model.entities.find(e=>e.id===edge.to)!).filter(e=>e.kind==='quality').map(q=>{
  const components=outgoing(model,q.id,'realizedBy').map(e=>e.to);
  const implementations=components.flatMap(id=>outgoing(model,id,'implementedBy').map(e=>e.to));
  const verifications=outgoing(model,q.id,'verifiedBy').map(e=>e.to);
  const evidence=[...outgoing(model,q.id,'evidencedBy').map(e=>e.to),...verifications.flatMap(id=>outgoing(model,id,'evidencedBy').map(e=>e.to))];
  return {id:q.id,attribute:q.data.attribute,requirement:q.data.requirement,target:q.data.target,unit:q.data.unit,components,implementations,verifications,evidence};
 })}));
}
const md=(s:unknown)=>String(s??'').replace(/[\\`*_{}\[\]<>|#]/g,'\\$&').replace(/\n/g,' ');
export function toMarkdown(model:Model):string{
 let text='# ArchModel 設計仕様\n\n';
 for(const e of model.entities){
  text+=`## ${md(e.name)} (${md(e.kind)}: ${md(e.id)})\n\n`;
  for(const [key,value]of Object.entries(e.data))if(!['id','name'].includes(key))text+=`- ${md(key)}: ${md(typeof value==='object'?JSON.stringify(value):value)}\n`;
  text+='\n';
 }
 text+='## Traceability\n\n';for(const e of model.edges.filter(e=>!e.id))text+=`- ${md(e.from)} → ${e.relation} → ${md(e.to)}\n`;
 text+='\n## Architecture connections\n\n';for(const c of model.connections)text+=`- ${md(c.id)}: ${md(c.from)} → ${md(c.type)} → ${md(c.to)}; protocol: ${md(c.protocol)}; contract: ${md(c.contract)}; ${md(c.label??c.description)}\n`;
 text+='\n## Perspective reviews\n\n';
 if(!reviewScopeIds(model).length)text+='未開始（検討済みとは扱わない）\n';
 for(const target of reviewScopeIds(model)){
  const summary=reviewSummary(model,target);text+=`\n### ${md(target)}: ${summary.resolved}/${summary.total} resolved\n\n`;
  for(const row of reviewRows(model,target)){
   text+=`- ${md(row.perspective.id)}: ${row.status}${row.gaps.length?` / incomplete: ${row.gaps.join(', ')}`:''}\n`;
   if(row.record)for(const [key,value]of Object.entries(row.record))if(!['target','perspective','status'].includes(key))text+=`  - ${key}: ${md(Array.isArray(value)?value.join('; '):value)}\n`;
  }
 }
 text+='\n## Validation\n\n';for(const d of validateModel(model))text+=`- ${d.severity} ${d.code}: ${md(d.message)}\n`;
 return text;
}
export const toYaml=(model:Model)=>dump(model.source,{noRefs:true,lineWidth:100});
export function backlogCandidates(model:Model){return model.entities.filter(e=>['capability','behavior','quality'].includes(e.kind)).map(e=>({sourceId:e.id,type:e.kind==='capability'?'Epic':e.kind==='behavior'?'Story':'Task',title:e.name,acceptanceCriteria:outgoing(model,e.id,'has').map(x=>model.entities.find(n=>n.id===x.to)!).filter(n=>n.kind==='scenario').map(n=>n.data.specification)}));}
export function directoryProposal(model:Model){return model.entities.filter(e=>e.kind==='component').map(e=>({componentId:e.id,template:e.data.template??'hexagonal',paths:(e.data.template==='ddd'?['domain','application','infrastructure']:e.data.template==='vertical-slice'?['features','shared']:['domain','application','ports','adapters']).map(p=>`src/components/${e.id}/${p}/`),iac:`infra/${e.id}/`,bindings:outgoing(model,e.id,'implementedBy').map(x=>x.to)}));}

/** Ego-graph projection: a shared semantic ID appears once, even when branches converge. */
export function renderFocusMap(model:Model,id:string,scope:TraversalOptions={depth:2,direction:'both',relationTypes:['has','realizedBy','implementedBy','verifiedBy','appliesTo','affects','evidencedBy','uses','provides','consumes',...connectionTypes]}){
 if(!model.entities.some(e=>e.id===id))throw new Error('Focus対象を選択してください');
 const diagram=projectView(model,'impact',id,scope);
 const depth=scope.depth??2;
 const before=relatedIds(model,id,{...scope,direction:'reverse'});
 const after=relatedIds(model,id,{...scope,direction:'forward'});
 const left=diagram.nodes.filter(n=>n.id!==id&&before.has(n.id)&&!after.has(n.id));
 const right=diagram.nodes.filter(n=>n.id!==id&&!left.includes(n));
 const center=Math.max(1,Math.ceil(Math.max(left.length,right.length)/2));
 for(const [i,n]of left.entries())n.at=[1,i+1];
 for(const [i,n]of right.entries())n.at=[Math.min(depth+2,4),i+1];
 const node=diagram.nodes.find(n=>n.id===id)!;node.at=[2,center];node.color='orange';
 diagram.title=`Focus · ${node.label}`;
 return renderDiagram(diagram);
}

/** Focus is a projection of the same graph; boundary nodes remain explicit. */
export function renderDesignFocusMap(model:Model,target:string,perspective?:string){
 const focus=designFocus(model,target,perspective),boundary=new Set(focus.boundary.map(e=>e.id));
 const projected={...model,entities:[...focus.entities,...focus.boundary],edges:focus.edges};
 const diagram=projectView(projected,'impact');
 diagram.title=`対象: ${model.entities.find(e=>e.id===target)!.name}${perspective?` / ${perspective}`:''}`;
 for(const node of diagram.nodes){
  if(boundary.has(node.id)){node.description=`範囲外への接続 · ${node.description}`;node.color='gray';}
  else if(node.id===target)node.color='orange';
  const entity=model.entities.find(e=>e.id===node.id)!;
  if(['product','capability'].includes(entity.kind)){const c=designCoverage(model,node.id);node.description+=` · 観点 ${c.concluded}/${c.total} 結論あり`;}
 }
 return renderDiagram(diagram);
}
