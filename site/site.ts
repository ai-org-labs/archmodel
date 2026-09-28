import {installReviews} from './reviews.js';
import {examples,navigation,siteBase} from './content.js';
import {guideMarkup,mountGuide} from './guide.js';
import './playground.css';
import {laneCopy,laneLabel,type LaneLanguage} from '@archmodel/core';
import {fieldLabel,fieldLabels,relationLabels} from '@archmodel/core';
import {DocumentHistory} from './history.js';
import {installAuthoring} from './authoring.js';
import './site.css';
import sample from '../syntax/examples/design-map.archmodel.yaml?raw';
import bottomUp from '../syntax/examples/bottom-up.archmodel.yaml?raw';
import {deleteEntity,parseModel,validateModel,nextQuestion,renderDesignMap,toMarkdown,availableLinks,linkEntities,connectionTypes,EMPTY_MODEL} from '@archmodel/core';
import type {Model,TraversalOptions,Relation,Kind} from '@archmodel/core';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
document.body.innerHTML=`<header><div class="brand"><span class="brand-mark">A</span><strong>ArchModel</strong><span class="divider"></span><span class="workspace-name">Design map</span></div><nav><button id="new-model">新規作成</button><button id="add-element">＋ 要素</button><button id="load">開く</button><input type="file" id="file" accept=".yaml,.yml,.json" hidden><button id="save">YAML保存</button><button id="svg">SVG保存</button><button id="edit" class="primary" aria-expanded="false">〈 〉 DSLを編集</button></nav></header>
<div class="map-toolbar"><div><h1 id="title">Customer Platform</h1><span id="summary" role="status"></span></div><div class="map-actions"><select id="lane-language" aria-label="レーンの表示言語"><option value="en">English</option><option value="ja">日本語</option></select><button id="scope-toggle">関連範囲</button><label class="relations"><input type="checkbox" id="expanded">本文を展開</label><label class="relations"><input type="checkbox" id="relations">選択した関連線</label><button id="checks" aria-label="設計の確認" title="設計の確認">設計の確認 <span id="issue-count">0</span></button><button id="help" aria-label="構文リファレンス">?</button></div></div>
<div id="scope-panel" hidden><label>深さ <input id="scope-depth" type="number" min="0" max="20" value="3"></label><label>方向 <select id="scope-direction"><option value="forward">順方向</option><option value="reverse">逆方向</option><option value="both">双方向</option></select></label><label>関連種別 <select id="scope-types"><option value="design">設計・実装・検証</option><option value="all">全ての意味付き関連</option><option value="architecture">システム接続</option><option value="contract">Contract</option><option value="policy">Policy / Decision</option></select></label></div><main><div id="link-prompt" hidden role="status"><span></span><button id="list-map-links">一覧から選ぶ</button><button id="cancel-map-link">キャンセル</button></div><section id="canvas" tabindex="0" aria-label="設計マップ。ドラッグで移動、要素を選択して詳細を確認"><div id="drawing"></div></section><div class="map-legend"><span class="legend-neutral">設計要素</span><span class="legend-accent">選択・関連</span></div><div class="zoom-controls"><button id="zoom-out" aria-label="縮小">−</button><output id="zoom">100%</output><button id="zoom-in" aria-label="拡大">＋</button><button id="fit">全体表示</button><button id="actual">100%</button></div><div id="empty-error" hidden></div></main>
<footer><span>Product → Capability → Behavior → Scenario</span><span>要素を選択すると、品質・設計・実装まで辿れます</span><div><span id="merge-result" role="status"></span><button id="restore-work" hidden>前の作業に戻る</button><button id="merge-open">YAMLを追加</button><input id="merge-file" type="file" accept=".yaml,.yml" hidden><button id="example">設計サンプル</button><button id="bottom">既存システムから</button></div></footer>
<aside id="editor-panel" class="panel editor-panel" hidden><div class="panel-head"><div><small>SOURCE OF TRUTH</small><h2>Design Model</h2><button id="reload-example" type="button">最新のExampleに戻す</button></div><button id="close-editor" aria-label="エディタを閉じる">×</button></div><p class="panel-note">YAMLの内容が、そのまま設計マップに展開されます。</p><label for="source" class="sr-only">ArchModel DSL</label><textarea id="source" spellcheck="false" wrap="off"></textarea><div class="panel-bottom"><span id="storage">変更は自動保存されます</span><button id="markdown">Markdown保存</button><button id="json">JSON保存</button></div></aside>
<aside id="inspector" class="panel inspector" hidden><div class="panel-head"><div><small id="detail-kind">DESIGN ELEMENT</small><h2 id="detail-title">設計要素</h2></div><button id="close-inspector" aria-label="詳細を閉じる">×</button></div><div id="detail"></div></aside>
<aside id="check-panel" class="panel check-panel" hidden><div class="panel-head"><h2>設計の確認</h2><button id="close-checks" aria-label="確認を閉じる">×</button></div><section><h3>次の問い</h3><p id="question"></p></section><div id="diagnostics" aria-live="polite"></div></aside>
<dialog id="reference"><div class="panel-head"><h2>Syntax & AI prompts</h2><button id="close-help">閉じる</button></div><div id="guide-content"></div></dialog>`;
// One compact workspace bar; secondary controls stay available on demand.
const workspaceHeader=document.querySelector('header')!;
const workspaceIdentity=document.createElement('div');workspaceIdentity.className='workspace-identity';
workspaceIdentity.append(document.querySelector('.brand')!,el('title'));
const workspaceTools=document.createElement('div');workspaceTools.className='workspace-tools';
workspaceTools.insertAdjacentHTML('beforeend','<div class="history-controls"><button id="undo" aria-label="元に戻す" title="元に戻す（⌘/Ctrl+Z）" disabled><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 4 9l5 5 M4 9h10a6 6 0 0 1 0 12h-2"/></svg></button><button id="redo" aria-label="やり直す" title="やり直す（⌘/Ctrl+Shift+Z）" disabled><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 4 5 5-5 5 M20 9H10a6 6 0 0 0 0 12h2"/></svg></button></div>');
function headerMenu(label:string,ids:string[],className:string){
 const menu=document.createElement('details');menu.className='header-menu '+className;
 const summary=document.createElement('summary');summary.textContent=label;menu.append(summary);
 const body=document.createElement('div');body.className='header-menu-body';
 for(const id of ids){const control=el(id);body.append(control.matches('input[type="checkbox"]')?control.closest('label')!:control);}
 menu.append(body);workspaceTools.append(menu);return menu;
}
headerMenu('表示設定',['lane-language','expanded','relations','scope-toggle'],'display-menu');
workspaceTools.insertAdjacentHTML('beforeend','<button id="open-reviews">観点レビュー</button>');
workspaceTools.append(el('checks'),el('edit'));
headerMenu('ファイル',['new-model','add-element','load','file','save','svg','help'],'file-menu');
workspaceTools.querySelector('#edit')!.textContent='〈 〉 DSL';
workspaceHeader.replaceChildren(workspaceIdentity,workspaceTools);
const standalone=document.body.dataset.standalone==='true';
const base=siteBase(document.body.dataset.page??'home',standalone);
const selectedExample=examples.find(e=>e.id===new URLSearchParams(location.search).get('sample'));
document.body.classList.add('playground-page');
workspaceHeader.insertAdjacentHTML('beforebegin',`<div class="playground-nav">${standalone?'<strong>ArchModel · Offline Playground</strong>':navigation('playground',base)}<div><button id="open-guide">Syntax / AIプロンプト</button>${standalone?'':`<a href="${base}standalone.html" download>オフライン版</a>`}</div></div>`);
el('summary').classList.add('sr-only');workspaceHeader.append(el('summary'));
document.querySelector('.map-toolbar')!.remove();
document.querySelectorAll<HTMLDetailsElement>('.header-menu').forEach(menu=>{
 menu.addEventListener('toggle',()=>{if(menu.open)document.querySelectorAll<HTMLDetailsElement>('.header-menu').forEach(other=>{if(other!==menu)other.open=false;});});
 menu.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{menu.open=false;}));
});
document.addEventListener('pointerdown',event=>{if(!(event.target as Element).closest('.header-menu'))document.querySelectorAll<HTMLDetailsElement>('.header-menu').forEach(menu=>menu.open=false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape')document.querySelectorAll<HTMLDetailsElement>('.header-menu').forEach(menu=>menu.open=false);});
const editor=el<HTMLTextAreaElement>('source');let model:Model=parseModel(EMPTY_MODEL);let selectedId='';let svg='';let size={width:2200,height:1200};let scale=1;let autoFit=true;let offsetX=24,offsetY=24,targetScale=1,zoomFrame=0;let zoomAnchor={x:0,y:0};let timer:ReturnType<typeof setTimeout>;let dragged=false;
let linkingFrom='';
let qualitySummaryEditingId='';
const collapsedCapabilities=new Set<string>();
const collapsedBehaviors=new Set<string>();
const foldingActions=document.createElement('div');foldingActions.className='folding-actions';
for(const [label,collapse]of [['すべてのCapabilityを閉じる',true],['すべてのCapabilityを開く',false]] as const){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{collapsedCapabilities.clear();if(collapse)model.entities.filter(e=>e.kind==='capability').forEach(e=>collapsedCapabilities.add(e.id));draw();};foldingActions.append(button);}
for(const [label,collapse]of [['すべてのBehaviorを閉じる',true],['すべてのBehaviorを開く',false]] as const){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{collapsedCapabilities.clear();collapsedBehaviors.clear();if(collapse)model.entities.filter(e=>e.kind==='behavior').forEach(e=>collapsedBehaviors.add(e.id));draw();};foldingActions.append(button);}
document.querySelector('.display-menu .header-menu-body')!.append(foldingActions);
try{el<HTMLSelectElement>('lane-language').value=localStorage.getItem('archmodel:lane-language')==='ja'?'ja':'en';}catch{}
const storageKey=selectedExample?`archmodel:playground:${selectedExample.id}:v0.1`:'archmodel:canonical:v0.1';
try{editor.value=localStorage.getItem(storageKey)??selectedExample?.source??sample;}catch{editor.value=selectedExample?.source??sample;el('storage').textContent='下書きを保存できません。YAML保存をご利用ください。';}
const documentHistory=new DocumentHistory(editor.value);
function syncHistory(){el<HTMLButtonElement>('undo').disabled=!documentHistory.canUndo&&editor.value===documentHistory.current;el<HTMLButtonElement>('redo').disabled=!documentHistory.canRedo||editor.value!==documentHistory.current;}
function commitEditor(){clearTimeout(timer);documentHistory.record(editor.value);syncHistory();}
function save(name:string,text:string,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function applyScale(){const drawing=el('drawing');drawing.style.transform=`translate(${offsetX}px,${offsetY}px) scale(${scale})`;el('zoom').textContent=`${Math.round(scale*100)}%`;}
function stopZoom(){cancelAnimationFrame(zoomFrame);zoomFrame=0;targetScale=scale;}
function fit(){stopZoom();const canvas=el('canvas');scale=Math.max(.1,Math.min(1,(canvas.clientWidth-48)/size.width,(canvas.clientHeight-48)/size.height));targetScale=scale;offsetX=(canvas.clientWidth-size.width*scale)/2;offsetY=(canvas.clientHeight-size.height*scale)/2;autoFit=true;applyScale();}
function animateZoom(){const next=Math.abs(targetScale-scale)<.0001?targetScale:scale+(targetScale-scale)*.28;const ratio=next/scale;offsetX=zoomAnchor.x-(zoomAnchor.x-offsetX)*ratio;offsetY=zoomAnchor.y-(zoomAnchor.y-offsetY)*ratio;scale=next;applyScale();zoomFrame=scale===targetScale?0:requestAnimationFrame(animateZoom);}
function zoomTo(value:number,x=el('canvas').clientWidth/2,y=el('canvas').clientHeight/2){autoFit=false;targetScale=Math.max(.1,Math.min(4,value));zoomAnchor={x,y};if(!zoomFrame)zoomFrame=requestAnimationFrame(animateZoom);}

function select(id:string,preserveFolding=false){
 const ancestors=new Set([id]);let changed=true;while(changed){changed=false;for(const edge of model.edges)if(edge.relation==='has'&&ancestors.has(edge.to)&&!ancestors.has(edge.from)){ancestors.add(edge.from);changed=true;}}
 for(const ancestor of ancestors)if(ancestor!==id&&!preserveFolding){collapsedCapabilities.delete(ancestor);collapsedBehaviors.delete(ancestor);}
 selectedId=id;el('inspector').hidden=false;el('check-panel').hidden=true;inspect();draw(false);}
function traversalScope():TraversalOptions{
 const types:Record<string,Relation[]>={all:['has','realizedBy','implementedBy','verifiedBy','appliesTo','affects','evidencedBy','uses','provides','consumes',...connectionTypes],design:['has','realizedBy','implementedBy','verifiedBy','uses','provides','consumes'],architecture:[...connectionTypes],contract:['uses','provides','consumes','verifiedBy'],policy:['appliesTo','affects']};
 return {depth:Math.max(0,Math.min(20,Math.floor(Number(el<HTMLInputElement>('scope-depth').value)||0))),direction:el<HTMLSelectElement>('scope-direction').value as 'forward'|'reverse'|'both',relationTypes:types[el<HTMLSelectElement>('scope-types').value]};
}
function inspect(){
 const entity=model.entities.find(e=>e.id===selectedId);if(!entity){el('inspector').hidden=true;return;}
 el('detail-kind').textContent=entity.kind;el('detail-title').textContent=entity.name;
 const fields=Object.entries(entity.data).filter(([key])=>fieldLabels[key]&&key!=='name');
 const edges=model.edges.filter(e=>e.from===entity.id||e.to===entity.id);
 el('detail').innerHTML=`<div class="creation-actions"><button class="primary" data-edit-form="${escape(entity.id)}">編集</button><button data-link-node="${escape(entity.id)}">つなぐ</button><button data-review-target="${escape(entity.id)}">観点レビュー</button>${['scenario','quality','policy','contract','behavior','component','realization'].includes(entity.kind)?`<button data-assign-verification="${escape(entity.id)}">検証を割り当てる</button>`:''}<button class="delete-entity" data-delete-entity="${escape(entity.id)}" title="この要素を削除。元に戻すで復元できます">削除</button></div><p class="detail-hint">内容の変更は「編集」、関連付けは「つなぐ」から相手を選びます。子要素はマップの＋で追加できます。</p><dl>${fields.map(([key,value])=>`<dt>${escape(fieldLabel(key,entity.kind))}</dt><dd>${escape(Array.isArray(value)?value.join(' / '):typeof value==='object'?JSON.stringify(value):value)}</dd>`).join('')}</dl><h3>つながっている項目</h3><div class="connections">${edges.map(e=>{const id=e.from===entity.id?e.to:e.from;return `<button data-select="${escape(id)}"><small>${e.from===entity.id?'→':'←'} ${escape(relationLabels[e.relation]??e.relation)}</small>${escape(model.entities.find(n=>n.id===id)?.name??id)}</button>`;}).join('')||'<p>まだつながっていません。</p>'}</div>`;
}

function draw(refit=true){
 svg='';const errors=validateModel(model).filter(d=>d.severity==='error');
 el('empty-error').hidden=!errors.length;
 if(errors.length){el('drawing').replaceChildren();el('empty-error').textContent='DSLにエラーがあります。設計の確認から該当箇所を修正してください。';el<HTMLButtonElement>('svg').disabled=true;return;}
 const result=renderDesignMap(model,{collapsedCapabilityIds:[...collapsedCapabilities],collapsedBehaviorIds:[...collapsedBehaviors],language:el<HTMLSelectElement>('lane-language').value as LaneLanguage,scope:traversalScope(),selectedId,showRelations:el<HTMLInputElement>('relations').checked,expanded:el<HTMLInputElement>('expanded').checked});svg=result.svg;size=result.layout;el('drawing').innerHTML=svg;addMapControls();el<HTMLButtonElement>('svg').disabled=false;if(refit&&autoFit)fit();else applyScale();
}
function update(){
 model=parseModel(editor.value);const diagnostics=validateModel(model),errors=diagnostics.filter(d=>d.severity==='error');
 if(!model.entities.some(e=>e.id===selectedId)){selectedId='';el('inspector').hidden=true;}
 el('title').textContent=model.entities.filter(e=>e.kind==='product').map(e=>e.name).join(' / ')||'これから定義するProduct';
 el('summary').textContent=`${model.entities.filter(e=>e.kind==='capability').length} capabilities · ${model.entities.filter(e=>e.kind==='behavior').length} behaviors · ${model.entities.filter(e=>e.kind==='scenario').length} scenarios`;
 el('issue-count').textContent=String(diagnostics.length);el('checks').classList.toggle('has-errors',errors.length>0);
 el('question').textContent=errors.length?'まず構文・参照エラーを修正してください。':nextQuestion(model)?.text??'設計の基本項目は揃っています。検証結果と証跡を確認できます。';
 el('diagnostics').innerHTML=diagnostics.length?diagnostics.map(d=>`<div class="diagnostic ${d.severity}"><strong>${escape(d.code)}</strong><p>${escape(d.message)}</p><small>${escape(d.path)}</small>${d.entityId&&d.code==='UNCOVERED'?`<button data-assign-verification="${escape(d.entityId)}">検証を割り当てる</button>`:''}${d.code!=='UNCOVERED'?`<button data-fix-code="${escape(d.code)}" data-fix-entity="${escape(d.entityId??'')}" data-fix-field="${escape(d.field??'')}">${d.code==='MISSING_FIELD'||d.code==='INVALID_GHERKIN'||d.code==='PUBLIC_AUTH'?'入力する':'対応する'}</button>`:''}${d.entityId?`<button data-select="${escape(d.entityId)}">要素を確認</button>`:''}</div>`).join(''):'<p>不足・孤立・参照切れは検出されませんでした。</p>';
 for(const id of ['json','markdown'])el<HTMLButtonElement>(id).disabled=!!errors.length;
 draw();if(selectedId)inspect();try{localStorage.setItem(storageKey,editor.value);}catch{el('storage').textContent='下書き保存に失敗しました。YAML保存をご利用ください。';}
}
function openEditor(){el('editor-panel').hidden=false;el('edit').setAttribute('aria-expanded','true');if(autoFit)requestAnimationFrame(fit);}
function closeEditor(){el('editor-panel').hidden=true;el('edit').setAttribute('aria-expanded','false');if(autoFit)requestAnimationFrame(fit);}
function newSource(source:string,record=true){el('merge-result').textContent='';if(record){commitEditor();documentHistory.record(source);}cancelMapLink();clearTimeout(timer);editor.value=source;selectedId='';autoFit=true;el('inspector').hidden=true;update();syncHistory();}
editor.addEventListener('input',()=>{clearTimeout(timer);syncHistory();timer=setTimeout(()=>{commitEditor();update();},400);});
function travelHistory(redo=false){commitEditor();newSource(redo?documentHistory.redo():documentHistory.undo(),false);}
el('undo').onclick=()=>travelHistory();el('redo').onclick=()=>travelHistory(true);
document.addEventListener('keydown',event=>{if(!(event.metaKey||event.ctrlKey)||event.altKey||document.querySelector('dialog[open]')||(event.target as Element).closest('input,textarea,select,[contenteditable="true"]'))return;const key=event.key.toLowerCase();if(key==='z'||key==='y'){event.preventDefault();travelHistory(key==='y'||event.shiftKey);}});
el('edit').onclick=()=>el('editor-panel').hidden?openEditor():closeEditor();el('close-editor').onclick=closeEditor;
el('close-inspector').onclick=()=>{selectedId='';el('inspector').hidden=true;draw(false);};
el('checks').onclick=()=>{el('check-panel').hidden=!el('check-panel').hidden;el('inspector').hidden=true;};el('close-checks').onclick=()=>el('check-panel').hidden=true;
el('reload-example').onclick=()=>{if(confirm('編集中の内容を最新のExampleに置き換えます。必要な内容はYAML保存してください。'))newSource(selectedExample?.source??sample);};
el('example').onclick=()=>{if(editor.value===sample||confirm('現在のモデルを設計サンプルに置き換えますか？必要な変更はYAML保存してください。'))newSource(sample);};el('bottom').onclick=()=>{if(confirm('既存システムから始めるサンプルに切り替えますか？'))newSource(bottomUp);};
el('scope-toggle').onclick=()=>{el('scope-panel').hidden=!el('scope-panel').hidden;};for(const id of ['scope-depth','scope-direction','scope-types'])el(id).onchange=()=>draw(false);
el('relations').onchange=()=>draw(false);el('expanded').onchange=()=>{autoFit=true;draw();};
el('zoom-in').onclick=()=>zoomTo((zoomFrame?targetScale:scale)*1.25);el('zoom-out').onclick=()=>zoomTo((zoomFrame?targetScale:scale)/1.25);el('fit').onclick=fit;el('actual').onclick=()=>zoomTo(1);
window.addEventListener('resize',()=>{if(autoFit)fit();});
document.addEventListener('click',e=>{if(dragged){dragged=false;return;}if((e.target as Element).closest('[data-create-kind]'))return;const target=(e.target as Element).closest<HTMLElement>('[data-node],[data-select]');if(target){const id=target.dataset.node??target.dataset.select!;if(linkingFrom)completeMapLink(id);else select(id);}});
el('canvas').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const node=(e.target as Element).closest<HTMLElement>('[data-node]');if(node){e.preventDefault();if(linkingFrom)completeMapLink(node.dataset.node!);else select(node.dataset.node!);}}});
let pan:{x:number;y:number;left:number;top:number;pointerId:number}|undefined;
el('canvas').addEventListener('pointerdown',e=>{if(e.button!==0||(e.target as Element).closest('button,.lane-help'))return;stopZoom();pan={x:e.clientX,y:e.clientY,left:offsetX,top:offsetY,pointerId:e.pointerId};dragged=false;});
window.addEventListener('pointermove',e=>{if(!pan||pan.pointerId!==e.pointerId)return;const dx=e.clientX-pan.x,dy=e.clientY-pan.y;if(dragged||Math.abs(dx)+Math.abs(dy)>4){dragged=true;autoFit=false;offsetX=pan.left+dx;offsetY=pan.top+dy;el('canvas').setPointerCapture(e.pointerId);applyScale();}});
const endPan=()=>{pan=undefined;setTimeout(()=>dragged=false,0);};window.addEventListener('pointerup',endPan);window.addEventListener('pointercancel',endPan);
el('canvas').addEventListener('wheel',e=>{e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?el('canvas').clientHeight:1;if(e.ctrlKey||e.metaKey){const rect=el('canvas').getBoundingClientRect();zoomTo((zoomFrame?targetScale:scale)*Math.exp(-e.deltaY*unit*.008),e.clientX-rect.left,e.clientY-rect.top);}else{stopZoom();autoFit=false;offsetX-=e.deltaX*unit;offsetY-=e.deltaY*unit;applyScale();}},{passive:false});

el('save').onclick=()=>save('design.archmodel.yaml',editor.value,'text/yaml');el('svg').onclick=()=>{clearTimeout(timer);update();if(svg)save('design-map.svg',svg,'image/svg+xml');};
el('json').onclick=()=>{clearTimeout(timer);update();if(!validateModel(model).some(d=>d.severity==='error'))save('design.json',JSON.stringify(model,null,2),'application/json');};el('markdown').onclick=()=>{clearTimeout(timer);update();if(!validateModel(model).some(d=>d.severity==='error'))save('design.md',toMarkdown(model),'text/markdown');};
el('load').onclick=()=>el<HTMLInputElement>('file').click();el('file').onchange=async()=>{const file=el<HTMLInputElement>('file').files?.[0];if(file)newSource(await file.text());};
el('guide-content').innerHTML=guideMarkup();mountGuide(el('reference'));el('help').onclick=()=>el<HTMLDialogElement>('reference').showModal();el('open-guide').onclick=()=>el<HTMLDialogElement>('reference').showModal();el('close-help').onclick=()=>el<HTMLDialogElement>('reference').close();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){cancelMapLink();closeEditor();el('check-panel').hidden=true;el('inspector').hidden=true;selectedId='';draw(false);}});update();

