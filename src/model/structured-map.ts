import {escapeXml} from '../focused/render.js';
import {wrapText} from '../focused/layout.js';
import {validateModel} from './analysis.js';
import {reviewRows} from './reviews.js';
import type {Entity, Model} from './types.js';

/** Display families, not an IPA grade catalogue or inferred requirements. */
export const mapQualityGroups = [
  {id:'availability', name:'可用性', attributes:['reliability','availability','resilience','recoverability']},
  {id:'performance', name:'性能・拡張性', attributes:['performance','scalability']},
  {id:'operations', name:'運用・保守性', attributes:['operability','observability','audit','maintainability','testability','deployment']},
  {id:'migration', name:'移行性', attributes:['migration','portability']},
  {id:'security', name:'セキュリティ', attributes:['security','privacy']},
  {id:'environment', name:'環境・エコロジー', attributes:[] as string[]},
  {id:'other-quality', name:'使用性・互換性・安全性', attributes:['usability','accessibility','compatibility','interoperability','safety']}
];
export const mapDesignGroups = [
  {id:'boundary',name:'境界・利用者・前提',perspectives:['system_boundary','actors','assumptions']},
  {id:'behavior',name:'振る舞い・シナリオ・例外',perspectives:['behavior_specification','scenario_coverage','failure_modes']},
  {id:'dependencies',name:'データ・外部依存・契約',perspectives:['data_lifecycle','external_dependencies','contracts']},
  {id:'realization',name:'方針・判断・実現・検証',perspectives:['policies','design_decisions','logical_responsibilities','technical_realization','verification_evidence']},
  {id:'custom',name:'追加の観点',perspectives:[] as string[]}
];
export function mapReviewRows(model:Model,target:string,group:string) {
  const quality=mapQualityGroups.find(g=>g.id===group),design=mapDesignGroups.find(g=>g.id===group);
  const ids=quality?quality.attributes.map(a=>'quality.'+a):design?.perspectives;
  return reviewRows(model,target).filter(r=>group==='all-quality'?r.perspective.id.startsWith('quality.'):group==='custom'?(model.reviewCatalog??[]).some(p=>p.id===r.perspective.id):ids?.includes(r.perspective.id));
}
export function mapReviewSummary(model:Model,target:string,group:string) {
  const rows=mapReviewRows(model,target,group);
  if(!rows.length)return group==='environment'?'観点未定義':'記録なし';
  const missing=rows.filter(r=>r.status==='unreviewed').length,pending=rows.filter(r=>r.status==='deferred').length;
  const incomplete=rows.filter(r=>r.gaps.length||r.status==='in_review').length;
  if(pending)return `△ 保留 ${pending}${missing?'・未検討 '+missing:''}`;
  if(missing)return `・未検討 ${missing}${incomplete?'・確認中 '+incomplete:''}`;
  if(incomplete)return `△ 確認中 ${incomplete}`;
  if(rows.every(r=>r.status==='not_applicable'))return '— 対象外（根拠あり）';
  return '判断記録あり';
}

