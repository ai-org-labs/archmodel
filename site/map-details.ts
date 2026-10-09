import {fieldLabel,relationLabels,mapQualityGroups,mapDesignGroups,mapReviewRows,reviewStatusLabels,reviewRows} from '@archmodel/core';
import type {Model} from '@archmodel/core';
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const detailValue=(value:unknown):string=>Array.isArray(value)?value.map(v=>typeof v==='object'?JSON.stringify(v,null,2):String(v)).join('\n'):typeof value==='object'?JSON.stringify(value,null,2):String(value??'');
const nested=new Set(['capabilities','behaviors','scenarios','quality','qualities','policies','decisions','components','realizations','verifications','contracts','evidence']);
export function entityDetail(model:Model,id:string) {
 const e=model.entities.find(e=>e.id===id);if(!e)return '';
 const fields=Object.entries(e.data).filter(([key])=>!nested.has(key));
 const edges=model.edges.filter(l=>l.from===id||l.to===id);
 const relationGroups=new Map<string,string[]>();
 for(const edge of edges){const outgoing=edge.from===id,other=model.entities.find(n=>n.id===(outgoing?edge.to:edge.from));const label=(outgoing?'→ ':'← ')+(relationLabels[edge.relation]??edge.relation);if(!relationGroups.has(label))relationGroups.set(label,[]);relationGroups.get(label)!.push(`${other?.name??''} (${other?.id??''})`);}
 const properties=fields.map(([key,value])=>`<dt>${escape(fieldLabel(key,e.kind))}</dt><dd data-detail-field="${escape(key)}">${escape(detailValue(value))}</dd>`).join('');
 const relations=[...relationGroups].map(([key,values])=>`<dt>${escape(key)}</dt><dd>${escape(values.join('\n'))}</dd>`).join('');
 const connections=model.connections.filter(c=>c.from===id||c.to===id).map(c=>`<dt>${escape(c.id)}</dt><dd>${escape(JSON.stringify(c,null,2))}</dd>`).join('');
 const reviewed=(model.reviews??[]).filter(r=>r.target===id);
 const reviews=reviewed.map(r=>`<dt>${escape(reviewRows(model,id).find(row=>row.perspective.id===r.perspective)?.perspective.name??r.perspective)}</dt><dd>${escape(detailValue(r))}</dd>`).join('');
 return `<dl>${properties}</dl>${relations?`<h3>モデル上の関係</h3><dl>${relations}</dl>`:''}${connections?`<h3>実接続の定義</h3><dl>${connections}</dl>`:''}${reviews?`<h3>観点の判断記録</h3><dl>${reviews}</dl>`:''}`;
}
export function reviewDetail(model:Model,target:string,group:string) {
 const definition=[...mapQualityGroups,...mapDesignGroups].find(g=>g.id===group);
 const rows=mapReviewRows(model,target,group);
 const intro=mapQualityGroups.some(g=>g.id===group)?'<p class="detail-hint">品質属性を整理した表示です。正式な非機能要求グレードの全下位項目・レベル表ではありません。要求水準と検討の結論、検証結果は別に扱います。</p>':'';
 return {title:group==='all-quality'?'品質要求の観点':definition?.name??group,html:intro+(rows.length?rows.map(row=>`<section class="review-reading"><h3>${escape(row.perspective.name)}</h3><p>${escape(row.perspective.id)} · ${escape(reviewStatusLabels[row.status])}${row.gaps.length?'（根拠不足）':''}</p>${row.record?`<dl>${Object.entries(row.record).filter(([key])=>!['target','perspective','status'].includes(key)).map(([key,value])=>`<dt>${escape(fieldLabel(key))}</dt><dd>${escape(detailValue(value))}</dd>`).join('')}</dl>`:'<p>判断と根拠は未記録です。対象外とは扱いません。</p>'}</section>`).join(''):'<p>対応する観点はDSLのカタログに未定義です。要求を省略・対象外と判断したことにはなりません。独自観点は review_catalog と reviews に記録できます。</p>')};
}