const reviewUI=installReviews({source:()=>editor.value,model:()=>parseModel(editor.value),replace:newSource});
el('open-reviews').onclick=()=>reviewUI.open(selectedId||undefined);
document.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLElement>('[data-review-target]');if(button)reviewUI.open(button.dataset.reviewTarget);});
const authoring=installAuthoring({source:()=>editor.value,model:()=>parseModel(editor.value),replace:newSource,select:(id)=>{const preserve=qualitySummaryEditingId===id;qualitySummaryEditingId='';select(id,preserve);},save,beginLink});
function assignVerification(id:string){
 const entity=model.entities.find(e=>e.id===id);if(!entity)return;
 const dialog=document.createElement('dialog');dialog.className='verification-dialog';
 const linked=new Set(model.edges.filter(e=>e.from===id&&e.relation==='verifiedBy').map(e=>e.to));
 const candidates=model.entities.filter(e=>e.kind==='verification');
 dialog.innerHTML=`<div class="panel-head"><h2>検証を割り当てる</h2><button type="button" data-close aria-label="閉じる">×</button></div><p>「${escape(entity.name)}」を何で確認するか選びます。</p><p class="detail-hint">割り当ては確認方法の定義です。検証結果の合否とは別に管理します。</p><div class="verification-options">${candidates.map(e=>`<button type="button" data-verification-id="${escape(e.id)}" ${linked.has(e.id)?'disabled':''}><strong>${escape(e.name)}</strong><small>${escape(e.data.method??'検証方法が未入力です')}</small>${linked.has(e.id)?'<span>割り当て済み</span>':''}</button>`).join('')||'<p>検証がまだありません。下のボタンから作成できます。</p>'}</div><p class="form-error" role="alert"></p><div class="form-actions"><button type="button" data-new-verification class="primary">検証を新規作成して割り当てる</button></div>`;
 dialog.querySelector('[data-close]')!.addEventListener('click',()=>dialog.close());
 dialog.querySelector('[data-new-verification]')!.addEventListener('click',()=>{dialog.close();authoring.open('verification',{link:{from:id,field:'verified_by'}});});
 dialog.querySelectorAll<HTMLButtonElement>('[data-verification-id]').forEach(button=>button.onclick=()=>{
  try{const source=linkEntities(editor.value,id,'verified_by',button.dataset.verificationId!);dialog.close();newSource(source);select(id,true);}catch(error){dialog.querySelector('.form-error')!.textContent=String(error);}
 });
 dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
}
document.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLElement>('[data-assign-verification]');if(button)assignVerification(button.dataset.assignVerification!);});
function chooseRelation(id:string,field:string,reverse:boolean,kinds:Kind[]){
 const entity=model.entities.find(e=>e.id===id);if(!entity)return;
 const options=reverse?model.entities.filter(e=>!kinds.length||kinds.includes(e.kind)).flatMap(e=>availableLinks(model,e.id).filter(l=>l.target.id===id&&l.field===field).map(()=>({id:e.id,name:e.name}))):availableLinks(model,id).filter(l=>l.field===field&&(!kinds.length||kinds.includes(l.target.kind))).map(l=>({id:l.target.id,name:l.target.name}));
 const dialog=document.createElement('dialog');dialog.className='verification-dialog';
 dialog.innerHTML=`<div class="panel-head"><h2>関連付ける要素を選ぶ</h2><button data-close>×</button></div><p>${escape(entity.name)}</p><div class="verification-options">${options.map(o=>`<button data-pick="${escape(o.id)}">${escape(o.name)}</button>`).join('')||'<p>関連付けできる既存の要素がありません。</p>'}</div><p class="form-error"></p><div class="form-actions">${kinds.map(k=>`<button data-new-kind="${k}">${escape(laneLabel(k, 'ja'))}を新規作成して紐付ける</button>`).join('')}</div>`;
 dialog.querySelector('[data-close]')!.addEventListener('click',()=>dialog.close());
 dialog.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(button=>button.onclick=()=>{try{const target=button.dataset.pick!;const source=linkEntities(editor.value,reverse?target:id,field,reverse?id:target);dialog.close();newSource(source);select(id);}catch(error){dialog.querySelector('.form-error')!.textContent=String(error);}});
 dialog.querySelectorAll<HTMLButtonElement>('[data-new-kind]').forEach(button=>button.onclick=()=>{dialog.close();authoring.open(button.dataset.newKind as Kind,{link:{field,...(reverse?{to:id}:{from:id})}});});
 dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
}
document.addEventListener('click',event=>{
 const button=(event.target as Element).closest<HTMLElement>('[data-fix-code]');if(!button)return;
 const code=button.dataset.fixCode!,id=button.dataset.fixEntity!,field=button.dataset.fixField!;const entity=model.entities.find(e=>e.id===id);
 if(code.startsWith('REVIEW_')){reviewUI.open(id,field);return;}
 if(code==='NO_PRODUCT'){authoring.open('product');return;}if(!entity){openEditor();return;}
 const connect=(key:string,reverse:boolean,kinds:Kind[])=>chooseRelation(id,key,reverse,kinds);
 if(code==='NO_CAPABILITY')return connect('has',false,['capability']);
 if(code==='NO_SCENARIO')return connect('has',false,['scenario']);
 if(code==='MISSING_FIELD'&&field==='behaviors')return connect('has',false,['behavior']);
 if(code==='NO_PARENT')return connect('has',true,[entity.kind==='capability'?'product':entity.kind==='scenario'?'behavior':'capability']);
 if(code==='NO_REALIZATION')return connect('realized_by',false,['component']);
 if(code==='NO_IMPLEMENTATION')return connect('implemented_by',false,['realization']);
 if(code==='ORPHAN_REALIZATION')return connect('implemented_by',true,['component']);
 if(code==='ORPHAN_COMPONENT')return connect('realized_by',true,['behavior','quality','policy']);
 if(code==='UNBOUND_DECISION')return connect('affects',false,[]);
 if(code==='NO_POLICY_TARGET')return connect('applies_to',false,[]);
 if(code==='NO_EVIDENCE')return connect('evidenced_by',false,['evidence']);
 if(['MISSING_FIELD','INVALID_GHERKIN','PUBLIC_AUTH'].includes(code)){
  authoring.open(entity.kind,{id});const key=code==='INVALID_GHERKIN'?'specification':code==='PUBLIC_AUTH'?'authentication':field;
  const input=document.querySelector<HTMLElement>(`#entity-fields [data-field="${CSS.escape(key)}"]`);const details=input?.closest('details');if(details)details.open=true;input?.focus();input?.scrollIntoView({block:'center'});return;
 }
 select(id);if(['UNKNOWN_REFERENCE','RELATION_TYPE'].includes(code))openEditor();
});
document.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLElement>('[data-delete-entity]');if(!button)return;try{newSource(deleteEntity(editor.value,button.dataset.deleteEntity!));el('merge-result').textContent='要素と関連を削除しました。子要素は保持しています。元に戻すで復元できます。';}catch(error){alert(String(error));}});
el('new-model').onclick=authoring.start;el('add-element').onclick=authoring.add;