/** Scope follows declared design relations. Runtime communication is not ownership. */
export function structuredScopes(model:Model) {
  const byId=new Map(model.entities.map(e=>[e.id,e]));
  const scopes=new Map(model.entities.map(e=>[e.id,new Set<string>(e.kind==='capability'?[e.id]:[])]));
  const productScopes=new Map(model.entities.filter(e=>e.kind==='product').map(e=>[e.id,new Set(model.edges.filter(l=>l.from===e.id&&l.relation==='has'&&byId.get(l.to)?.kind==='capability').map(l=>l.to))]));
  const flow=new Set(['realizedBy','implementedBy','verifiedBy','evidencedBy','uses','provides','consumes']);
  let changed=true;
  while(changed){
    changed=false;
    for(const edge of model.edges){
      const from=byId.get(edge.from),to=byId.get(edge.to);if(!from||!to)continue;
      let source:Set<string>|undefined,destination:Set<string>|undefined;
      if(['appliesTo','affects'].includes(edge.relation)) {source=productScopes.get(to.id)??scopes.get(to.id);destination=scopes.get(from.id);}
      else if(flow.has(edge.relation)&&!(edge.relation==='realizedBy'&&from.kind==='policy')||edge.relation==='has'&&from.kind!=='product'&&to.kind!=='capability') {source=scopes.get(from.id);destination=scopes.get(to.id);}
      if(source&&destination)for(const id of source)if(!destination.has(id)){destination.add(id);changed=true;}
    }
  }
  return scopes;
}
export interface StructuredBox {id:string;x:number;y:number;width:number;height:number;parentId?:string;scope:string[]}
export interface StructuredRow {scope:string[];x:number;y:number;width:number;height:number}
const columns=[
  {name:'機能と振る舞い',type:'Capability / Behavior / Scenario',width:310},
  {name:'品質要求',type:'Quality',width:220},
  {name:'方針',type:'Policy',width:158},
  {name:'設計判断',type:'Decision',width:172},
  {name:'論理構成・契約',type:'Component / Contract',width:186},
  {name:'技術実現・検証',type:'Realization / Verification / Evidence',width:302}
];
const columnOf=(e:Entity)=>['capability','behavior','scenario'].includes(e.kind)?0:e.kind==='quality'?1:e.kind==='policy'?2:e.kind==='decision'?3:['component','contract'].includes(e.kind)?4:5;
const readable=(value:unknown):string=>value==null?'':Array.isArray(value)?value.map(readable).join(' / '):typeof value==='object'?JSON.stringify(value):String(value);
export function mapEntitySummary(e:Entity):string {
  const d=e.data;
  if(e.kind==='product')return readable(d.purpose??d.user_value??d.description);
  if(e.kind==='capability')return [d.actor&&`利用者：${readable(d.actor)}`,d.purpose??d.guarantees??d.description].filter(Boolean).map(readable).join('\n');
  if(e.kind==='behavior')return [d.trigger&&`開始：${readable(d.trigger)}`,d.outcomes??d.description].filter(Boolean).map(readable).join('\n');
  if(e.kind==='scenario')return readable(d.specification);
  if(e.kind==='quality')return [d.target!==undefined?`${readable(d.target)}${readable(d.unit)}`:d.level?`level: ${readable(d.level)}`:'要求水準未設定',d.requirement].filter(Boolean).map(readable).join('\n');
  if(e.kind==='policy')return readable(d.rules??d.description);
  if(e.kind==='decision')return readable(d.decision??d.reason??d.context);
  if(e.kind==='component')return readable(d.responsibilities??d.description);
  if(e.kind==='contract')return readable(d.specification??d.description);
  if(e.kind==='realization')return [d.service,d.location??d.environment].filter(Boolean).map(readable).join(' · ');
  if(e.kind==='verification')return readable(d.method??d.description);
  return readable(d.location??d.description);
}

