import {scenarioTemplates} from './scenario-templates.js';
import {fieldLabels as labels,scenarioFormats,qualityCategories,qualityAttributeCategory,decisionCategories,policyCategories} from '../src/model/presentation.js';
import {EMPTY_MODEL,editableFields,definitions,suggestId,saveEntity,linkEntities,mergeContribution,parseModel,kinds} from '../src/index.js';
import type {Model,Kind} from '../src/index.js';
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const get=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;

interface Host{source():string;model():Model;replace(source:string):void;select(id:string):void;save(name:string,text:string):void;beginLink(id:string):void}
export function installAuthoring(host:Host){
 document.body.insertAdjacentHTML('beforeend',`<dialog id="entity-dialog" class="entity-dialog"><form id="entity-form"><div class="panel-head"><div><small id="form-context"></small><h2 id="form-title">要素を追加</h2></div><button id="cancel-entity" type="button" aria-label="要素編集を閉じる">×</button></div><p id="form-hint">分かる項目だけ入力できます。不足は設計の確認に残ります。</p><div class="form-heading"><label>要素の種類<select id="entity-kind">${kinds.map(k=>`<option>${k}</option>`).join('')}</select></label><details><summary>識別子（自動設定）</summary><label>ID<input id="entity-id" required pattern="[A-Za-z][A-Za-z0-9_.-]*"></label></details></div><div id="entity-fields"></div><p id="form-error" class="form-error" role="alert"></p><div class="form-actions"><span>＊名称は必須。配列は1行に1項目。</span><button type="submit" class="primary">保存してマップへ</button></div></form></dialog>`);
 let editing:string|undefined,newDocument=false,parentLink:{from?:string;to?:string;field:string}|undefined;let baseAtOpen='';let kind:Kind='product';
 const historyKey='archmodel:work-history:v1';
 const history=()=>{try{return JSON.parse(localStorage.getItem(historyKey)??'[]') as Array<{name:string;source:string}>;}catch{return [];}};
 function archive(){const source=host.source();if(!parseModel(source).entities.length)return;try{const all=history().filter(d=>d.source!==source);all.unshift({name:host.model().entities.find(e=>e.kind==='product')?.name??host.model().entities[0]?.name??'作業中のモデル',source});localStorage.setItem(historyKey,JSON.stringify(all.slice(0,20)));}catch{throw new Error('現在の作業を履歴に保存できません。YAML保存してから新規作成してください。');}}
 function start(){try{archive();host.replace(EMPTY_MODEL);get('restore-work').hidden=!history().length;}catch(error){alert(String(error));}}
 function renderFields(data:Record<string,unknown>={}){
  const primary=['name','inputs','outputs',...(kind==='policy'?['category']:[]),...definitions[kind]['x-design-required'].filter(k=>k!=='name'),...(({product:['purpose','primary_users','user_value','scope','out_of_scope'],capability:['actor','inputs','outputs','guarantees','constraints'],behavior:['use_cases','commands','events','trigger','outcomes'],scenario:['specification'],quality:['attribute','requirement','target','unit','level'],verification:['level','method','result','location'],evidence:['location','collected_at','result'],realization:['kind','provider','service','location','environment']} as Record<string,string[]>)[kind]??[]), 'owner','status'];
  const fields=editableFields(kind).sort(([a],[b])=>(primary.includes(a)?primary.indexOf(a):-1)-(primary.includes(b)?primary.indexOf(b):-1));
  const render=([key,rule]:ReturnType<typeof editableFields>[number])=>{
   const value=data[key];const title=kind==='quality'&&key==='level'?'要求レベル：Level':labels[key]??key;let control='';
   if((kind==='decision'||kind==='policy')&&key==='category')control=`<input data-field="category" list="decision-categories" value="${escape(value)}"><datalist id="decision-categories">${Object.entries(kind==='policy'?policyCategories:decisionCategories).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</datalist>`;
   else if(rule.enum)control=`<select data-field="${key}"><option value="">未定義</option>${rule.enum.map(v=>`<option value="${escape(v)}" ${v===value?'selected':''}>${escape(kind==='scenario'&&key==='type'?scenarioFormats[String(v)]??v:kind==='quality'&&key==='attribute'?qualityCategories[String(v)]??`${qualityCategories[qualityAttributeCategory[String(v)]]??''} / ${v}`:v)}</option>`).join('')}</select>`;
   else if(rule.type==='boolean')control=`<select data-field="${key}"><option value="">未定義</option><option value="true" ${value===true?'selected':''}>true</option><option value="false" ${value===false?'selected':''}>false</option></select>`;
   else if(key==='name'||key==='owner')control=`<input data-field="${key}" value="${escape(value)}" ${key==='name'?'required':''} placeholder="${key==='owner'?'担当者名、チーム名など':''}">`;
   else control=`<textarea data-field="${key}" rows="${key==='specification'?5:2}" placeholder="${rule.type==='array'?'1行に1項目':rule.type==='object'?'JSONオブジェクト':''}">${escape(Array.isArray(value)?value.join('\n'):value&&typeof value==='object'?JSON.stringify(value,null,2):value)}</textarea>`;
   return `<label class="${['name','specification'].includes(key)?'full-row':''}" data-field-label="${key}">${title}${key==='name'?' *':''}<small>${definitions[kind]['x-design-required']?.includes(key)?'設計上の必須項目':''}</small>${control}</label>`;
  };
  get('entity-fields').innerHTML=fields.filter(([key])=>primary.includes(key)).map(render).join('')+'<details class="optional-fields"><summary>補足項目を入力</summary><div>'+fields.filter(([key])=>!primary.includes(key)).map(render).join('')+'</div></details>';
  if(kind==='scenario'){
   const type=get('entity-fields').querySelector<HTMLSelectElement>('[data-field="type"]')!;
   const spec=get('entity-fields').querySelector<HTMLTextAreaElement>('[data-field="specification"]')!;
   let previousType=type.value,undoText:string|undefined;
   const template=()=>scenarioTemplates[type.value]??'';
   if(!editing&&!spec.value)spec.value=template();
   spec.rows=9;
   spec.insertAdjacentHTML('afterend','<span class="template-actions"><button type="button" id="apply-template">この形式のテンプレートを入れる</button><button type="button" id="undo-template" hidden>元の内容に戻す</button></span>');
   type.onchange=()=>{const old=scenarioTemplates[previousType]??'';if(!spec.value.trim()||spec.value===old)spec.value=template();spec.placeholder=template();previousType=type.value;};
   get('apply-template').onclick=()=>{undoText=spec.value;spec.value=template();get('undo-template').hidden=false;};
   get('undo-template').onclick=()=>{if(undoText!==undefined)spec.value=undoText;get('undo-template').hidden=true;};
  }

 }
 function open(kindToOpen:Kind,options:{id?:string;fresh?:boolean;link?:typeof parentLink;attribute?:string;category?:string;itemType?:string}={}){
  kind=kindToOpen;editing=options.id;newDocument=!!options.fresh;parentLink=options.link;baseAtOpen=host.source();
  const model=newDocument?parseModel(EMPTY_MODEL):host.model();
  if(!newDocument&&model.diagnostics.some(d=>d.severity==='error')){alert('先にDSLの構文・参照エラーを修正してください。');return;}
  const entity=editing?model.entities.find(e=>e.id===editing):undefined;
  get<HTMLSelectElement>('entity-kind').value=kind;get<HTMLSelectElement>('entity-kind').disabled=!!editing||!!parentLink;
  get<HTMLInputElement>('entity-id').value=entity?.id??suggestId(model,kind);get<HTMLInputElement>('entity-id').disabled=!!editing;
  get('form-title').textContent=`${kind.charAt(0).toUpperCase()+kind.slice(1)}を${editing?'編集':'追加'}`;
  get('form-context').textContent=parentLink?`${model.entities.find(e=>e.id===(parentLink?.from??parentLink?.to))?.name??''} に追加`:'マップの項目を編集';get('form-error').textContent='';
  renderFields(entity?.data??{status:'draft',...(kind==='scenario'?{type:'gherkin'}:{}),...(options.itemType?{kind:options.itemType}:{}),...(options.attribute?{attribute:options.attribute}:{}),...(options.category?{category:options.category}:{})});get<HTMLDialogElement>('entity-dialog').showModal();
 }
 get('entity-kind').onchange=()=>{kind=get<HTMLSelectElement>('entity-kind').value as Kind;get<HTMLInputElement>('entity-id').value=suggestId(newDocument?parseModel(EMPTY_MODEL):host.model(),kind);renderFields(kind==='scenario'?{type:'gherkin'}:{});};
 get('cancel-entity').onclick=()=>get<HTMLDialogElement>('entity-dialog').close();
 get('entity-form').onsubmit=e=>{
  e.preventDefault();try{
   if(host.source()!==baseAtOpen)throw new Error('編集中にモデルが変更されました。一度閉じて最新の内容を開き直してください。');
   const data:Record<string,unknown>={id:get<HTMLInputElement>('entity-id').value.trim()};
   for(const [key,rule]of editableFields(kind)){
    const text=get('entity-fields').querySelector<HTMLInputElement|HTMLTextAreaElement>(`[data-field="${key}"]`)!.value.trim();if(!text)continue;
    data[key]=rule.type==='array'?text.split('\n').map(s=>s.trim()).filter(Boolean):rule.type==='boolean'?text==='true':rule.type==='object'?JSON.parse(text):Array.isArray(rule.type)&&rule.type.includes('number')&&/^-?\d+(\.\d+)?$/.test(text)?Number(text):text;
   }
   let result=saveEntity(newDocument?EMPTY_MODEL:baseAtOpen,kind,data,editing);
   if(parentLink)result=linkEntities(result,parentLink.from??String(data.id),parentLink.field,parentLink.to??String(data.id));
   if(newDocument)archive();host.replace(result);get<HTMLDialogElement>('entity-dialog').close();host.select(String(data.id));
  }catch(error){get('form-error').textContent=error instanceof Error?error.message:String(error);}
 };
 get('merge-open').onclick=()=>get<HTMLInputElement>('merge-file').click();get('merge-file').onchange=async()=>{try{const f=get<HTMLInputElement>('merge-file').files?.[0];if(!f)return;get('merge-result').textContent='読み込み中…';const base=host.source();const incoming=await f.text();if(base!==host.source())throw new Error('読み込み中にモデルが変更されました。再度取り込んでください。');host.replace(mergeContribution(base,incoming));get('merge-result').textContent='作成分を追加しました。「マップで相手を選んでつなぐ」で担当間の接続を定義できます。';}catch(error){get('merge-result').textContent=String(error);}finally{get<HTMLInputElement>('merge-file').value='';}};
 document.addEventListener('click',event=>{
  const target=(event.target as Element).closest<HTMLElement>('[data-create-kind],[data-edit-form],[data-link-node]');if(!target)return;
  if(target.dataset.createKind)open(target.dataset.createKind as Kind,{itemType:target.dataset.itemType,attribute:target.dataset.qualityAttribute,category:target.dataset.decisionCategory??target.dataset.policyCategory,link:target.dataset.linkField?{field:target.dataset.linkField,from:target.dataset.linkFrom,to:target.dataset.linkTo}:undefined});
  if(target.dataset.editForm){const e=host.model().entities.find(e=>e.id===target.dataset.editForm)!;open(e.kind,{id:e.id});}
  if(target.dataset.linkNode)host.beginLink(target.dataset.linkNode);
 });
 get('restore-work').onclick=()=>{const d=history()[0];if(d){try{archive();host.replace(d.source);}catch(error){alert(String(error));}}};
 get('restore-work').hidden=!history().length;
 return {start,add:()=>open('capability'),open};
}