function addMapControls(){
 const ns='http://www.w3.org/2000/svg';
 const addHost=(node:SVGGElement)=>{const width=Number(node.querySelector('rect')!.getAttribute('width'));const foreign=document.createElementNS(ns,'foreignObject');foreign.setAttribute('x',String(width-32));foreign.setAttribute('y','4');foreign.setAttribute('width','28');foreign.setAttribute('height','28');return foreign;};
 const plusIcon='<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2v10M2 7h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

 el('drawing').querySelectorAll<SVGGElement>('[data-role="quality-summary"]').forEach(node=>{
  const open=()=>{qualitySummaryEditingId=node.dataset.node!;authoring.open('quality',{id:qualitySummaryEditingId});};
  node.setAttribute('aria-label',(node.querySelector('title')?.textContent??'品質要求')+'を編集');
  node.addEventListener('click',event=>{if(linkingFrom||dragged)return;event.stopPropagation();open();});
  node.addEventListener('keydown',event=>{if(!linkingFrom&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();open();}});
 });
 el('drawing').querySelectorAll<SVGGElement>('[data-help-key]').forEach(node=>{
  const key=node.dataset.helpKey!;const titles=node.querySelectorAll<SVGTextElement>(':scope > text');const title=titles[titles.length-1];if(!title)return;
  const help=document.createElementNS(ns,'tspan');help.classList.add('lane-help');help.setAttribute('dx','6');help.setAttribute('font-size','12');help.setAttribute('font-weight','400');help.setAttribute('role','button');help.setAttribute('tabindex','0');help.textContent='?';
  const description=laneCopy[key]?.[2]??'このカテゴリに属する項目を表示します。';help.setAttribute('aria-label',laneLabel(key,el<HTMLSelectElement>('lane-language').value as LaneLanguage)+'：'+description);
  const tooltip=document.createElementNS(ns,'title');tooltip.textContent=description;help.append(tooltip);help.addEventListener('click',e=>e.stopPropagation());help.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();}});title.append(help);
 });
 const actions=[['product'],['capability'],['quality'],['policy'],['decision'],['component'],['realization']];
 el('drawing').querySelectorAll<SVGGElement>('[data-role="lane"]').forEach((lane,i)=>{
  if(i>=2&&lane.dataset.collapsed!=='true')return;
  for(const kind of actions[i]){
   const foreign=addHost(lane);
   const button=document.createElement('button');button.className='map-add';button.dataset.createKind=kind;button.innerHTML=plusIcon;button.title=kind+'を追加';button.setAttribute('aria-label',kind+'を追加');foreign.append(button);lane.append(foreign);
  }
 });
 el('drawing').querySelectorAll<SVGGElement>('[data-role="capability"][data-node],[data-role="behavior"][data-node]').forEach(node=>{
  const id=node.dataset.node!;const role=node.dataset.role!;const state=role==='behavior'?collapsedBehaviors:collapsedCapabilities;const label=role==='behavior'?'Behavior':'Capability';const closed=state.has(id);const host=addHost(node);host.setAttribute('x','6');host.setAttribute('y','8');
  const button=document.createElement('button');button.className='map-fold';button.innerHTML=closed?'▸':'▾';button.title=closed?`${label}を開く`:`${label}を1行に閉じる`;button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded',String(!closed));
  button.addEventListener('keydown',event=>event.stopPropagation());
  button.onclick=event=>{event.stopPropagation();const before=node.getBoundingClientRect().top;if(closed)state.delete(id);else state.add(id);draw(false);const after=el('drawing').querySelector(`[data-role="${role}"][data-node="${CSS.escape(id)}"]`)!.getBoundingClientRect().top;offsetY+=before-after;applyScale();};host.append(button);node.append(host);
 });
 el('drawing').querySelectorAll<SVGGElement>('[data-item-kind]').forEach(node=>{
  const host=addHost(node);const button=document.createElement('button');button.className='map-add';button.innerHTML=plusIcon;button.dataset.createKind=node.dataset.itemKind;button.dataset.itemType=node.dataset.itemType??'';button.title=laneLabel(node.dataset.helpKey!,el<HTMLSelectElement>('lane-language').value as LaneLanguage)+'を追加';button.setAttribute('aria-label',button.title);host.append(button);node.append(host);
 });
 el('drawing').querySelectorAll<SVGGElement>('[data-role="quality-category"]').forEach(node=>{
  const attribute=node.dataset.qualityAttribute!;if(attribute==='unspecified')return;
  const foreign=addHost(node);
  const button=document.createElement('button');button.className='map-add';button.innerHTML=plusIcon;button.dataset.createKind='quality';button.dataset.qualityAttribute=attribute;
  if(node.dataset.capability){button.dataset.linkField='has';button.dataset.linkFrom=node.dataset.capability;}
  button.title=`${attribute}の品質要求を追加`;button.setAttribute('aria-label',button.title);foreign.append(button);node.append(foreign);
 });
 el('drawing').querySelectorAll<SVGGElement>('[data-role="decision-category"]').forEach(node=>{
  const foreign=addHost(node);
  const button=document.createElement('button');button.className='map-add';button.innerHTML=plusIcon;button.dataset.createKind='decision';button.dataset.decisionCategory=node.dataset.decisionCategory;button.title='設計判断を追加';button.setAttribute('aria-label',button.title);foreign.append(button);node.append(foreign);
 });
 el('drawing').querySelectorAll<SVGGElement>('[data-role="policy-category"]').forEach(node=>{
  const foreign=addHost(node);
  const button=document.createElement('button');button.className='map-add';button.innerHTML=plusIcon;button.dataset.createKind='policy';button.dataset.policyCategory=node.dataset.policyCategory;button.title='ポリシーを追加';button.setAttribute('aria-label',button.title);foreign.append(button);node.append(foreign);
 });
 el('drawing').querySelectorAll<SVGGElement>('[data-node],[data-role="empty-behavior"]').forEach(node=>{
  const role=node.getAttribute('data-role');const id=node.getAttribute('data-node')??'';
  const child=(role==='behavior'||role==='empty-scenario')?'scenario':(role==='capability'||role==='empty-behavior')?'behavior':role==='product'?'capability':role==='component'?'realization':null;
  if(!child)return;
  if((role==='behavior'&&el('drawing').querySelector(`[data-role="empty-scenario"][data-node="${CSS.escape(id)}"]`))||(role==='capability'&&el('drawing').querySelector(`[data-role="empty-behavior"][data-node="${CSS.escape(id)}"]`)))return;
  const foreign=addHost(node);
  const button=document.createElement('button');button.className='map-add child-add';button.dataset.createKind=child;if(id){button.dataset.linkField=role==='component'?'implemented_by':'has';button.dataset.linkFrom=id;}button.innerHTML=plusIcon;button.title=`${child}を追加`;button.setAttribute('aria-label',`${model.entities.find(e=>e.id===id)?.name}に${child}を追加`);foreign.append(button);node.append(foreign);
 });
}

