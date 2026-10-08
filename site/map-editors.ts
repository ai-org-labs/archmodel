import {saveArchitectureConnection,saveDocumentMetadata,removeModelEdge} from '@archmodel/core';
import type {Model} from '@archmodel/core';
import {escapeHtml as escape} from './content.js';
interface Host{source():string;model():Model;replace(source:string):void;link(id:string):void}
export function installMapEditors(host:Host){
 function editor(title:string,value:unknown,save:(base:string,value:Record<string,unknown>)=>string,remove?:(base:string)=>string){
  const base=host.source(),dialog=document.createElement('dialog');dialog.className='map-json-editor';
  dialog.innerHTML=`<form><div class="panel-head"><h2>${escape(title)}</h2><button type="button" data-close aria-label="閉じる">×</button></div><p>選択した対象のDSL項目を編集します。他の設計内容は保持します。</p><label>項目（JSON）<textarea aria-label="項目（JSON）" rows="18">${escape(JSON.stringify(value,null,2))}</textarea></label><p role="alert"></p><button type="submit">保存してマップへ</button>${remove?'<button type="button" data-remove>この接続を削除</button>':''}</form>`;
  dialog.querySelector('[data-close]')!.addEventListener('click',()=>dialog.close());
  dialog.querySelector('form')!.onsubmit=e=>{e.preventDefault();try{if(host.source()!==base)throw new Error('モデルが変更されました。開き直してください。');const value=JSON.parse(dialog.querySelector('textarea')!.value);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('JSONオブジェクトを指定してください');host.replace(save(base,value));dialog.close();}catch(err){dialog.querySelector('[role=alert]')!.textContent=String(err);}};
  dialog.querySelector('[data-remove]')?.addEventListener('click',()=>{try{if(host.source()!==base)throw new Error('モデルが変更されました。開き直してください。');host.replace(remove!(base));dialog.close();}catch(err){dialog.querySelector('[role=alert]')!.textContent=String(err);}});
  dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
 }
 function metadata(){const {version,extensions,review_catalog,review_scopes}=host.model().source;editor('文書・観点定義',{version,extensions:extensions??{},review_catalog:review_catalog??[],review_scopes:review_scopes??[]},saveDocumentMetadata);}
 function connection(index?:number){const model=host.model(),edge=index===undefined?undefined:model.edges[index];
  if(edge?.id){const connection=model.connections.find(c=>c.id===edge.id)!;editor('実接続を編集',connection,(base,value)=>saveArchitectureConnection(base,value,edge.id),base=>removeModelEdge(base,index!));return;}
  if(index===undefined){const ids=new Set([...model.entities.map(e=>e.id),...model.connections.map(e=>e.id),...(model.reviews??[]).map(r=>r.id)]);let n=1;while(ids.has(`connection-${n}`))n++;editor('実接続を追加',{id:`connection-${n}`,from:model.entities.find(e=>e.kind==='component'||e.kind==='realization')?.id??'',to:'',type:'calls'},saveArchitectureConnection);return;}
  if(!edge)return;const base=host.source(),dialog=document.createElement('dialog');dialog.className='relation-choice';
  dialog.innerHTML=`<h2>関係の確認・変更</h2><p>${escape(edge.from)} → ${escape(edge.relation)} → ${escape(edge.to)}</p><button data-add>関連を追加</button><button data-remove>この関連を解除</button><button data-close>閉じる</button><p role="alert"></p>`;
  dialog.querySelector('[data-add]')!.addEventListener('click',()=>{dialog.close();host.link(edge.from);});
  dialog.querySelector('[data-remove]')!.addEventListener('click',()=>{try{if(host.source()!==base)throw new Error('モデルが変更されました。開き直してください。');host.replace(removeModelEdge(base,index));dialog.close();}catch(err){dialog.querySelector('[role=alert]')!.textContent=String(err);}});
  dialog.querySelector('[data-close]')!.addEventListener('click',()=>dialog.close());dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
 }
 return {metadata,connection};
}
