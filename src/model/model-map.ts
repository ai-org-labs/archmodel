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
export interface ModelMapOptions {focus?:string;perspective?:string;selectedId?:string;expandedIds?:readonly string[];reviewTargetIds?:readonly string[];expanded?:boolean;showRelations?:boolean;documentExpanded?:boolean}
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
 const escape=escapeXml,parts:string[]=[],positions=new Map<string,{x:number;y:number;height:number}>();
 const text=(value:string,x:number,y:number,size=12,color='#304b5a')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}">${escape(value)}</text>`;
 const action=(label:string,x:number,y:number,attributes:string,w=132)=>`<g ${attributes} role="button" tabindex="0" aria-label="${escape(label)}" class="model-map-action"><rect x="${x}" y="${y-16}" width="${w}" height="25" rx="4" fill="#e1f2ef" stroke="#94bfb7"/>${text(label,x+7,y,11)}</g>`;
 const docLines=[`version: ${model.version} · ${model.entities.length} 要素 · ${model.edges.length} 関係`,`観点 ${coverage.concluded}/${coverage.total} 結論あり · 未結論 ${coverage.unconcluded} · 保留は未解決`,...(options.documentExpanded?[`review_scopes: ${stringify(model.source.review_scopes??[])}`,`extensions: ${stringify(model.source.extensions)}`,...projection.document.catalog.map(p=>`${p.id}: ${p.name} — ${p.description??''}`)]:[])];
 let docY=38;for(const line of docLines)for(const l of wrapText(line,width-400,13)){parts.push(text(l,32,docY,13));docY+=20;}
 parts.push(action(options.documentExpanded?'文書情報を閉じる':'文書・観点定義を展開',width-350,40,'data-map-document-toggle="true"',175),action('文書情報を編集',width-165,40,'data-map-document-edit="true"',145));
 const top=Math.max(100,docY+24),ys=modelMapLanes.map(()=>top+50);
 modelMapLanes.forEach((lane,i)=>parts.push(text(lane.title,32+i*340,top+22,16)));
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
  const connected=projection.edges.filter(({edge})=>edge.from===e.id||edge.to===e.id);
  body.push(text(`関係 ${connected.length}件${!model.edges.some(r=>r.to===e.id&&r.relation==='has')&&['capability','behavior','scenario','quality'].includes(e.kind)?' · 所属未定':''}`,x+12,cy,11));cy+=23;
  if(expanded)for(const {edge,index}of connected){
   const other=edge.from===e.id?edge.to:edge.from;
   body.push(`<g data-map-edge="${index}" role="button" tabindex="0" aria-label="${escape(edge.relation+' '+other)}">`);
   for(const line of wrapText(`${edge.from===e.id?'→':'←'} ${relationName(edge.relation)}: ${other}`,270,11)){body.push(text(line,x+12,cy,11,'#137f88'));cy+=17;}
   if(edge.id){const connection=model.connections.find(c=>c.id===edge.id);if(connection)for(const [k,v]of Object.entries(connection))for(const line of wrapText(`${k}: ${stringify(v)}`,270,11)){body.push(text(line,x+12,cy,11));cy+=17;}}
   body.push('</g>');cy+=8;
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
  parts.push(`<g data-node="${escape(e.id)}" role="button" tabindex="0" aria-label="${escape(e.name)}"><rect x="${x}" y="${y}" width="300" height="${height}" rx="7" fill="#fffdf8" stroke="${options.selectedId===e.id?'#137f88':node.boundary?'#bb8b35':'#a4c4be'}" stroke-width="${options.selectedId===e.id?3:1}" ${node.boundary?'stroke-dasharray="5 3"':''}/>${body.join('')}</g>`);
 }
 const links:string[]=[];
 if(options.showRelations!==false)for(const {edge,index}of projection.edges){const a=positions.get(edge.from),b=positions.get(edge.to);if(!a||!b)continue;const ax=a.x+300,ay=a.y+32,bx=b.x,by=b.y+32;const highlighted=edge.from===options.selectedId||edge.to===options.selectedId;
  const path=a.x===b.x?`M ${ax} ${ay} C ${ax+28} ${ay}, ${ax+28} ${by}, ${bx+300} ${by}`:`M ${ax} ${ay} C ${ax+28} ${ay}, ${bx-28} ${by}, ${bx} ${by}`;
  links.push(`<g data-map-edge="${index}" role="button" tabindex="0" aria-label="${escape(edge.from+' '+edge.relation+' '+edge.to)}"><title>${escape(JSON.stringify({...edge,relation:relationName(edge.relation)}))}</title><path d="${path}" fill="none" stroke="${highlighted?'#137f88':'#99b0b7'}" stroke-width="${highlighted?2.5:1}" marker-end="url(#model-arrow)"/><path d="${path}" fill="none" stroke="transparent" stroke-width="10"/></g>`);
 }
 if(options.showRelations!==false)for(const link of projection.reviewLinks){const a=positions.get(link.target),b=positions.get(link.to);if(!a||!b)continue;links.push(`<g data-map-review-target="${escape(link.target)}" data-map-review-perspective="${escape(link.perspective)}" role="button" tabindex="0" aria-label="${escape(link.perspective+' addresses '+link.to)}"><title>${escape(link.perspective+' → addresses: '+link.to)}</title><path d="M${a.x+300} ${a.y+60} C${a.x+328} ${a.y+60},${b.x-28} ${b.y+60},${b.x} ${b.y+60}" fill="none" stroke="#9d6d33" stroke-dasharray="4 4" marker-end="url(#model-arrow)"/></g>`);}
 const height=Math.max(...ys,top+160);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="ArchModel 全体マップ" style="font-family:Inter,Arial,'Noto Sans JP',sans-serif"><title>ArchModel — ${options.focus?'対象 '+options.focus:'全体マップ'}</title><defs><marker id="model-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#137f88"/></marker></defs><rect width="100%" height="100%" fill="#f5f2ea"/>${links.join('')}${parts.join('')}</svg>`;
 return {svg,layout:{width,height},projection};
}