function cancelMapLink(){linkingFrom='';el('link-prompt').hidden=true;el('drawing').querySelectorAll('.link-candidate').forEach(n=>n.classList.remove('link-candidate'));}
function candidateLinks(id:string){return [...availableLinks(model,linkingFrom).filter(l=>l.target.id===id).map(l=>({...l,from:linkingFrom,to:id})),...availableLinks(model,id).filter(l=>l.target.id===linkingFrom).map(l=>({...l,from:id,to:linkingFrom}))];}
function beginLink(id:string){linkingFrom=id;el('inspector').hidden=true;el('link-prompt').hidden=false;el('link-prompt').querySelector('span')!.textContent=`「${model.entities.find(e=>e.id===id)?.name}」とつなぐ相手をマップで選んでください。`;
 for(const e of model.entities)if(e.id!==id&&candidateLinks(e.id).length)el('drawing').querySelectorAll('[data-node]').forEach(n=>{if(n.getAttribute('data-node')===e.id)n.classList.add('link-candidate');});
}
function completeMapLink(id:string){
 const choices=candidateLinks(id);
 if(!choices.length){el('link-prompt').querySelector('span')!.textContent='この項目にはつなげられません。枠が強調された相手を選んでください。';return;}
 const apply=(choice:typeof choices[number])=>{try{const result=linkEntities(editor.value,choice.from,choice.field,choice.to);cancelMapLink();newSource(result);select(id);}catch(error){el('link-prompt').querySelector('span')!.textContent=String(error);}};
 if(choices.length===1){apply(choices[0]);return;}
 const dialog=document.createElement('dialog');dialog.className='relation-choice';dialog.innerHTML='<h2>どのようにつなぎますか？</h2>';
 for(const c of choices){const button=document.createElement('button');button.textContent=`${model.entities.find(e=>e.id===c.from)?.name} → ${model.entities.find(e=>e.id===c.to)?.name}：${relationLabels[c.relation]??c.relation}`;button.onclick=()=>{apply(c);dialog.close();};dialog.append(button);}
 const cancel=document.createElement('button');cancel.textContent='キャンセル';cancel.onclick=()=>dialog.close();dialog.append(cancel);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
}
el('cancel-map-link').onclick=cancelMapLink;
el('list-map-links').onclick=()=>{
 const dialog=document.createElement('dialog');dialog.className='verification-dialog';dialog.innerHTML='<div class="panel-head"><h2>つなぐ相手を選ぶ</h2><button data-close>×</button></div><div class="verification-options"></div>';
 const list=dialog.querySelector('.verification-options')!;
 for(const entity of model.entities)if(entity.id!==linkingFrom&&candidateLinks(entity.id).length){const button=document.createElement('button');button.textContent=entity.name;button.onclick=()=>{dialog.close();completeMapLink(entity.id);};list.append(button);}
 if(!list.children.length)list.textContent='関連付けできる要素がありません。先にマップの＋から要素を追加してください。';
 dialog.querySelector('[data-close]')!.addEventListener('click',()=>dialog.close());dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
};

el('lane-language').onchange=()=>{try{localStorage.setItem('archmodel:lane-language',el<HTMLSelectElement>('lane-language').value);}catch{}draw(false);};

openEditor();
