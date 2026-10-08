import {mapCompleteness,traceStages,type CoverageTone} from './map-completeness.js';
import schema from '../../schema/archmodel.schema.json';
import {escapeXml} from '../focused/render.js';
import {wrapText} from '../focused/layout.js';
import {editableFields,referenceFields} from './authoring.js';
import {designCoverage,designFocus,designReviewTargets} from './coverage.js';
import {reviewCatalog,reviewRows,reviewStatusLabels} from './reviews.js';
import {fieldLabel} from './presentation.js';
import {validateModel} from './analysis.js';
import type {Model,Kind} from './types.js';
export const modelMapLanes:{title:string;kinds:Kind[]}[]=[
 {title:'価値・能力',kinds:['product','capability']},
 {title:'振る舞い・シナリオ',kinds:['behavior','scenario']},
 {title:'品質・制約',kinds:['quality','policy']},
 {title:'責務・契約・判断',kinds:['component','contract','decision']},
 {title:'技術実現',kinds:['realization']},
 {title:'検証・証跡',kinds:['verification','evidence']}
];
export const relationLayers={all:'すべて',structure:'所属',realization:'実現・実装',assurance:'検証・証跡',contracts:'契約',governance:'制約・判断',architecture:'実接続',reviews:'観点の根拠'} as const;
export type RelationLayer=keyof typeof relationLayers;
export function relationLayer(relation:string):RelationLayer{
 if(relation==='has')return 'structure';
 if(['realizedBy','implementedBy'].includes(relation))return 'realization';
 if(['verifiedBy','evidencedBy'].includes(relation))return 'assurance';
 if(['uses','provides','consumes'].includes(relation))return 'contracts';
 if(['appliesTo','affects'].includes(relation))return 'governance';
 return 'architecture';
}
export interface ModelMapOptions {relationMode?:'cards'|'selected'|'all';relationLayer?:RelationLayer;focus?:string;perspective?:string;selectedId?:string;expandedIds?:readonly string[];reviewTargetIds?:readonly string[];expanded?:boolean;showRelations?:boolean;documentExpanded?:boolean}
/** Shared projection for overview and focus. Layout state never enters the DSL. */
export function projectModelMap(model:Model,options:ModelMapOptions={}){
 const errors=validateModel(model).filter(d=>d.severity==='error');if(errors.length)throw new Error(errors.map(e=>e.message).join('\n'));
 const focus=options.focus?designFocus(model,options.focus,options.perspective):undefined;
 const ids=focus?new Set([...focus.entities,...focus.boundary].map(e=>e.id)):new Set(model.entities.map(e=>e.id));
 const boundary=new Set(focus?.boundary.map(e=>e.id)??[]),targets=new Set(designReviewTargets(model));
 const nodes=model.entities.filter(e=>ids.has(e.id)).map(e=>({entity:e,lane:modelMapLanes.findIndex(l=>l.kinds.includes(e.kind)),boundary:boundary.has(e.id),fields:[['id',{type:'string'}] as const,...editableFields(e.kind)].map(([key])=>({key,value:e.data[key],required:(schema.$defs[e.kind]['x-design-required'] as readonly string[]).includes(key)})),reviews:targets.has(e.id)||options.reviewTargetIds?.includes(e.id)?reviewRows(model,e.id).filter(r=>!options.perspective||e.id===options.focus&&r.perspective.id===options.perspective):[]}));
 const edges=(focus?.edges??model.edges).map(edge=>({edge,index:model.edges.indexOf(edge)}));
 const reviewLinks=(model.reviews??[]).flatMap(r=>(r.addresses??[]).filter(to=>ids.has(r.target)&&ids.has(to)&&(!options.perspective||r.target===options.focus&&r.perspective===options.perspective)).map(to=>({target:r.target,perspective:r.perspective,to})));
 return {nodes,edges,reviewLinks,document:{version:model.source.version,extensions:model.source.extensions,catalog:reviewCatalog(model),review_scopes:model.reviewScopes??[]},hiddenEntities:model.entities.length-nodes.length};
}
const relationName=(name:string)=>Object.entries(referenceFields).find(([,r])=>r===name)?.[0]??name;
const stringify=(v:unknown)=>v===undefined?'未設定':typeof v==='object'?JSON.stringify(v,null,2):String(v);
export function renderModelMap(model:Model,options:ModelMapOptions={}){
 const projection=projectModelMap(model,options),coverage=designCoverage(model,options.focus),width=6*340+32;
 const mode=options.relationMode??(options.showRelations===true?'all':'cards'),layer=options.relationLayer??'all';
 const visibleEdges=projection.edges.filter(({edge})=>layer==='all'||relationLayer(edge.relation)===layer);
 const visibleReviewLinks=projection.reviewLinks.filter(()=>layer==='all'||layer==='reviews');
 const related=new Set([options.selectedId,...visibleEdges.filter(({edge})=>edge.from===options.selectedId||edge.to===options.selectedId).flatMap(({edge})=>[edge.from,edge.to]),...visibleReviewLinks.filter(l=>l.target===options.selectedId||l.to===options.selectedId).flatMap(l=>[l.target,l.to])]);
 const escape=escapeXml,parts:string[]=[],positions=new Map<string,{x:number;y:number;height:number}>();
 const text=(value:string,x:number,y:number,size=12,color='#304b5a')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${escape(value)}</text>`;
 const action=(label:string,x:number,y:number,attributes:string,w=132)=>`<g ${attributes} role="button" tabindex="0" aria-label="${escape(label)}" class="model-map-action"><rect x="${x}" y="${y-16}" width="${w}" height="25" rx="4" fill="#e1f2ef" stroke="#94bfb7"/>${text(label,x+7,y,11)}</g>`;
 const docLines=[`version: ${model.version} · ${model.entities.length} 要素 · ${model.edges.length} 関係`,`関係レイヤー: ${relationLayers[layer]} · ${visibleEdges.length+visibleReviewLinks.length}/${projection.edges.length+projection.reviewLinks.length}件 · ${mode==='cards'?'線なし':mode==='selected'?'選択した関係線':'全ての関係線'}`,`観点 ${coverage.concluded}/${coverage.total} 結論あり · 未結論 ${coverage.unconcluded} · 保留は未解決`,...(options.documentExpanded?[`review_scopes: ${stringify(model.source.review_scopes??[])}`,`extensions: ${stringify(model.source.extensions)}`,...projection.document.catalog.map(p=>`${p.id}: ${p.name} — ${p.description??''}`)]:[])];
 let docY=38;for(const line of docLines)for(const l of wrapText(line,width-400,13)){parts.push(text(l,32,docY,13));docY+=20;}
 parts.push(action(options.documentExpanded?'文書情報を閉じる':'文書・観点定義を展開',width-350,40,'data-map-document-toggle="true"',175),action('文書情報を編集',width-165,40,'data-map-document-edit="true"',145));
 const completeness=mapCompleteness(model,options.focus);
 const colors:Record<CoverageTone,string>={recorded:'#e4edf5',missing:'#fff0e5',pending:'#fff4cc',excluded:'#eeedf4',failed:'#fce2e1'};
 const nameLink=(entity:{id:string;name:string},x:number,y:number,w:number)=>{
  const lines=wrapText(`${entity.name} (${entity.id})`,w,11);
  parts.push(`<g data-map-reveal="${escape(entity.id)}" role="button" tabindex="0" aria-label="${escape(entity.name+'の設計を表示')}">`);
  for(const line of lines){parts.push(text(line,x,y,11,'#126a83'));y+=16;}parts.push('</g>');return y;
 };
 let overviewY=Math.max(110,docY+24);
 parts.push(`<g data-map-section="trace">`,text('設計のつながり — 対象ごとの対応と未接続',32,overviewY,19));overviewY+=26;
 parts.push(text('記録あり ≠ 設計完了。未接続は構造上の不足候補です。不要と判断した場合も、下の観点表で理由を確認します。',32,overviewY,13));overviewY+=28;
 const labelWidth=240,cellWidth=(width-64-labelWidth)/traceStages.length;
 parts.push(text('対象',44,overviewY,13));traceStages.forEach((s,i)=>parts.push(text(`${s.name} / ${s.field}`,32+labelWidth+i*cellWidth+8,overviewY,12)));overviewY+=16;
 if(!completeness.rows.length){parts.push(text('Product・Capabilityの検討対象が未定義です。既存要素は下の全要素マップに残っています。',44,overviewY+20,13));overviewY+=48;}
 for(const row of completeness.rows){
  const rowY=overviewY;let rowBottom=rowY+64;
  const rowPartsStart=parts.length;
  let targetY=nameLink(row.target,44,rowY+22,labelWidth-24)+16;
  if(row.targetGaps.length)for(const line of wrapText('! 未入力: '+row.targetGaps.join(', '),labelWidth-24,11)){parts.push(text(line,44,targetY,11,'#9b3b20'));targetY+=17;}
  rowBottom=Math.max(rowBottom,targetY+12);
  row.cells.forEach((cell,i)=>{
   const x=32+labelWidth+i*cellWidth;let y=rowY+22;
   const localStart=parts.length;
   for(const line of wrapText(cell.summary,cellWidth-16,11)){parts.push(text(line,x+8,y,11));y+=17;}
   for(const entity of cell.items)y=nameLink(entity,x+8,y+3,cellWidth-16)+3;
   for(const gap of cell.gaps){parts.push(`<g data-map-reveal="${escape(gap.id)}" role="button" tabindex="0" aria-label="${escape(gap.label)}">`);for(const line of wrapText('! '+gap.label,cellWidth-16,11)){parts.push(text(line,x+8,y+3,11,'#9b3b20'));y+=16;}parts.push('</g>');y+=6;}
   y=Math.max(y+12,rowY+60);rowBottom=Math.max(rowBottom,y);
   parts.splice(localStart,0,`<rect data-trace-cell="${cell.stage.id}" data-trace-target="${escape(row.target.id)}" data-state="${cell.tone}" x="${x+2}" y="${rowY}" width="${cellWidth-4}" height="${y-rowY}" rx="4" fill="${colors[cell.tone]}"/>`);
  });
  parts.splice(rowPartsStart,0,`<rect x="32" y="${rowY}" width="${labelWidth-4}" height="${rowBottom-rowY}" fill="#f0eee7"/>`);overviewY=rowBottom+12;
 }
 parts.push('</g>');overviewY+=30;
 parts.push(`<g data-map-section="reviews">`,text('設計観点 — 未記入も含む判断の全体像',32,overviewY,19));overviewY+=25;
 parts.push(text('未検討 / 検討中 / 対象 / 対象外 / 保留を区別。対象は設計参照の記録であり、実装や検証の完了を意味しません。',32,overviewY,13));overviewY+=24;
 parts.push(text('各セルに状態と理由を表示します。選択すると判断・根拠・再検討条件を確認できます。',32,overviewY,12));overviewY+=28;
 // Repeat the perspective column in panels so many scopes never compress the text.
 const scopeBatches=Array.from({length:Math.ceil(completeness.rows.length/5)},(_,i)=>completeness.rows.slice(i*5,i*5+5));
 for(const batch of scopeBatches){
  const reviewWidth=(width-64-300)/batch.length;
  parts.push(text('観点 / DSL名',44,overviewY,12));let headingBottom=overviewY;
  batch.forEach((r,i)=>{headingBottom=Math.max(headingBottom,nameLink(r.target,340+i*reviewWidth,overviewY,reviewWidth-20));});overviewY=headingBottom+12;
  for(const perspective of projection.document.catalog.filter(p=>!options.perspective||p.id===options.perspective)){
   const labelLines=[...wrapText(perspective.name,280,12),...wrapText(perspective.id,280,10)];
   const cellTexts=batch.map(r=>{const row=r.reviews.find(v=>v.perspective.id===perspective.id)!;const rationale=row.record?.rationale??'判断の記録なし';const excerpt=rationale.length>65?rationale.slice(0,65)+'…':rationale;return {row,lines:[...wrapText(row.label,reviewWidth-24,12),...wrapText(excerpt,reviewWidth-24,11),...(row.status==='applicable'?[...wrapText('設計: '+(row.addresses.map(e=>e.name).join(' / ')||'参照なし'),reviewWidth-24,11),...wrapText('検証: '+(row.verifications.map(e=>`${e.name} [${e.data.result??'unknown'}]`).join(' / ')||'参照先からの経路なし'),reviewWidth-24,11)]:[]),...(row.gaps.length?wrapText('不足: '+row.gaps.join(', '),reviewWidth-24,10):[])]};});
   const rowHeight=Math.max(labelLines.length*17+16,...cellTexts.map(c=>c.lines.length*17+16));
   parts.push(`<rect x="32" y="${overviewY}" width="296" height="${rowHeight-3}" fill="#f0eee7"/>`);labelLines.forEach((line,i)=>parts.push(text(line,44,overviewY+19+i*17,i?10:12)));
   cellTexts.forEach(({row,lines},i)=>{const x=332+i*reviewWidth;parts.push(`<g data-coverage-cell="${escape(row.target)}:${escape(perspective.id)}" data-state="${row.tone}" data-map-review-target="${escape(row.target)}" data-map-review-perspective="${escape(perspective.id)}" role="button" tabindex="0" aria-label="${escape(perspective.name+'：'+row.label)}"><title>${escape(JSON.stringify(row.record??{status:'unreviewed'}))}</title><rect x="${x}" y="${overviewY}" width="${reviewWidth-4}" height="${rowHeight-3}" rx="3" fill="${colors[row.tone]}"/>`);lines.forEach((line,j)=>parts.push(text(line,x+10,overviewY+19+j*17,j?11:12)));parts.push('</g>');});overviewY+=rowHeight;
  }
  overviewY+=28;
 }
 parts.push('</g>');
 if(completeness.unassigned.length){parts.push(text('対象との対応が未整理 — 要素を消さずに残しています',32,overviewY,16));overviewY+=24;for(const entity of completeness.unassigned)overviewY=nameLink(entity,44,overviewY,900)+4;overviewY+=20;}
 const top=overviewY+24,ys=modelMapLanes.map(()=>top+65);
 parts.push(`<g data-map-section="entities">${text('全要素の設計 — 属性・判断・関係を同じマップで確認',32,top,19)}</g>`);
 modelMapLanes.forEach((lane,i)=>parts.push(text(lane.title,32+i*340,top+38,16)));
 for(const node of projection.nodes){
  const e=node.entity,x=32+node.lane*340,y=ys[node.lane],expanded=!node.boundary&&(!!options.expanded||!!options.expandedIds?.includes(e.id)),showReviews=!node.boundary&&(!!options.perspective||!!options.reviewTargetIds?.includes(e.id)||!!options.expanded);
  const body:string[]=[];let cy=y+24;
  for(const line of wrapText(e.name,274,15)){body.push(text(line,x+12,cy,15));cy+=20;}
  body.push(text(`${e.kind} · ${e.id}`,x+12,cy,10));cy+=20;
  body.push(text(node.boundary?'範囲外への接続':`status: ${e.data.status??'draft'}`,x+12,cy,11,node.boundary?'#8b651a':'#526c7a'));cy+=24;
  body.push(action(expanded?'属性を閉じる':`属性を展開 (${node.fields.length})`,x+12,cy,`data-map-expand="${escape(e.id)}"`),action('編集',x+154,cy,`data-map-edit="${escape(e.id)}"`,64),action('絞る',x+228,cy,`data-map-focus="${escape(e.id)}"`,60));cy+=34;
  if(expanded)for(const f of node.fields){
   body.push(`<g data-map-field="${escape(f.key)}">`);body.push(text(`${fieldLabel(f.key,e.kind)}${f.required&&f.value===undefined?' · 必須未入力':''}`,x+12,cy,11));cy+=18;
   for(const line of stringify(f.value).split('\n').flatMap(l=>wrapText(l,270,12))){body.push(text(line,x+12,cy,12));cy+=18;}cy+=10;body.push('</g>');
  }
  const children:Partial<Record<Kind,Kind[]>>={product:['capability'],capability:['behavior','quality'],behavior:['scenario'],component:['realization'],quality:['verification'],scenario:['verification'],contract:['verification']};
  for(const child of children[e.kind]??[]){body.push(action(`${child}を追加`,x+12,cy,`data-map-add="${child}" data-map-parent="${escape(e.id)}"`,276));cy+=33;}
  const connected=visibleEdges.filter(({edge})=>edge.from===e.id||edge.to===e.id);
  const supporting=visibleReviewLinks.filter(l=>l.target===e.id||l.to===e.id);
  body.push(text(`関係 ${connected.length+supporting.length}件${!model.edges.some(r=>r.to===e.id&&r.relation==='has')&&['capability','behavior','scenario','quality'].includes(e.kind)?' · 所属未定':''}`,x+12,cy,11));cy+=23;
  // Named relationships remain visible; no generic navigation/card controls.
  for(const {edge,index}of connected){
   const other=edge.from===e.id?edge.to:edge.from,otherEntity=model.entities.find(n=>n.id===other)!;
   body.push(text(`${edge.from===e.id?'→':'←'} ${relationName(edge.relation)}`,x+12,cy,11));cy+=17;
   body.push(`<g data-map-reveal="${escape(other)}" role="button" tabindex="0" aria-label="${escape(otherEntity.name+'の設計を表示')}">`);
   for(const line of wrapText(`${otherEntity.name} (${other})`,270,11)){body.push(text(line,x+12,cy,11,'#126a83'));cy+=17;}body.push('</g>');cy+=8;
   if(expanded){body.push(action('関係を編集',x+12,cy+8,`data-map-edge="${index}"`,132));cy+=40;
    if(edge.id){const connection=model.connections.find(c=>c.id===edge.id);if(connection)for(const [k,v]of Object.entries(connection))for(const line of wrapText(`${k}: ${stringify(v)}`,270,11)){body.push(text(line,x+12,cy,11));cy+=17;}}
   }
  }
  for(const link of supporting){const other=link.target===e.id?link.to:link.target;
   for(const line of wrapText(`addresses: ${link.perspective}`,270,11)){body.push(text(line,x+12,cy,11));cy+=17;}
   body.push(`<g data-map-reveal="${escape(other)}" role="button" tabindex="0" aria-label="${escape(other)}">`);for(const line of wrapText(model.entities.find(n=>n.id===other)!.name+` (${other})`,270,11)){body.push(text(line,x+12,cy,11,'#126a83'));cy+=17;}body.push('</g>');cy+=10;
  }
  if(node.reviews.length){
   const concluded=node.reviews.filter(r=>r.record&&['applicable','not_applicable','deferred'].includes(r.status)&&!r.gaps.length).length;
   body.push(action(showReviews?'観点を閉じる':`観点 ${concluded}/${node.reviews.length} 結論`,x+12,cy,`data-map-reviews="${escape(e.id)}"`,276));cy+=35;
   if(showReviews)for(const row of node.reviews){
    const ry=cy-14,lines=[`${row.perspective.name} · ${reviewStatusLabels[row.status]}${row.gaps.length?'（根拠不足）':''}`,row.perspective.id,...(row.record?Object.entries(row.record).filter(([k])=>!['target','perspective','status'].includes(k)).map(([k,v])=>`${k}: ${stringify(v)}`):['判断と根拠は未記録'])];
    const rt:string[]=[];for(const l of lines)for(const line of l.split('\n').flatMap(v=>wrapText(v,256,11))){rt.push(text(line,x+20,cy,11));cy+=17;}
    cy+=28;rt.push(action('この観点に絞る',x+20,cy-8,`data-map-perspective="${escape(row.perspective.id)}" data-map-target="${escape(e.id)}"`,248));
    body.push(`<g data-map-review-target="${escape(e.id)}" data-map-review-perspective="${escape(row.perspective.id)}" role="button" tabindex="0" aria-label="${escape(row.perspective.name+'の判断を編集')}"><rect x="${x+12}" y="${ry}" width="276" height="${cy-ry+3}" rx="4" fill="${row.resolved?'#e1f2ef':'#fff3dd'}" stroke="#d5d8ca"/>${rt.join('')}</g>`);cy+=18;
   }
  }else {body.push(action('観点を検討する',x+12,cy,`data-map-reviews="${escape(e.id)}"`,276));cy+=35;}
  const height=cy-y+8;positions.set(e.id,{x,y,height});ys[node.lane]=cy+32;
  parts.push(`<g data-node="${escape(e.id)}" role="button" tabindex="0" aria-label="${escape(e.name)}"><rect x="${x}" y="${y}" width="300" height="${height}" rx="7" fill="#fffdf8" stroke="${related.has(e.id)?'#137f88':node.boundary?'#bb8b35':'#a4c4be'}" stroke-width="${options.selectedId===e.id?3:related.has(e.id)?2:1}" ${node.boundary?'stroke-dasharray="5 3"':''}/>${body.join('')}</g>`);
 }
 const links:string[]=[];
 if(mode!=='cards')for(const {edge,index}of visibleEdges.filter(({edge})=>mode==='all'||edge.from===options.selectedId||edge.to===options.selectedId)){const a=positions.get(edge.from),b=positions.get(edge.to);if(!a||!b)continue;const ax=a.x+300,ay=a.y+32,bx=b.x,by=b.y+32;const highlighted=edge.from===options.selectedId||edge.to===options.selectedId;
  const path=a.x===b.x?`M ${ax} ${ay} C ${ax+28} ${ay}, ${ax+28} ${by}, ${bx+300} ${by}`:`M ${ax} ${ay} C ${ax+28} ${ay}, ${bx-28} ${by}, ${bx} ${by}`;
  links.push(`<g data-map-edge="${index}" role="button" tabindex="0" aria-label="${escape(edge.from+' '+edge.relation+' '+edge.to)}"><title>${escape(JSON.stringify({...edge,relation:relationName(edge.relation)}))}</title><path data-connection-line="true" d="${path}" fill="none" stroke="${highlighted?'#137f88':'#99b0b7'}" stroke-width="${highlighted?2.5:1}" marker-end="url(#model-arrow)"/><path d="${path}" fill="none" stroke="transparent" stroke-width="10"/></g>`);
 }
 if(mode!=='cards')for(const link of visibleReviewLinks.filter(l=>mode==='all'||l.target===options.selectedId||l.to===options.selectedId)){const a=positions.get(link.target),b=positions.get(link.to);if(!a||!b)continue;links.push(`<g data-map-review-target="${escape(link.target)}" data-map-review-perspective="${escape(link.perspective)}" role="button" tabindex="0" aria-label="${escape(link.perspective+' addresses '+link.to)}"><title>${escape(link.perspective+' → addresses: '+link.to)}</title><path data-connection-line="true" d="M${a.x+300} ${a.y+60} C${a.x+328} ${a.y+60},${b.x-28} ${b.y+60},${b.x} ${b.y+60}" fill="none" stroke="#9d6d33" stroke-dasharray="4 4" marker-end="url(#model-arrow)"/></g>`);}
 const height=Math.max(...ys,top+160);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="ArchModel 全体マップ" style="font-family:Inter,Arial,'Noto Sans JP',sans-serif"><title>ArchModel — ${options.focus?'対象 '+options.focus:'全体マップ'}</title><defs><marker id="model-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#137f88"/></marker></defs><rect width="100%" height="100%" fill="#f5f2ea"/>${links.join('')}${parts.join('')}</svg>`;
 return {svg,layout:{width,height},projection};
}