export function renderStructuredMap(model:Model,options:{selectedId?:string}={}) {
  const errors=validateModel(model).filter(d=>d.severity==='error');
  if(errors.length)throw new Error(errors.map(e=>e.message).join('\n'));
  const esc=escapeXml,byId=new Map(model.entities.map(e=>[e.id,e])),scopes=structuredScopes(model);
  const capabilities=model.entities.filter(e=>e.kind==='capability'),order=new Map(capabilities.map((e,i)=>[e.id,i]));
  const sorted=(s:Set<string>)=>[...s].sort((a,b)=>order.get(a)!-order.get(b)!);
  const key=(id:string)=>JSON.stringify(sorted(scopes.get(id)!));
  const parents=new Map<string,string>();
  for(const e of model.entities.filter(e=>e.kind==='behavior'||e.kind==='scenario')){
    const incoming=model.edges.filter(l=>l.relation==='has'&&l.to===e.id);
    if(incoming.length===1&&key(e.id)===key(incoming[0].from))parents.set(e.id,incoming[0].from);
  }
  const related=new Set<string>();if(options.selectedId){related.add(options.selectedId);for(const e of model.edges)if(e.from===options.selectedId||e.to===options.selectedId){related.add(e.from);related.add(e.to);}}
  const boxes:StructuredBox[]=[],rows:StructuredRow[]=[],parts:string[]=[];
  const xs:number[]=[];let width=20;for(const c of columns){xs.push(width);width+=c.width+12;}width+=8;
  const colors={paper:'#ffffff',ground:'#f5f7fa',ink:'#263448',muted:'#56667a',line:'#d8e0e9',region:'#eef3f9',selected:'#e8f1ff',accent:'#245f9d',warning:'#8b5b13',success:'#326747'};
  const text=(v:string,x:number,y:number,size=14,color:string=colors.ink,weight=400)=>`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(v)}</text>`;
  const lines=(v:string,w:number,size:number,max=Infinity)=>{const ls=wrapText(v,w,size);return ls.length>max?[...ls.slice(0,max-1),ls[max-1].slice(0,-1)+'…']:ls;};
  const wrapped=(v:string,x:number,y:number,w:number,size=14,max=Infinity,color:string=colors.ink)=>{const ls=lines(v,w,size,max);return {svg:ls.map((l,i)=>text(l,x,y+i*(size+6),size,color)).join(''),height:ls.length*(size+6)};};
  const reviewGroups=(e:Entity)=>e.kind==='capability'||e.kind==='product'?[...mapDesignGroups.filter(g=>g.id!=='custom'||model.reviewCatalog?.length),...(e.kind==='product'?[{id:'all-quality',name:'品質要求の観点',perspectives:[]}]:[])]:[];
  const mixedKind=(e:Entity)=>['realization','verification','evidence','contract'].includes(e.kind);
  const titleSize=(e:Entity)=>e.kind==='capability'?18:e.kind==='scenario'?13:14;
  const summary=(e:Entity)=>e.kind==='scenario'?'':mapEntitySummary(e).split('\n')[0];
  const headHeight=(e:Entity,w:number)=>12+(mixedKind(e)?16:0)+lines(e.name,w-20,titleSize(e),e.kind==='scenario'?3:2).length*(titleSize(e)+5)+(summary(e)?lines(summary(e),w-20,12,1).length*17+5:0)+(['verification','decision'].includes(e.kind)?20:0)+10;
  const children=(id:string)=>model.entities.filter(e=>parents.get(e.id)===id);
  const childReferences=(id:string)=>model.edges.filter(l=>l.from===id&&l.relation==='has'&&['behavior','scenario'].includes(byId.get(l.to)?.kind??'')&&parents.get(l.to)!==id).map(l=>byId.get(l.to)!);
  const refHeight=(e:Entity,w:number)=>lines('共有：'+e.name,w-16,13,2).length*19+10;
  const treeHeight=(e:Entity,w:number):number=>headHeight(e,w)+children(e.id).reduce((h,c)=>h+treeHeight(c,w-20)+10,0)+childReferences(e.id).reduce((h,c)=>h+refHeight(c,w-20),0)+reviewGroups(e).length*36;
  function reference(e:Entity,x:number,y:number,w:number){const s=wrapped('共有：'+e.name,x+8,y+18,w-16,13,2,colors.accent);parts.push(`<g data-select="${esc(e.id)}" data-shared-reference="${esc(e.id)}" role="button" tabindex="0" aria-label="${esc(e.name+'の詳細')}"><title>${esc(e.name)}</title><rect x="${x}" y="${y}" width="${w}" height="${s.height+8}" fill="transparent"/>${s.svg}</g>`);return s.height+10;}
  function review(target:string,group:string,x:number,y:number,w:number,label:string){
    const summary=mapReviewSummary(model,target,group),s=wrapped(label,x+8,y+12,w-16,11,1,colors.muted),h=34;
    parts.push(`<g data-review-read="${esc(target)}" data-review-group="${esc(group)}" role="button" tabindex="0" aria-label="${esc(label+'：'+summary)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/>${s.svg}${text(summary,x+8,y+29,11,summary==='判断記録あり'?colors.muted:colors.warning)}</g>`);return h;
  }
  function card(e:Entity,x:number,y:number,w:number,h=headHeight(e,w),parentId?:string){
    const selected=e.id===options.selectedId,highlighted=related.has(e.id),size=titleSize(e);
    let cy=y+12,body='';
    if(mixedKind(e)){body+=text(e.kind,x+10,cy,11,colors.muted);cy+=16;}
    const title=wrapped(e.name,x+10,cy+size,w-20,size,e.kind==='scenario'?3:2);body+=title.svg;cy+=title.height+5;
    if(summary(e)){const description=wrapped(summary(e),x+10,cy+12,w-20,12,1,colors.muted);body+=description.svg;cy+=description.height+5;}
    if(e.kind==='verification'){const result=readable(e.data.result)||'unknown',labels:Record<string,string>={passed:'成功（この検証のみ）',failed:'失敗',unknown:'結果未記録'};body+=text(labels[result]??result,x+10,cy+10,11,result==='passed'?colors.success:colors.warning);}
    if(e.kind==='decision')body+=text(`判断：${readable(e.data.decision_status)||'未設定'}`,x+10,cy+10,11,colors.muted);
    boxes.push({id:e.id,x,y,width:w,height:h,parentId,scope:sorted(scopes.get(e.id)!)});
    parts.push(`<g data-node="${esc(e.id)}" data-kind="${e.kind}" role="button" tabindex="0" aria-label="${esc(e.name)}" aria-pressed="${selected}"><title>${esc(e.name)}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${highlighted?colors.selected:e.kind==='capability'?colors.region:colors.paper}" stroke="${highlighted?colors.accent:colors.line}" stroke-width="${selected?2:1}"/>${body}</g>`);
  }
  function tree(e:Entity,x:number,y:number,w:number,parentId?:string){
    const h=treeHeight(e,w);card(e,x,y,w,h,parentId);let cy=y+headHeight(e,w);
    for(const c of children(e.id)){tree(c,x+10,cy,w-20,e.id);cy+=treeHeight(c,w-20)+10;}
    for(const c of childReferences(e.id))cy+=reference(c,x+10,cy,w-20);
    for(const group of reviewGroups(e)){review(e.id,group.id,x+6,cy,w-12,group.name);cy+=36;}
    return h;
  }
  let y=20;
  for(const p of model.entities.filter(e=>e.kind==='product')){
    const purpose=readable(p.data.purpose??p.data.user_value)||p.name;
    const title=wrapped(purpose,32,y+40,width*.62,23,3),scope=wrapped([p.data.scope&&`対象：${readable(p.data.scope)}`,p.data.out_of_scope&&`対象外：${readable(p.data.out_of_scope)}`].filter(Boolean).join('\n'),width*.67,y+24,width*.3,13,4,colors.muted);
    const h=Math.max(title.height+52,scope.height+32)+56;
    boxes.push({id:p.id,x:20,y,width:width-40,height:h,scope:[]});
    parts.push(`<g data-node="${esc(p.id)}" data-kind="product" role="button" tabindex="0" aria-label="${esc(p.name)}"><rect x="20" y="${y}" width="${width-40}" height="${h}" rx="5" fill="${related.has(p.id)?colors.selected:colors.ground}" stroke="${related.has(p.id)?colors.accent:colors.ground}"/>${text('Product · '+p.name,32,y+16,12,colors.muted)}${title.svg}${scope.svg}</g>`);
    const groups=reviewGroups(p);groups.forEach((g,i)=>review(p.id,g.id,24+i*(width-48)/groups.length,y+h-50,(width-48)/groups.length-8,g.name));
    y+=h+20;
  }
  columns.forEach((c,i)=>{parts.push(text(c.name,xs[i]+4,y+18,16));parts.push(wrapped(c.type,xs[i]+4,y+38,c.width-8,11,2,colors.muted).svg);});y+=74;
  const inlineShared=new Set(model.entities.filter(e=>e.kind!=='product'&&columnOf(e)>1&&scopes.get(e.id)!.size>1).map(e=>e.id));
  const grouped=new Map<string,Entity[]>();
  for(const e of model.entities.filter(e=>e.kind!=='product')){const k=key(e.id);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k)!.push(e);}
  const keys=[...grouped.keys()].sort((a,b)=>{const aa=JSON.parse(a) as string[],bb=JSON.parse(b) as string[];const rank=(s:string[])=>s.length===1?0:s.length>1?1:2;return rank(aa)-rank(bb)||(order.get(aa[0])??999)-(order.get(bb[0])??999)||a.localeCompare(b);});
  for(const k of keys){
    const entities=grouped.get(k)!.filter(e=>!inlineShared.has(e.id)),scope=JSON.parse(k) as string[],cap=scope.length===1?byId.get(scope[0]):undefined;
    if(!entities.length)continue;
    const caption=scope.length>1?'共有：'+scope.map(id=>byId.get(id)!.name).join(' / '):!scope.length?'未対応・所属範囲未確定':model.edges.filter(l=>l.to===cap!.id&&l.relation==='has'&&byId.get(l.from)?.kind==='product').map(l=>byId.get(l.from)!.name).join(' / ')||'Productへの所属未設定';
    const label=wrapped(caption,24,y+18,width-48,13,Infinity,colors.muted);parts.push(label.svg);y+=label.height+14;
    const start=y,ends:number[]=[];
    for(let col=0;col<columns.length;col++){
      const x=xs[col],w=columns[col].width;let cy=start;
      const own=entities.filter(e=>columnOf(e)===col&&!parents.has(e.id));
      function renderCards(items:Entity[]){
        if(col===5&&items.length>3){const cw=(w-10)/2;for(let i=0;i<items.length;i+=2){const pair=items.slice(i,i+2),height=Math.max(...pair.map(e=>headHeight(e,cw)));pair.forEach((e,j)=>card(e,x+j*(cw+10),cy,cw));cy+=height+12;}}
        else for(const e of items){cy+=col===0?tree(e,x,cy,w):(()=>{card(e,x,cy,w);return headHeight(e,w);})();cy+=12;}
      }
      if(cap&&col>1){
        const shared=model.entities.filter(e=>inlineShared.has(e.id)&&columnOf(e)===col&&sorted(scopes.get(e.id)!)[0]===cap.id);
        for(const sharedKey of [...new Set(shared.map(e=>key(e.id)))]){
          const ids=JSON.parse(sharedKey) as string[],label=ids.length===capabilities.length?'全機能に共通':'共有：'+ids.map(id=>byId.get(id)!.name).join(' / ');
          const caption=wrapped(label,x+4,cy+16,w-8,12,3,colors.muted);
          parts.push(`<g data-shared-row-target="${esc(sharedKey)}"><title>${esc(label)}</title><rect x="${x}" y="${cy}" width="${w}" height="${caption.height+10}" fill="transparent"/>${caption.svg}</g>`);cy+=caption.height+14;
          renderCards(shared.filter(e=>key(e.id)===sharedKey));
        }
        if(shared.length&&own.length){const caption=wrapped(cap.name+'に対応',x+4,cy+14,w-8,12,2,colors.muted);parts.push(caption.svg);cy+=caption.height+12;}
      }

      if(col===1&&cap){
        for(const group of mapQualityGroups){
          const qualities=own.filter(e=>group.attributes.includes(String(e.data.attribute)));
          const status=mapReviewSummary(model,cap.id,group.id);
          parts.push(`<g data-review-read="${esc(cap.id)}" data-review-group="${group.id}" role="button" tabindex="0" aria-label="${esc(group.name+'：'+status)}"><rect x="${x}" y="${cy}" width="${w}" height="36" fill="transparent"/>${text(group.name,x+8,cy+13,12,colors.muted)}${text(status,x+8,cy+30,11,status==='判断記録あり'?colors.muted:colors.warning)}</g>`);cy+=39;
          for(const q of qualities){card(q,x+4,cy,w-8);cy+=headHeight(q,w-8)+8;}
          const shared=model.entities.filter(e=>e.kind==='quality'&&group.attributes.includes(String(e.data.attribute))&&scopes.get(e.id)!.size>1&&scopes.get(e.id)!.has(cap.id));
          for(const q of shared)cy+=reference(q,x,cy,w);
          cy+=4;
        }
      }else {
        renderCards(own);
        if(cap&&col>1){
          const shared=model.entities.filter(e=>e.kind!=='product'&&columnOf(e)===col&&scopes.get(e.id)!.size>1&&scopes.get(e.id)!.has(cap.id)&&sorted(scopes.get(e.id)!)[0]!==cap.id);
          if(shared.length>3){
            const scopeKeys=[...new Set(shared.map(e=>key(e.id)))];
            for(const sharedKey of scopeKeys){const count=shared.filter(e=>key(e.id)===sharedKey).length;const caption=wrapped(`共通の${columns[col].name}（${count}要素）`,x+6,cy+17,w-12,13,2,colors.accent);parts.push(`<g data-shared-row="${esc(sharedKey)}" role="button" tabindex="0" aria-label="${esc('共通の'+columns[col].name+'を表示')}"><rect x="${x}" y="${cy}" width="${w}" height="${caption.height+10}" fill="transparent"/>${caption.svg}</g>`);cy+=caption.height+14;}
          }else for(const e of shared)cy+=reference(e,x,cy,w);
        }
        if(cy===start&&cap&&col>1){parts.push(text('対応する要素は未定義',x+6,cy+18,12,colors.muted));cy+=32;}
      }
      ends.push(cy);
    }
    const h=Math.max(120,...ends.map(end=>end-start))+14;
    rows.push({scope,x:16,y:start-6,width:width-32,height:h});y=start+h+32;
  }
  // Backgrounds precede nodes; every entity is rendered exactly once, including orphans.
  const backgrounds=rows.map(r=>`<g data-shared-row-target="${esc(JSON.stringify(r.scope))}"><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="8" fill="${colors.ground}" stroke="${colors.line}"/></g>`).join('');
  const height=Math.max(220,y+12);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="ArchModel 全体マップ" style="font-family:Inter,-apple-system,BlinkMacSystemFont,'Noto Sans JP',sans-serif"><title>ArchModel 全体マップ</title><rect width="100%" height="100%" fill="${colors.ground}"/>${backgrounds}${parts.join('')}</svg>`;
  return {svg,layout:{width,height,boxes,rows},scopes};
}
