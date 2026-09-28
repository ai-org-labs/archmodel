import {reviewRows,reviewSummary,reviewStatusLabels,reviewStatuses,saveReview,startReview,suggestReviewId} from '@archmodel/core';
import type {DesignReview,Model,ReviewStatus} from '@archmodel/core';
import {escapeHtml as escape} from './content.js';
interface Host {source():string;model():Model;replace(source:string):void}
export function installReviews(host:Host){
 const dialog=document.createElement('dialog');dialog.id='review-dialog';dialog.className='review-dialog';document.body.append(dialog);
 let target='',perspective='',base='';
 const get=<T extends HTMLElement>(id:string)=>dialog.querySelector<T>(`#${id}`)!;
 function render(){
  const model=host.model();base=host.source();
  const rows=reviewRows(model,target),summary=reviewSummary(model,target);
  if(!rows.some(r=>r.perspective.id===perspective))perspective=rows[0]?.perspective.id??'';
  const row=rows.find(r=>r.perspective.id===perspective)!;
  const record=row.record;
  dialog.innerHTML=`<div class="panel-head"><div><small>DESIGN REVIEW</small><h2>観点の検討記録</h2></div><button id="close-review" type="button" aria-label="観点レビューを閉じる">×</button></div><div class="review-content"><label>対象要素（target）<select id="review-target">${model.entities.map(e=>`<option value="${escape(e.id)}" ${e.id===target?'selected':''}>${escape(e.name)} / ${escape(e.kind)} / ${escape(e.id)}</option>`).join('')}</select></label><p class="review-summary" role="status">${summary.tracked?`${summary.resolved} / ${summary.total} 観点の判断が完了`:'この対象の検討は未開始です'} · 未検討 ${summary.counts.unreviewed} / 検討中 ${summary.counts.in_review} / 対象 ${summary.counts.applicable} / 対象外 ${summary.counts.not_applicable} / 保留 ${summary.counts.deferred}</p><p class="review-note">空欄は未検討です。対象外には理由・前提・再検討条件、保留には理由・残るリスク・再検討条件を残します。親の判断は継承しません。判断完了は実装・検証の完了を意味しません。</p>${summary.tracked?'':'<button id="start-review" type="button">この対象の検討を開始</button>'}<div class="review-grid"><div class="review-list" aria-label="観点一覧">${rows.map(r=>`<button type="button" data-perspective="${escape(r.perspective.id)}" aria-pressed="${r.perspective.id===perspective}"><strong>${escape(r.perspective.name)}</strong><small>${escape(r.perspective.id)}</small><span>${reviewStatusLabels[r.status]}${r.gaps.length?' · 根拠不足':''}</span></button>`).join('')}</div><form id="review-form"><h3>${escape(row.perspective.name)}</h3><p>${escape(row.perspective.description??'')}</p><label>status（検討状態）<select id="review-status">${reviewStatuses.map(s=>`<option value="${s}" ${s===row.status?'selected':''}>${s}（${reviewStatusLabels[s]}）</option>`).join('')}</select></label><label>owner（判断担当）<input id="review-owner" value="${escape(record?.owner)}"></label><label>rationale（適用・対象外・保留の理由）<textarea id="review-rationale" rows="3">${escape(record?.rationale)}</textarea></label><label>assumptions（成立する前提、1行に1項目）<textarea id="review-assumptions" rows="2">${escape(record?.assumptions?.join('\n'))}</textarea></label><label>residual_risk（保留中に残るリスク）<textarea id="review-residual-risk" rows="2">${escape(record?.residual_risk)}</textarea></label><label>revisit_when（再検討の条件）<textarea id="review-revisit" rows="2">${escape(record?.revisit_when)}</textarea></label><label>addresses（対象として扱う設計要素、複数選択可）<select id="review-addresses" multiple size="5">${model.entities.map(e=>`<option value="${escape(e.id)}" ${record?.addresses?.includes(e.id)?'selected':''}>${escape(e.name)} / ${escape(e.id)}</option>`).join('')}</select></label><p id="review-error" class="form-error" role="alert">${row.gaps.length?escape(`不足・矛盾: ${row.gaps.join(', ')}`):''}</p><div class="guide-actions"><button type="submit" class="primary">検討記録を保存</button></div><p class="review-note">未完成でも保存できます。不足は診断に残り、判断完了には数えません。</p></form></div></div>`;
  get('close-review').onclick=()=>dialog.close();
  get('review-target').onchange=()=>{target=get<HTMLSelectElement>('review-target').value;perspective='';render();};
  const ensureFresh=()=>{if(host.source()!==base)throw new Error('モデルが変更されました。閉じて開き直してください。');};
  const start=dialog.querySelector<HTMLButtonElement>('#start-review');if(start)start.onclick=()=>{try{ensureFresh();host.replace(startReview(base,target));render();}catch(error){get('review-error').textContent=String(error);}};
  dialog.querySelectorAll<HTMLButtonElement>('[data-perspective]').forEach(button=>button.onclick=()=>{perspective=button.dataset.perspective!;render();});
  get('review-form').onsubmit=event=>{event.preventDefault();try{
   ensureFresh();const value=(id:string)=>get<HTMLInputElement|HTMLTextAreaElement>(id).value.trim();
   const review:DesignReview={id:suggestReviewId(host.model(),target,perspective),target,perspective,status:get<HTMLSelectElement>('review-status').value as ReviewStatus};
   for(const [key,id]of [['owner','review-owner'],['rationale','review-rationale'],['residual_risk','review-residual-risk'],['revisit_when','review-revisit']] as const){const text=value(id);if(text)review[key]=text;}
   const assumptions=value('review-assumptions').split('\n').map(s=>s.trim()).filter(Boolean);if(assumptions.length)review.assumptions=assumptions;
   const addresses=Array.from(get<HTMLSelectElement>('review-addresses').selectedOptions).map(o=>o.value);if(addresses.length)review.addresses=addresses;
   host.replace(saveReview(base,review));render();
  }catch(error){get('review-error').textContent=error instanceof Error?error.message:String(error);}};
 }
 function open(id?:string,perspectiveId?:string){
  const model=host.model();if(model.diagnostics.some(d=>d.severity==='error')){alert('先にDSLの構造・参照エラーを修正してください。');return;}
  target=id??model.entities.find(e=>e.kind==='product')?.id??model.entities[0]?.id??'';
  if(!target){alert('先にProductなどの検討対象を追加してください。');return;}
  perspective=perspectiveId??'';render();dialog.showModal();
 }
 return {open};
}
