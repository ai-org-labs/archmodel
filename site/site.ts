import {entityDetail,reviewDetail} from './map-details.js';
import {installMapGestures} from './map-gestures.js';
import {installMapEditors} from './map-editors.js';
import {installReviews} from './reviews.js';
import {examples,navigation,siteBase} from './content.js';
import {guideMarkup,mountGuide} from './guide.js';
import './playground.css';
import {laneLabel} from '@archmodel/core';
import {relationLabels} from '@archmodel/core';
import {DocumentHistory} from './history.js';
import {installAuthoring} from './authoring.js';
import './site.css';
import sample from '../syntax/examples/design-map.archmodel.yaml?raw';
import bottomUp from '../syntax/examples/bottom-up.archmodel.yaml?raw';
import {deleteEntity,parseModel,validateModel,planNextQuestions,designCoverage,reviewRows,renderStructuredMap,toMarkdown,availableLinks,linkEntities,EMPTY_MODEL} from '@archmodel/core';
import type {Model,Kind} from '@archmodel/core';
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
document.body.innerHTML=`<header><div class="brand"><span class="brand-mark">A</span><strong>ArchModel</strong><span class="divider"></span><span class="workspace-name">Design map</span></div><nav><button id="new-model">新規作成</button><button id="add-element">＋ 要素</button><button id="load">開く</button><input type="file" id="file" accept=".yaml,.yml,.json" hidden><button id="save">YAML保存</button><button id="svg">SVG保存</button><button id="edit" class="primary" aria-expanded="false">〈 〉 DSLを編集</button></nav></header>
<div class="map-toolbar"><div><h1 id="title">Customer Platform</h1><span id="summary" role="status"></span></div><div class="map-actions"><select id="lane-language" aria-label="レーンの表示言語"><option value="en">English</option><option value="ja">日本語</option></select><button id="scope-toggle">関連範囲</button><button id="checks" aria-label="設計の確認" title="設計の確認">設計の確認 <span id="issue-count">0</span></button><button id="help" aria-label="構文リファレンス">?</button></div></div>
<div id="scope-panel" hidden><label>深さ <input id="scope-depth" type="number" min="0" max="20" value="3"></label><label>方向 <select id="scope-direction"><option value="forward">順方向</option><option value="reverse">逆方向</option><option value="both">双方向</option></select></label><label>関連種別 <select id="scope-types"><option value="design">設計・実装・検証</option><option value="all">全ての意味付き関連</option><option value="architecture">システム接続</option><option value="contract">Contract</option><option value="policy">Policy / Decision</option></select></label></div><main><div id="link-prompt" hidden role="status"><span></span><button id="list-map-links">一覧から選ぶ</button><button id="cancel-map-link">キャンセル</button></div><section id="canvas" tabindex="0" aria-label="設計マップ。1本指で移動、2本指でピンチズーム、要素を選択して詳細を確認"><div id="drawing"></div></section><div class="map-legend"><span class="legend-neutral">囲み：所属と要求</span><span class="legend-accent">選択：関連を強調</span></div><div class="zoom-controls"><button id="zoom-out" aria-label="縮小">−</button><output id="zoom">100%</output><button id="zoom-in" aria-label="拡大">＋</button><button id="fit">全体表示</button><button id="actual">100%</button></div><div id="empty-error" hidden></div></main>
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
el('lane-language').remove();el('scope-toggle').remove();el('scope-panel').remove();
workspaceTools.append(el('checks'),el('edit'));
headerMenu('ファイル',['new-model','add-element','load','file','save','svg','help'],'file-menu');
workspaceTools.querySelector('#edit')!.textContent='〈 〉 DSL';
workspaceHeader.replaceChildren(workspaceIdentity,workspaceTools);
document.querySelector('.file-menu .header-menu-body')!.insertAdjacentHTML('beforeend','<button id="edit-map-document">文書・観点定義</button><button id="add-map-connection">実接続を追加</button>');
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
const editor=el<HTMLTextAreaElement>('source');let model:Model=parseModel(EMPTY_MODEL);let selectedId='';let svg='';let size={width:2200,height:1200};let scale=1;let autoFit=true;let offsetX=24,offsetY=24,targetScale=1,zoomFrame=0;let zoomAnchor={x:0,y:0};let timer:ReturnType<typeof setTimeout>;
const expandedMapIds=new Set<string>();
const reviewMapTargets=new Set<string>();
let documentExpanded=false;
let mapFocusId='';
let mapPerspective='';
const mapContext=document.createElement('div');mapContext.id='map-context';document.querySelector('main')!.before(mapContext);
let linkingFrom='';
const collapsedCapabilities=new Set<string>();
const collapsedBehaviors=new Set<string>();
const storageKey=selectedExample?`archmodel:playground:${selectedExample.id}:v0.1`:'archmodel:canonical:v0.1';
try{editor.value=localStorage.getItem(storageKey)??selectedExample?.source??sample;}catch{editor.value=selectedExample?.source??sample;el('storage').textContent='下書きを保存できません。YAML保存をご利用ください。';}
const documentHistory=new DocumentHistory(editor.value);
function syncHistory(){el<HTMLButtonElement>('undo').disabled=!documentHistory.canUndo&&editor.value===documentHistory.current;el<HTMLButtonElement>('redo').disabled=!documentHistory.canRedo||editor.value!==documentHistory.current;}
function commitEditor(){clearTimeout(timer);documentHistory.record(editor.value);syncHistory();}
function save(name:string,text:string,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function applyScale(){const drawing=el('drawing');drawing.style.transform=`translate(${offsetX}px,${offsetY}px) scale(${scale})`;el('zoom').textContent=`${Math.round(scale*100)}%`;}
function stopZoom(){cancelAnimationFrame(zoomFrame);zoomFrame=0;targetScale=scale;}
function fit(){stopZoom();const canvas=el('canvas');scale=Math.max(.1,Math.min(1,(canvas.clientWidth-48)/size.width,(canvas.clientHeight-48)/size.height));targetScale=scale;offsetX=(canvas.clientWidth-size.width*scale)/2;offsetY=(canvas.clientHeight-size.height*scale)/2;autoFit=true;applyScale();}
function readableFit(){stopZoom();const canvas=el('canvas');scale=canvas.clientWidth<640?.85:Math.max(.8,Math.min(1,(canvas.clientWidth-48)/size.width));targetScale=scale;offsetX=24;offsetY=24;applyScale();}
function revealNode(id:string){const node=el('drawing').querySelector<SVGGElement>(`[data-node="${CSS.escape(id)}"]`);if(!node)return;stopZoom();const box=node.getBBox();scale=1;targetScale=1;offsetX=24-box.x;offsetY=24-box.y;autoFit=false;applyScale();}
function animateZoom(){const next=Math.abs(targetScale-scale)<.0001?targetScale:scale+(targetScale-scale)*.28;const ratio=next/scale;offsetX=zoomAnchor.x-(zoomAnchor.x-offsetX)*ratio;offsetY=zoomAnchor.y-(zoomAnchor.y-offsetY)*ratio;scale=next;applyScale();zoomFrame=scale===targetScale?0:requestAnimationFrame(animateZoom);}
function zoomTo(value:number,x=el('canvas').clientWidth/2,y=el('canvas').clientHeight/2){autoFit=false;targetScale=Math.max(.1,Math.min(4,value));zoomAnchor={x,y};if(!zoomFrame)zoomFrame=requestAnimationFrame(animateZoom);}

function select(id:string,preserveFolding=false){
 const ancestors=new Set([id]);let changed=true;while(changed){changed=false;for(const edge of model.edges)if(edge.relation==='has'&&ancestors.has(edge.to)&&!ancestors.has(edge.from)){ancestors.add(edge.from);changed=true;}}
 for(const ancestor of ancestors)if(ancestor!==id&&!preserveFolding){collapsedCapabilities.delete(ancestor);collapsedBehaviors.delete(ancestor);}
 selectedId=id;el('inspector').hidden=false;el('check-panel').hidden=true;inspect();draw(false);}
function inspect(){
 const entity=model.entities.find(e=>e.id===selectedId);if(!entity){el('inspector').hidden=true;return;}
 el('detail-kind').textContent=entity.kind;el('detail-title').textContent=entity.name;
 el('detail').innerHTML=entityDetail(model,entity.id);
}

function draw(refit=true){
 svg='';const errors=validateModel(model).filter(d=>d.severity==='error');
 el('empty-error').hidden=!errors.length;
 if(errors.length){el('drawing').replaceChildren();el('empty-error').textContent='DSLにエラーがあります。設計の確認から該当箇所を修正してください。';el<HTMLButtonElement>('svg').disabled=true;return;}
 if(mapFocusId&&!model.entities.some(e=>e.id===mapFocusId)){mapFocusId='';mapPerspective='';}
 if(mapFocusId&&mapPerspective&&!reviewRows(model,mapFocusId).some(r=>r.perspective.id===mapPerspective))mapPerspective='';

 mapContext.innerHTML=`<label>対象 <select id="map-jump"><option value="">名前で移動</option>${model.entities.map(e=>`<option value="${escape(e.id)}">${escape(e.name)} / ${e.kind}</option>`).join('')}</select></label>${mapFocusId?'<button id="clear-map-focus">全体へ戻る</button>':''}`;
 el<HTMLSelectElement>('map-jump').onchange=()=>{const id=el<HTMLSelectElement>('map-jump').value;if(!id)return;if(!el('drawing').querySelector(`[data-node="${CSS.escape(id)}"]`)){mapFocusId='';mapPerspective='';draw(false);}select(id);revealNode(id);};
 const clear=el('clear-map-focus');if(clear)clear.onclick=()=>{mapFocusId='';mapPerspective='';autoFit=true;draw();};
 const result=renderStructuredMap(model,{selectedId});svg=result.svg;size=result.layout;el('drawing').innerHTML=svg;el<HTMLButtonElement>('svg').disabled=false;if(refit&&autoFit)readableFit();else applyScale();

}
function update(){
 model=parseModel(editor.value);const diagnostics=validateModel(model),errors=diagnostics.filter(d=>d.severity==='error');
 if(!model.entities.some(e=>e.id===selectedId)){selectedId='';el('inspector').hidden=true;}
 el('title').textContent=model.entities.filter(e=>e.kind==='product').map(e=>e.name).join(' / ')||'これから定義するProduct';
 el('summary').textContent=`${model.entities.filter(e=>e.kind==='capability').length} capabilities · ${model.entities.filter(e=>e.kind==='behavior').length} behaviors · ${model.entities.filter(e=>e.kind==='scenario').length} scenarios`;
 el('issue-count').textContent=String(diagnostics.length);el('checks').classList.toggle('has-errors',errors.length>0);
 el('question').textContent=errors.length?'まず構文・参照エラーを修正してください。':planNextQuestions(model).primary?.message??'今のフェーズで提示する質問はありません。未結論・保留と検証結果を設計観点で確認してください。';
 el('diagnostics').innerHTML=diagnostics.length?diagnostics.map(d=>`<div class="diagnostic ${d.severity}"><strong>${escape(d.code)}</strong><p>${escape(d.message)}</p><small>${escape(d.path)}</small></div>`).join(''):'<p>構造上の不足は検出されませんでした。観点の結論や検証完了を保証するものではありません。</p>';
 for(const id of ['json','markdown'])el<HTMLButtonElement>(id).disabled=!!errors.length;
 draw();if(selectedId)inspect();try{localStorage.setItem(storageKey,editor.value);}catch{el('storage').textContent='下書き保存に失敗しました。YAML保存をご利用ください。';}
}
function openEditor(){el('editor-panel').hidden=false;el('edit').setAttribute('aria-expanded','true');if(autoFit)requestAnimationFrame(fit);}
function closeEditor(){el('editor-panel').hidden=true;el('edit').setAttribute('aria-expanded','false');if(autoFit)requestAnimationFrame(fit);}
function newSource(source:string,record=true){el('merge-result').textContent='';if(record){commitEditor();documentHistory.record(source);}cancelMapLink();clearTimeout(timer);editor.value=source;autoFit=true;el('inspector').hidden=true;update();syncHistory();}
editor.addEventListener('input',()=>{clearTimeout(timer);syncHistory();timer=setTimeout(()=>{commitEditor();update();},400);});
function travelHistory(redo=false){commitEditor();newSource(redo?documentHistory.redo():documentHistory.undo(),false);}
el('undo').onclick=()=>travelHistory();el('redo').onclick=()=>travelHistory(true);
document.addEventListener('keydown',event=>{if(!(event.metaKey||event.ctrlKey)||event.altKey||document.querySelector('dialog[open]')||(event.target as Element).closest('input,textarea,select,[contenteditable="true"]'))return;const key=event.key.toLowerCase();if(key==='z'||key==='y'){event.preventDefault();travelHistory(key==='y'||event.shiftKey);}});
el('edit').onclick=()=>el('editor-panel').hidden?openEditor():closeEditor();el('close-editor').onclick=closeEditor;
el('close-inspector').onclick=()=>{el('inspector').hidden=true;selectedId='';draw(false);};
el('checks').onclick=()=>{el('check-panel').hidden=!el('check-panel').hidden;el('inspector').hidden=true;};el('close-checks').onclick=()=>el('check-panel').hidden=true;
el('reload-example').onclick=()=>{if(confirm('編集中の内容を最新のExampleに置き換えます。必要な内容はYAML保存してください。'))newSource(selectedExample?.source??sample);};
el('example').onclick=()=>{if(editor.value===sample||confirm('現在のモデルを設計サンプルに置き換えますか？必要な変更はYAML保存してください。'))newSource(sample);};el('bottom').onclick=()=>{if(confirm('既存システムから始めるサンプルに切り替えますか？'))newSource(bottomUp);};
el('zoom-in').onclick=()=>zoomTo((zoomFrame?targetScale:scale)*1.25);el('zoom-out').onclick=()=>zoomTo((zoomFrame?targetScale:scale)/1.25);el('fit').onclick=fit;el('actual').onclick=()=>zoomTo(1);
window.addEventListener('resize',()=>{if(autoFit)readableFit();});
document.addEventListener('click',e=>{if((e.target as Element).closest('[data-create-kind]'))return;const target=(e.target as Element).closest<HTMLElement>('[data-node],[data-select]');if(target){const id=target.dataset.node??target.dataset.select!;if(linkingFrom)completeMapLink(id);else select(id);}else if((e.target as Element).closest('#canvas')&&!(e.target as Element).closest('[data-review-read],[data-map-edge],[data-map-review-target]')){selectedId='';el('inspector').hidden=true;draw(false);}});
el('canvas').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const node=(e.target as Element).closest<HTMLElement>('[data-node],[data-select]');if(node){e.preventDefault();const id=node.dataset.node??node.dataset.select!;if(linkingFrom)completeMapLink(id);else select(id);}}});
installMapGestures(el('canvas'),{get:()=>({scale,x:offsetX,y:offsetY}),begin:stopZoom,set:value=>{autoFit=false;scale=value.scale;targetScale=scale;offsetX=value.x;offsetY=value.y;applyScale();}});
el('canvas').addEventListener('wheel',e=>{e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?el('canvas').clientHeight:1;if(e.ctrlKey||e.metaKey){const rect=el('canvas').getBoundingClientRect();zoomTo((zoomFrame?targetScale:scale)*Math.exp(-e.deltaY*unit*.008),e.clientX-rect.left,e.clientY-rect.top);}else{stopZoom();autoFit=false;offsetX-=e.deltaX*unit;offsetY-=e.deltaY*unit;applyScale();}},{passive:false});

el('save').onclick=()=>save('design.archmodel.yaml',editor.value,'text/yaml');el('svg').onclick=()=>{clearTimeout(timer);update();if(svg)save('design-map.svg',svg,'image/svg+xml');};
el('json').onclick=()=>{clearTimeout(timer);update();if(!validateModel(model).some(d=>d.severity==='error'))save('design.json',JSON.stringify(model,null,2),'application/json');};el('markdown').onclick=()=>{clearTimeout(timer);update();if(!validateModel(model).some(d=>d.severity==='error'))save('design.md',toMarkdown(model),'text/markdown');};
el('load').onclick=()=>el<HTMLInputElement>('file').click();el('file').onchange=async()=>{const file=el<HTMLInputElement>('file').files?.[0];if(file)newSource(await file.text());};
el('guide-content').innerHTML=guideMarkup();mountGuide(el('reference'));el('help').onclick=()=>el<HTMLDialogElement>('reference').showModal();el('open-guide').onclick=()=>el<HTMLDialogElement>('reference').showModal();el('close-help').onclick=()=>el<HTMLDialogElement>('reference').close();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){cancelMapLink();closeEditor();el('check-panel').hidden=true;el('inspector').hidden=true;selectedId='';draw(false);}});update();

const reviewUI=installReviews({source:()=>editor.value,model:()=>parseModel(editor.value),replace:newSource});
const mapEditors=installMapEditors({source:()=>editor.value,model:()=>model,replace:newSource,link:beginLink});
function mapAction(event:Event){
 const button=(event.target as Element).closest<HTMLElement>('[data-shared-row],[data-review-read],[data-map-reveal],[data-map-add],[data-map-perspective],[data-map-focus],[data-map-expand],[data-map-reviews],[data-map-edit],[data-map-review-target],[data-map-edge],[data-map-document-toggle],[data-map-document-edit],#expand-scope-reviews,#edit-map-document,#add-map-connection');if(!button)return;
 if(event instanceof KeyboardEvent&&!['Enter',' '].includes(event.key))return;
 event.preventDefault();event.stopPropagation();
 const d=button.dataset;
 if(d.sharedRow){const group=el('drawing').querySelector<SVGGElement>(`[data-shared-row-target="${CSS.escape(d.sharedRow)}"]`);if(group){const box=group.getBBox();stopZoom();offsetY=32-box.y*scale;autoFit=false;applyScale();}}
 else if(d.reviewRead){selectedId=d.reviewRead;draw(false);const content=reviewDetail(model,d.reviewRead,d.reviewGroup!);el('detail-kind').textContent=model.entities.find(e=>e.id===d.reviewRead)?.name??d.reviewRead;el('detail-title').textContent=content.title;el('detail').innerHTML=content.html;el('inspector').hidden=false;el('check-panel').hidden=true;}
 else if(d.mapReveal){const id=d.mapReveal;if(!el('drawing').querySelector(`[data-node="${CSS.escape(id)}"]`)){mapFocusId='';mapPerspective='';draw(false);}select(id);revealNode(id);}
 else if(d.mapAdd){const field=d.mapAdd==='realization'?'implemented_by':d.mapAdd==='verification'?'verified_by':'has';authoring.open(d.mapAdd as Kind,{link:{from:d.mapParent!,field}});}
 else if(d.mapPerspective){mapFocusId=d.mapTarget!;mapPerspective=d.mapPerspective;autoFit=true;draw();}
 else if(d.mapFocus){mapFocusId=d.mapFocus;mapPerspective='';autoFit=true;el('inspector').hidden=true;draw();}
 else if(d.mapExpand){expandedMapIds.has(d.mapExpand)?expandedMapIds.delete(d.mapExpand):expandedMapIds.add(d.mapExpand);draw(false);}
 else if(d.mapReviews){reviewMapTargets.has(d.mapReviews)?reviewMapTargets.delete(d.mapReviews):reviewMapTargets.add(d.mapReviews);draw(false);}
 else if(d.mapEdit){const entity=model.entities.find(e=>e.id===d.mapEdit)!;authoring.open(entity.kind,{id:entity.id});}
 else if(d.mapReviewTarget)reviewUI.open(d.mapReviewTarget,d.mapReviewPerspective);
 else if(d.mapEdge!==undefined)mapEditors.connection(Number(d.mapEdge));
 else if(d.mapDocumentToggle){documentExpanded=!documentExpanded;draw(false);}
 else if(d.mapDocumentEdit||button.id==='edit-map-document')mapEditors.metadata();
 else if(button.id==='add-map-connection')mapEditors.connection();
 else if(button.id==='expand-scope-reviews'){for(const scope of designCoverage(model,mapFocusId||undefined).scopes)reviewMapTargets.add(scope.target);draw(false);}
}
document.addEventListener('click',mapAction,true);document.addEventListener('keydown',mapAction,true);

document.addEventListener('click',event=>{const button=(event.target as Element).closest<HTMLElement>('[data-review-target]');if(button)reviewUI.open(button.dataset.reviewTarget);});
const authoring=installAuthoring({source:()=>editor.value,model:()=>parseModel(editor.value),replace:newSource,select:id=>select(id),save,beginLink});
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
el('new-model').onclick=()=>{if(confirm('新しいDSLを作成しますか？必要な内容はYAML保存してください。')){newSource(EMPTY_MODEL);openEditor();}};el('add-element').hidden=true;el('edit-map-document').hidden=true;el('add-map-connection').hidden=true;



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


// Keep the map visible on entry; the DSL editor is opened on demand.

const resizePanels=new ResizeObserver(()=>{const top=document.querySelector('main')!.getBoundingClientRect().top;document.querySelectorAll<HTMLElement>('.panel,#scope-panel').forEach(panel=>panel.style.top=`${top}px`);});
resizePanels.observe(mapContext);resizePanels.observe(workspaceHeader);resizePanels.observe(document.querySelector('.playground-nav')!);
