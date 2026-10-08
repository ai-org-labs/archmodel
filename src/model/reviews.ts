import schema from '../../schema/archmodel.schema.json';
import {qualityAttributes} from './presentation.js';
import type {DesignReview,Diagnostic,Model,ReviewPerspective,ReviewStatus} from './types.js';
export const reviewStatuses=schema.$defs.designReview.properties.status.enum as ReviewStatus[];
export const reviewStatusLabels:Record<ReviewStatus,string>={unreviewed:'未検討',in_review:'検討中',applicable:'対象',not_applicable:'対象外',deferred:'保留'};
export const defaultReviewCatalog:readonly ReviewPerspective[]=[
 {id:'behavior_specification',name:'振る舞い・入出力',description:'入力、開始条件、結果と業務ルールを具体化する'},
 {id:'scenario_coverage',name:'シナリオ・境界条件',description:'正常系、失敗、境界条件を具体例で確認する'},
 {id:'contracts',name:'契約・インターフェース',description:'API、イベント、外部契約と利用・提供者を確認する'},
 {id:'logical_responsibilities',name:'論理責務',description:'要求を実現するComponentと責務分担を確認する'},
 {id:'technical_realization',name:'技術実現',description:'実装・実行環境と論理責務の対応を確認する'},
 {id:'verification_evidence',name:'検証・証跡',description:'何をどの方法で保証し、結果と証跡を残すか確認する'},
 {id:'policies',name:'制約・ポリシー',description:'守るべき規則と適用対象を確認する'},
 {id:'design_decisions',name:'方式判断・代替案',description:'採用理由、代替案、トレードオフと影響対象を確認する'},
 {id:'system_boundary',name:'システム境界',description:'管理対象、対象外、責任分界を確認する'},
 {id:'actors',name:'利用者・権限',description:'利用者と操作権限、管理者との違いを確認する'},
 {id:'data_lifecycle',name:'データの責任とライフサイクル',description:'正本、所有者、保存、削除を確認する'},
 {id:'external_dependencies',name:'外部依存',description:'外部契約、停止・変更時の影響を確認する'},
 {id:'assumptions',name:'前提・未決事項',description:'設計が成立する前提と確認が必要な点を整理する'},
 {id:'failure_modes',name:'失敗・例外',description:'失敗の検出、利用者への応答、回復方法を確認する'},
 ...schema.$defs.quality.properties.attribute.enum.map(id=>({id:`quality.${id}`,name:qualityAttributes[id]??id,description:`${id}の適用要否と、必要な保証水準を確認する`}))
];
export function reviewCatalog(model:Model):ReviewPerspective[]{return [...defaultReviewCatalog,...(model.reviewCatalog??[])];}
export function reviewScopeIds(model:Model):string[]{return [...new Set([...(model.reviewScopes??[]),...(model.reviews??[]).map(r=>r.target)])];}
const present=(value:unknown)=>typeof value==='string'&&value.trim().length>0;
export function reviewGaps(review:DesignReview):string[]{
 const state=review.status??'unreviewed',gaps:string[]=[];
 if(['applicable','not_applicable','deferred'].includes(state)){
  if(!present(review.rationale))gaps.push('rationale');
  if(!present(review.owner))gaps.push('owner');
 }
 if(state==='applicable'&&!review.addresses?.length)gaps.push('addresses');
 if(state==='not_applicable'&&review.addresses?.length)gaps.push('addresses_not_applicable');
 if(state==='not_applicable'&&!review.assumptions?.length)gaps.push('assumptions');
 if(['not_applicable','deferred'].includes(state)&&!present(review.revisit_when))gaps.push('revisit_when');
 if(state==='deferred'&&!present(review.residual_risk))gaps.push('residual_risk');
 return gaps;
}
/** Missing entries are unreviewed, never implicit exclusions. No parent inheritance. */
export function reviewRows(model:Model,target:string){
 if(!model.entities.some(e=>e.id===target))throw new RangeError(`Unknown review target: ${target}`);
 return reviewCatalog(model).map(perspective=>{const record=model.reviews?.find(r=>r.target===target&&r.perspective===perspective.id);const status=record?.status??'unreviewed';const gaps=record?reviewGaps(record):[];return {perspective,target,record,status,gaps,resolved:!!record&&['applicable','not_applicable'].includes(status)&&gaps.length===0};});
}
export function reviewSummary(model:Model,target?:string){
 const scopes=reviewScopeIds(model),targets=target?[target]:scopes;
 const rows=targets.flatMap(id=>reviewRows(model,id));
 const counts=Object.fromEntries(reviewStatuses.map(status=>[status,rows.filter(r=>r.status===status).length])) as Record<ReviewStatus,number>;
 const resolved=rows.filter(r=>r.resolved).length;
 const tracked=target?scopes.includes(target):scopes.length>0;
 return {tracked,total:rows.length,counts,resolved,complete:tracked&&rows.length>0&&resolved===rows.length&&!model.diagnostics.some(d=>d.severity==='error')};
}
/** Structural references live outside the requirement/implementation graph. */
export function reviewStructureDiagnostics(model:Model):Diagnostic[]{
 const result:Diagnostic[]=[];const error=(code:string,path:string,message:string)=>result.push({code,path,message,severity:'error'});
 const catalogIds=new Set(defaultReviewCatalog.map(p=>p.id));
 for(const [i,p]of (model.reviewCatalog??[]).entries()){if(catalogIds.has(p.id))error('DUPLICATE_ID',`$.review_catalog[${i}].id`,`観点IDが重複しています: ${p.id}`);catalogIds.add(p.id);}
 const entityIds=new Set(model.entities.map(e=>e.id));
 for(const [i,id]of (model.reviewScopes??[]).entries())if(!entityIds.has(id))error('UNKNOWN_REFERENCE',`$.review_scopes[${i}]`,`検討対象がありません: ${id}`);
 const occupied=new Set([...entityIds,...model.connections.map(c=>c.id)]),pairs=new Set<string>();
 for(const [i,r]of (model.reviews??[]).entries()){
  const path=`$.reviews[${i}]`,pair=JSON.stringify([r.target,r.perspective]);
  if(occupied.has(r.id))error('DUPLICATE_ID',`${path}.id`,`IDが重複しています: ${r.id}`);occupied.add(r.id);
  if(pairs.has(pair))error('DUPLICATE_REVIEW',path,'同一対象・観点の検討記録が重複しています');pairs.add(pair);
  if(!catalogIds.has(r.perspective))error('UNKNOWN_REFERENCE',`${path}.perspective`,`観点がありません: ${r.perspective}`);
  if(!entityIds.has(r.target))error('UNKNOWN_REFERENCE',`${path}.target`,`検討対象がありません: ${r.target}`);
  for(const id of r.addresses??[])if(!entityIds.has(id))error('UNKNOWN_REFERENCE',`${path}.addresses`,`設計要素がありません: ${id}`);
 }
 return result;
}
export function reviewDiagnostics(model:Model):Diagnostic[]{
 const result:Diagnostic[]=[];
 for(const target of reviewScopeIds(model))for(const row of reviewRows(model,target)){
  const {record,status,perspective}=row;
  const path=record?`$.reviews[${model.reviews!.indexOf(record)}]`:'$.review_scopes';
  const push=(code:string,message:string)=>result.push({code,severity:'warning',path,entityId:target,field:perspective.id,message:`「${perspective.name}」: ${message}`});
  if(status==='unreviewed')push('REVIEW_UNREVIEWED','未検討です。適用要否を確認してください');
  if(status==='in_review')push('REVIEW_IN_PROGRESS','検討中です。判断に必要な情報を確認してください');
  if(status==='deferred')push('REVIEW_DEFERRED','保留中です。残るリスクと再検討条件を確認してください');
  if(row.gaps.length)push('REVIEW_INCOMPLETE',`判断の根拠が不足または矛盾しています: ${row.gaps.join(', ')}`);
 }
 return result;
}
