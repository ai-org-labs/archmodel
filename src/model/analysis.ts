import defaults from '../../rules/questioning.json';
import type { Diagnostic, Entity, Model, Question, Relation, TraversalOptions, VerificationSummary } from './types.js';
export const outgoing=(m:Model,id:string,r?:Relation)=>m.edges.filter(e=>e.from===id&&(!r||e.relation===r));
export const incoming=(m:Model,id:string,r?:Relation)=>m.edges.filter(e=>e.to===id&&(!r||e.relation===r));
export function validateModel(model:Model):Diagnostic[]{
 const diagnostics=[...model.diagnostics];
 if(diagnostics.some(d=>d.severity==='error'))return diagnostics;
 const warn=(code:string,e:Entity|undefined,message:string,field?:string)=>diagnostics.push({code,severity:'warning',entityId:e?.id,path:e?.path??'$',message,field});
 if(!model.entities.some(e=>e.kind==='product'))warn('NO_PRODUCT',undefined,'Productが未定義です');
 for(const e of model.entities){
  const out=outgoing(model,e.id),ins=incoming(model,e.id);
  const has=(r:Relation)=>out.some(x=>x.relation===r);
  const child=(kind:string)=>out.some(x=>x.relation==='has'&&model.entities.find(n=>n.id===x.to)?.kind===kind);
  if(e.kind==='product'&&!child('capability'))warn('NO_CAPABILITY',e,'Capabilityがありません');
  if(['capability','behavior','scenario','quality'].includes(e.kind)&&!ins.some(x=>x.relation==='has'))warn('NO_PARENT',e,'上位の意味モデルに関連付けられていません');
  if(e.kind==='capability'&&!child('behavior')&&!diagnostics.some(d=>d.entityId===e.id&&d.field==='behaviors'))warn('MISSING_FIELD',e,'Behaviorがありません','behaviors');
  if(e.kind==='behavior'&&!child('scenario'))warn('NO_SCENARIO',e,'Scenario（受入条件・具体例）がありません');
  if(['behavior','quality','policy'].includes(e.kind)&&!has('realizedBy'))warn('NO_REALIZATION',e,'実現する論理コンポーネントが紐付いていません');
  if(['scenario','quality','policy','contract'].includes(e.kind)&&!has('verifiedBy'))warn('UNCOVERED',e,'検証が紐付いていません。既存の検証を割り当てるか、新しく作成してください','verified_by');
  if(e.kind==='component'){
   if(!ins.some(x=>x.relation==='realizedBy'))warn('ORPHAN_COMPONENT',e,'この論理コンポーネントが実現する振る舞い・品質要求・ポリシーが未定義です');
   if(!has('implementedBy'))warn('NO_IMPLEMENTATION',e,'Technical Realizationがありません');
  }
  if(e.kind==='realization'){
   if(!ins.some(x=>x.relation==='implementedBy'))warn('ORPHAN_REALIZATION',e,'この技術実現の論理責務が未定義です');
   if(e.data.public===true&&(!e.data.authentication||e.data.authentication==='none'))warn('PUBLIC_AUTH',e,'外部公開リソースに認証メカニズムがありません');
  }
  if(e.kind==='decision'&&!has('affects'))warn('UNBOUND_DECISION',e,'この設計判断の影響先が紐付いていません');
  if(e.kind==='policy'&&!has('appliesTo'))warn('NO_POLICY_TARGET',e,'Policyの適用対象がありません');
  if(e.kind==='scenario'&&e.data.type==='gherkin'&&typeof e.data.specification==='string'&&!['Given','When','Then'].every(word=>new RegExp(`^\\s*${word}\\s+`,'m').test(e.data.specification as string)))warn('INVALID_GHERKIN',e,'GherkinにはGiven / When / Thenが必要です');
  if(e.kind==='verification'&&e.data.result==='passed'&&!has('evidencedBy'))warn('NO_EVIDENCE',e,'検証成功の証跡がありません');
  if(['implemented','verified','operational'].includes(String(e.data.status))){
   const c=completeness(model,e.id);
   if(!c.implementation||(e.data.status!=='implemented'&&!c.verified)||(e.data.status==='operational'&&!c.observability))warn('STATE_GAP',e,'状態を裏付ける実装・成功した検証・運用情報が不足しています');
  }
 }
 return diagnostics;
}
export interface TracePath {nodes:string[]; relations:Relation[]}
/** Only causal reverse links are followed: unrelated shared resources do not invent a Why path. */
export function traceWhy(model:Model,id:string):TracePath[]{
 const results:TracePath[]=[];
 const walk=(at:string,nodes:string[],relations:Relation[])=>{
  if(model.entities.find(e=>e.id===at)?.kind==='product'){results.push({nodes,relations});return;}
  for(const edge of incoming(model,at))if(['has','realizedBy','implementedBy','verifiedBy','evidencedBy','uses','provides','consumes'].includes(edge.relation)&&!nodes.includes(edge.from)){
   if(results.length<1000)walk(edge.from,[...nodes,edge.from],[...relations,edge.relation]);
  }
 };
 walk(id,[id],[]);return results;
}
export const DEFAULT_RELATIONS:readonly Relation[]=['has','realizedBy','implementedBy','verifiedBy','uses','provides','consumes'];
/** Bounded breadth-first traversal. Visited nodes break cycles; filters also apply to architecture edges. */
export function relatedIds(model:Model,id:string,options:TraversalOptions={}):Set<string>{
 const opts=options;
 const direction=opts.direction??'forward',depth=opts.depth??2,relations=new Set(opts.relationTypes??DEFAULT_RELATIONS);
 if(!Number.isInteger(depth)||depth<0)throw new RangeError('depth must be a non-negative finite integer');
 const found=new Set<string>();if(!model.entities.some(e=>e.id===id))return found;
 const queue:Array<{id:string;depth:number}>=[{id,depth:0}];found.add(id);
 for(let i=0;i<queue.length;i++){
  const at=queue[i];if(at.depth>=depth)continue;
  for(const e of model.edges){
   if(!relations.has(e.relation))continue;
   const next=e.from===at.id&&direction!=='reverse'?e.to:e.to===at.id&&direction!=='forward'?e.from:undefined;
   if(next&&!found.has(next)){found.add(next);queue.push({id:next,depth:at.depth+1});}
  }
 }
 return found;
}
/** Coverage and result are independent. A missing result is unknown; a failure always wins. */
export function verificationSummary(model:Model,id:string):VerificationSummary{
 const subject=model.entities.find(e=>e.id===id);
 if(!subject)return {coverage:'uncovered',verification_status:'unknown',status:'uncovered',verificationIds:[]};
 const scope=relatedIds(model,id,{direction:'forward',depth:model.entities.length,relationTypes:['has','uses']});
 const targets=model.entities.filter(e=>scope.has(e.id)&&(['scenario','quality','policy','contract'].includes(e.kind)||outgoing(model,e.id,'verifiedBy').length>0));
 const verificationIds=subject.kind==='verification'?[id]:[...new Set(targets.flatMap(e=>outgoing(model,e.id,'verifiedBy').map(edge=>edge.to)))];
 const covered=subject.kind==='verification'||(targets.length>0&&targets.every(e=>outgoing(model,e.id,'verifiedBy').length>0));
 const tests=verificationIds.map(id=>model.entities.find(e=>e.id===id)!);
 const result=tests.some(e=>e.data.result==='failed')?'failed':tests.length>0&&tests.every(e=>e.data.result==='passed')?'passed':'unknown';
 return {coverage:covered?'covered':'uncovered',verification_status:result,status:result==='failed'?'failed':!covered?'uncovered':result==='passed'?'verified':'covered_unknown',verificationIds};
}
export function completeness(model:Model,id:string){
 // Completeness has a dedicated forward realization scope, never architecture dependency closure.
 const ids=relatedIds(model,id,{direction:'forward',depth:model.entities.length,relationTypes:DEFAULT_RELATIONS});
 const entities=model.entities.filter(e=>ids.has(e.id));const assurance=verificationSummary(model,id);
 return {design:entities.some(e=>['behavior','quality','policy','component'].includes(e.kind)),component:entities.some(e=>e.kind==='component'),implementation:entities.some(e=>e.kind==='realization'),coverage:assurance.coverage,verified:assurance.status==='verified',verification_status:assurance.verification_status,assurance_status:assurance.status,observability:entities.some(e=>e.kind==='realization'&&Array.isArray(e.data.observability)&&e.data.observability.length>0)};
}
export interface QuestionOptions { locale?:'ja'|'en'; messages?:Record<string,string>; priorities?:Record<string,number> }
export function nextQuestions(model:Model,options:QuestionOptions={}):Question[]{
 const messages:Record<string,string>={...defaults.messages.ja,...defaults.messages[options.locale??'ja'],...options.messages};
 const priorities:Record<string,number>={...defaults.priorities,...options.priorities};
 return validateModel(model).filter(d=>d.severity==='warning').map(d=>{
  const e=model.entities.find(e=>e.id===d.entityId);
  const high=e?.kind==='quality'&&(['high','critical'].includes(String(e.data.risk))||e.data.level==='high'||(e.data.attribute==='availability'&&Number(e.data.target)>=99.99));
  let priority=d.code==='NO_PRODUCT'?110:priorities[e?.kind??'product']??50;
  if(high&&['UNCOVERED','NO_REALIZATION'].includes(d.code))priority=85;
  if(d.code==='PUBLIC_AUTH')priority=84;
  return {id:`${d.code}:${d.entityId??'model'}:${d.field??''}`,entityId:d.entityId,field:d.field,priority,text:(messages[d.code]??messages.MISSING_FIELD).replaceAll('{name}',e?.name??'Product').replaceAll('{field}',d.field??d.code),reason:d.message};
 }).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
}
export const nextQuestion=(model:Model,options:QuestionOptions={})=>nextQuestions(model,options)[0]??null;
