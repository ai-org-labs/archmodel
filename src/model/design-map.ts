import schema from '../../schema/archmodel.schema.json';
import {laneLabel,type LaneLanguage} from './lane-labels.js';
import {fieldLabel,enumLabel,qualityCategories,qualityCategory,decisionCategories,policyCategories} from './presentation.js';
import { escapeXml } from '../focused/render.js';
import { wrapText } from '../focused/layout.js';
import { relatedIds, validateModel } from './analysis.js';
import type { Entity, Kind, Model, TraversalOptions } from './types.js';

export interface MapText { tone?:'title'|'field'|'body'; rotate?:number; text: string; x: number; y: number; size: number; weight: number; color: string }
export interface MapBox { summary?:string; itemKind?:Kind; itemType?:string; helpKey?:string; collapsed?:boolean; qualityAttribute?:string; decisionCategory?:string; policyCategory?:string; capabilityId?:string; key: string; entityId?: string; parent?: string; role: string; x: number; y: number; width: number; height: number; fill: string; stroke: string; text: MapText[] }
export interface MapRow { capabilityId?: string; y: number; height: number }
export interface DesignMap { width: number; height: number; boxes: MapBox[]; rows: MapRow[] }
export interface DesignMapOptions { collapsedBehaviorIds?:readonly string[]; collapsedCapabilityIds?:readonly string[]; language?:LaneLanguage; selectedId?: string; showRelations?: boolean; expanded?: boolean; scope?: TraversalOptions }
const GAP=12, PAD=14, HEADER=58, FONT=14, LINE=20;
const baseWidths=[196,744,232,216,232,240,264];
const qualityLaneWidth=204,EMPTY_LANE=36;
const compactContent=(label:string):Content=>({height:240,text:[{text:label,tone:'title',x:12,y:48,size:13,weight:650,color:'#30343b',rotate:90}]});
const laneKeys=['product','capability','quality','policy','decision','component','realization'];
// Surface colors follow roles: blue-gray containers and warm paper content.
const fills={lane:'#e1f2ef',capability:'#e1f2ef',meta:'#fffdf8',behavior:'#e1f2ef',detail:'#fffdf8',scenario:'#fffdf8',card:'#fffdf8'};

const asText=(v:unknown)=>Array.isArray(v)?v.join(' / '):String(v??'—');
type Content = { height:number; text:MapText[] };
function content(width:number,title:string,fields:Array<[string,unknown]>,size=FONT,kind?:Kind):Content{
 const text:MapText[]=[];let y=PAD;
 const lines=(value:string,fontSize:number,weight:number,color:string,tone:MapText['tone']='body')=>{
  for(const line of wrapText(value,width-PAD*2,fontSize)){y+=LINE;text.push({text:line,x:PAD,y,size:fontSize,weight,color,tone});}
 };
 if(title){lines(title,size+1,650,'#30343b','title');y+=8;}
 for(const [key,value]of fields){
  if(key){lines(fieldLabel(key,kind),11,500,'#667b85','field');y+=1;}
  lines(asText(value),size,400,value===undefined?'#78878d':'#415763');y+=9;
 }
 return {height:y+PAD-5,text};
}
function qualitySummary(entity:Entity,language:LaneLanguage='en'):string{
 const attribute=String(entity.data.attribute??'');
 const specific:Record<string,[string,string]>={availability:['Availability','可用性'],resilience:['Resilience','耐障害性'],recoverability:['Recoverability','復旧性'],performance:['Performance','性能'],scalability:['Scalability','拡張性'],security:['Security','セキュリティ'],privacy:['Privacy','プライバシー'],observability:['Observability','可観測性'],audit:['Audit','監査'],testability:['Testability','テスト容易性'],accessibility:['Accessibility','アクセシビリティ'],deployment:['Deployment','配備'],migration:['Migration','移行']};
 const label=specific[attribute]?.[language==='ja'?1:0]??(attribute?laneLabel(attribute,language):entity.name);
 const value=entity.data.target!==undefined?`${entity.data.target}${entity.data.unit??''}`:entity.data.level!==undefined?String(entity.data.level):String(entity.data.requirement??entity.name);
 return `${label}: ${value}`;
}
const listHeight=(items:Content[])=>items.reduce((sum,c)=>sum+c.height,0)+Math.max(0,items.length-1)*GAP;
export function computeDesignMap(model:Model,options:DesignMapOptions={}):DesignMap{
 const label=(key:string)=>laneLabel(key,options.language);
 const errors=validateModel(model).filter(d=>d.severity==='error');
 if(errors.length)throw new Error(errors.map(d=>`${d.path}: ${d.message}`).join('\n'));
 const present=(...kinds:Kind[])=>model.entities.some(e=>kinds.includes(e.kind));
 const qualityKeys=[...Object.keys(qualityCategories),...(model.entities.some(e=>e.kind==='quality'&&!e.data.attribute)?['unspecified']:[])];
 const qWidth=(key:string)=>model.entities.some(e=>e.kind==='quality'&&qualityCategory(e.data.attribute)===key)?qualityLaneWidth:EMPTY_LANE;
 const widths=[...baseWidths];
 const populated=[present('product'),present('capability','behavior','scenario'),present('quality'),present('policy'),present('decision'),present('component','contract'),present('realization','verification','evidence')];
 for(let i=0;i<widths.length;i++)if(!populated[i])widths[i]=EMPTY_LANE;
 if(populated[1])widths[1]=present('scenario')?744:present('behavior')?474:280;
 if(populated[2])widths[2]=PAD*2+qualityKeys.reduce((sum,k)=>sum+qWidth(k),0)+(qualityKeys.length-1)*GAP;
 const decisionKeys=[...Object.keys(decisionCategories),...new Set(model.entities.filter(e=>e.kind==='decision').map(e=>String(e.data.category??'unspecified')).filter(k=>!decisionCategories[k]))];
 const decisionLaneWidth=232;
 const dWidth=(key:string)=>model.entities.some(e=>e.kind==='decision'&&String(e.data.category??'unspecified')===key)?decisionLaneWidth:EMPTY_LANE;
 if(populated[4])widths[4]=PAD*2+decisionKeys.reduce((sum,k)=>sum+dWidth(k),0)+(decisionKeys.length-1)*GAP;
 const policyKeys=[...Object.keys(policyCategories),...new Set(model.entities.filter(e=>e.kind==='policy').map(e=>String(e.data.category??'unspecified')).filter(k=>!policyCategories[k]))];
 const policyLaneWidth=232;
 const pWidth=(key:string)=>model.entities.some(e=>e.kind==='policy'&&String(e.data.category??'unspecified')===key)?policyLaneWidth:EMPTY_LANE;
 if(populated[3])widths[3]=PAD*2+policyKeys.reduce((sum,k)=>sum+pWidth(k),0)+(policyKeys.length-1)*GAP;
 const technicalKinds:string[]=schema.$defs.realization.properties.kind.enum;
 const logicalKinds:string[]=schema.$defs.component.properties.kind.enum;
 const groupKey=(e:Entity)=>e.kind==='component'||e.kind==='realization'?String(e.data.kind??'unspecified'):e.kind;
 const groupedColumns=[{col:5,entityKind:'component' as Kind,keys:[...logicalKinds,'contract']},{col:6,entityKind:'realization' as Kind,keys:[...technicalKinds,'verification','evidence']}].map(config=>{
  const entities=model.entities.filter(e=>config.col===5?['component','contract'].includes(e.kind):['realization','verification','evidence'].includes(e.kind));
  const keys=[...config.keys,...new Set(entities.map(groupKey).filter(k=>!config.keys.includes(k)))];
  const groups=keys.map(key=>({key,entities:entities.filter(e=>groupKey(e)===key),width:entities.some(e=>groupKey(e)===key)?240:EMPTY_LANE}));
  if(populated[config.col])widths[config.col]=PAD*2+groups.reduce((sum,g)=>sum+g.width,0)+GAP*(groups.length-1);
  return {...config,groups};
 });
 const boxes:MapBox[]=[];const rows:MapRow[]=[];let serial=0;
 const byId=new Map(model.entities.map(e=>[e.id,e]));
 const kind=(k:Kind)=>model.entities.filter(e=>e.kind===k);
 const children=(id:string,k:Kind)=>model.edges.filter(e=>e.from===id&&e.relation==='has').map(e=>byId.get(e.to)!).filter(e=>e.kind===k);
 const x=widths.map((_,i)=>PAD+widths.slice(0,i).reduce((s,w)=>s+w+GAP,0));
 const add=(role:string,bx:number,by:number,width:number,height:number,fill:string,c:Content={height:0,text:[]},entity?:Entity,parent?:string):MapBox=>{
  const box:MapBox={key:`map-${serial++}`,entityId:entity?.id,parent,role,x:bx,y:by,width,height,fill,stroke:role==='lane'?'#acd4cf':['capability','behavior','quality-profile','quality-category','policy-category','decision-category','component-category','realization-category','empty-behavior','empty-scenario'].includes(role)?'#bcddd7':'none',text:c.text.map(t=>{if(t.tone!=='title')return {...t};const top=role==='lane';const category=role.endsWith('-category')||role==='quality-profile';return {...t,color:top?'#263e4b':t.rotate?'#627984':category?'#526c7a':'#304b5a',weight:top?700:t.rotate?500:category?550:600};})};boxes.push(box);return box;
 };
 const dataFields=(e:Entity,fields:string[])=>fields.map(key=>[key,e.data[key]] as [string,unknown]);
 const capW=populated[1]?widths[1]:baseWidths[1], metaW=202, behaviorW=capW-PAD*3-metaW, detailW=156, scenarioW=behaviorW-PAD*3-detailW;
 const scenarioContent=(s:Entity)=>content(scenarioW,s.name,options.expanded?[['',s.data.specification]]:[['',s.data.type?enumLabel('scenario','type',s.data.type):'type 未定義']],13);
 const behaviorPlan=(e:Entity)=>{
  const collapsed=!!options.collapsedBehaviorIds?.includes(e.id);
  const scenarios=children(e.id,'scenario');
  const details=content(detailW,'',dataFields(e,options.expanded?['use_cases','commands','events','trigger','outcomes']:['use_cases','commands','events']),13);
  const title=content(behaviorW-64,e.name,[]);
  const sc=scenarios.map(scenarioContent);
  const h=title.height+Math.max(details.height,listHeight(sc),160)+PAD;
  return {entity:e,scenarios,details,title,sc,collapsed,height:collapsed?44:h};
 };
 const attachedBehavior=new Set(model.edges.filter(e=>e.relation==='has'&&byId.get(e.from)?.kind==='capability').map(e=>e.to));
 const attachedScenario=new Set(model.edges.filter(e=>e.relation==='has'&&byId.get(e.from)?.kind==='behavior').map(e=>e.to));
 const attachedQuality=new Set(model.edges.filter(e=>e.relation==='has'&&byId.get(e.from)?.kind==='capability').map(e=>e.to));
 const orphanBehaviors=kind('behavior').filter(e=>!attachedBehavior.has(e.id));
 const orphanScenarios=kind('scenario').filter(e=>!attachedScenario.has(e.id));
 const orphanQualities=kind('quality').filter(e=>!attachedQuality.has(e.id));
 const plans=kind('capability').map(cap=>({cap,behaviors:children(cap.id,'behavior').map(behaviorPlan),qualities:children(cap.id,'quality'),looseScenarios:[] as Entity[]}));
 if(!plans.length||orphanBehaviors.length||orphanScenarios.length||orphanQualities.length)plans.push({cap:undefined as unknown as Entity,behaviors:orphanBehaviors.map(behaviorPlan),qualities:orphanQualities,looseScenarios:orphanScenarios});
 const qualityContent=(e:Entity)=>content(qualityLaneWidth-PAD*2,e.name,[['',e.data.requirement],...(e.data.target!==undefined?[['target',`${e.data.target}${e.data.unit??''}`] as [string,unknown]]:[]),...(e.data.level?[['level',e.data.level] as [string,unknown]]:[])],FONT,'quality');
 if(populated[2])widths[2]=Math.max(widths[2],...plans.filter(p=>p.cap&&options.collapsedCapabilityIds?.includes(p.cap.id)).map(p=>PAD*2+p.qualities.length*160+Math.max(0,p.qualities.length-1)*GAP));
 // Summary width is a view concern; update following lane positions accordingly.
 for(let i=0;i<x.length;i++)x[i]=PAD+widths.slice(0,i).reduce((sum,w)=>sum+w+GAP,0);
 const rowPlans=plans.map(p=>{
  const collapsed=!!p.cap&&!!options.collapsedCapabilityIds?.includes(p.cap.id);
  const meta=content(metaW,'',p.cap?dataFields(p.cap,['actor','inputs','outputs','guarantees','constraints']):[['Capability','上位の能力を定義してください']]);
  const title=content(capW-64,p.cap?.name??'未所属 / これから定義',[]);
  const attributes=Object.keys(qualityCategories);
  if(p.qualities.some(e=>!e.data.attribute))attributes.push('unspecified');
  const groups=attributes.map(attribute=>{const entities=p.qualities.filter(e=>qualityCategory(e.data.attribute)===attribute);const cards=entities.map(qualityContent);return {attribute,entities,cards,height:94+(cards.length?listHeight(cards)+PAD:0)};});
  const qualityHeight=Math.max(...groups.map(g=>g.height));
  const loose=p.looseScenarios.map(scenarioContent);
  const qualityTitle=content(populated[2]?widths[2]:baseWidths[2],p.cap?label('quality')+' · '+p.cap.name:(options.language==='ja'?'未所属の品質要求':'Unassigned Quality'),[]);
  const h=Math.max(title.height+Math.max(meta.height,listHeight(p.behaviors.map(b=>({height:b.height,text:[]})))+listHeight(loose)+(loose.length?GAP:0))+PAD,Math.max(HEADER,qualityTitle.height)+qualityHeight+PAD,360);
  return {...p,meta,title,groups,loose,collapsed,height:collapsed?44:h};
 });
 const productCards=kind('product').map(e=>({e,c:content(widths[0]-PAD*2,e.name,dataFields(e,['purpose','primary_users','user_value','scope','out_of_scope','owner']))}));
 const sideFields:Partial<Record<Kind,string[]>>={policy:['rules'],decision:['category','decision','reason','trade_off'],component:['responsibilities','provides','consumes'],contract:['kind','specification'],realization:['service','location'],verification:['level','method','result'],evidence:['location','result']};
 const side=(entities:Entity[],col:number)=>entities.map(e=>{
  let fields:Array<[string,unknown]>=[['',e.kind==='realization'?e.data.kind:e.kind==='component'?e.data.kind:e.kind],...dataFields(e,sideFields[e.kind]??[]).filter(([,v])=>v!==undefined)];
  if(!options.expanded&&e.kind==='realization')fields=[['',[e.data.kind,e.data.service??e.data.location].filter(Boolean).join(' · ')]];
  if(!options.expanded&&e.kind==='verification')fields=[['',`${e.data.level??'level 未定義'} · ${e.data.result==='passed'?'passed':e.data.result==='failed'?'failed':'unknown（未実施）'}`]];
  return {e,c:content((col===3?policyLaneWidth-PAD*2:col===4?decisionLaneWidth-PAD*2:col>=5?240-PAD*2:widths[col]-PAD*2),e.name,fields,FONT,e.kind)};
 });
 const columns=[productCards,[],[],[],[],side([...kind('component'),...kind('contract')],5),side([...kind('realization'),...kind('verification'),...kind('evidence')],6)];
 const sideGroups=groupedColumns.map(config=>({...config,groups:config.groups.map(g=>({...g,cards:side(g.entities,config.col)}))}));
 const sideHeight=Math.max(0,...sideGroups.filter(g=>populated[g.col]).flatMap(g=>g.groups.map(group=>Math.max(260,94+listHeight(group.cards.map(c=>c.c))+PAD))));
 const decisionGroups=decisionKeys.map(category=>({category,cards:side(kind('decision').filter(e=>String(e.data.category??'unspecified')===category),4)}));
 const decisionHeight=Math.max(...decisionGroups.map(g=>94+listHeight(g.cards.map(c=>c.c))+PAD));
 const policyGroups=policyKeys.map(category=>({category,cards:side(kind('policy').filter(e=>String(e.data.category??'unspecified')===category),3)}));
 const policyHeight=Math.max(...policyGroups.map(g=>94+listHeight(g.cards.map(c=>c.c))+PAD));
 const naturalRows=rowPlans.reduce((s,p)=>s+p.height,0)+GAP*Math.max(0,rowPlans.length-1);
 const bodyHeight=Math.max(naturalRows,decisionHeight,policyHeight,sideHeight,listHeight(productCards.map(c=>c.c))+PAD*2);

 const height=bodyHeight+HEADER+PAD*2;
 // Seven persistent lanes; all figures are projections of IDs in the same semantic graph.
 laneKeys.forEach((key,i)=>{const title=label(key);const lane=add('lane',x[i],PAD,widths[i],height-PAD*2,fills.lane,populated[i]?content(widths[i],title,[]):compactContent(title));lane.collapsed=!populated[i];lane.helpKey=key;});
 for(const col of [0]){
  let y=PAD+HEADER;
  for(const item of columns[col]){add(item.e.kind,x[col]+PAD,y,widths[col]-PAD*2,item.c.height,fills.card,item.c,item.e);y+=item.c.height+GAP;}

 }
 for(const [index,g]of (populated[4]?decisionGroups:[]).entries()){
  const dx=x[4]+PAD+decisionKeys.slice(0,index).reduce((sum,k)=>sum+dWidth(k)+GAP,0),dy=PAD+HEADER;
  const key=g.category==='quality'?'decision_quality':g.category;const title=label(key);const lane=add('decision-category',dx,dy,dWidth(g.category),bodyHeight,fills.capability,g.cards.length?content(decisionLaneWidth-44,title,[],12):compactContent(title));lane.collapsed=!g.cards.length;lane.decisionCategory=g.category;lane.helpKey=key;
  let cy=dy+94;
  for(const item of g.cards){add('decision',dx+PAD,cy,decisionLaneWidth-PAD*2,item.c.height,fills.meta,item.c,item.e,lane.key);cy+=item.c.height+GAP;}
 }
 for(const [index,g]of (populated[3]?policyGroups:[]).entries()){
  const dx=x[3]+PAD+policyKeys.slice(0,index).reduce((sum,k)=>sum+pWidth(k)+GAP,0),dy=PAD+HEADER;
  const title=label(g.category);const lane=add('policy-category',dx,dy,pWidth(g.category),bodyHeight,fills.capability,g.cards.length?content(policyLaneWidth-44,title,[],12):compactContent(title));lane.collapsed=!g.cards.length;lane.policyCategory=g.category;lane.helpKey=g.category;
  let cy=dy+94;
  for(const item of g.cards){add('policy',dx+PAD,cy,policyLaneWidth-PAD*2,item.c.height,fills.meta,item.c,item.e,lane.key);cy+=item.c.height+GAP;}
 }
 for(const config of sideGroups.filter(g=>populated[g.col])){
  let gx=x[config.col]+PAD;
  for(const group of config.groups){
   const key=(config.col===5?'logical_':'technical_')+group.key;
   const title=group.key==='unspecified'?label('unspecified'):label(key);
   const lane=add(config.col===5?'component-category':'realization-category',gx,PAD+HEADER,group.width,bodyHeight,fills.lane,group.cards.length?content(group.width-40,title,[],12):compactContent(title));
   lane.collapsed=!group.cards.length;lane.helpKey=group.key==='unspecified'?'unspecified':key;
   lane.itemKind=['contract','verification','evidence'].includes(group.key)?group.key as Kind:config.entityKind;
   lane.itemType=lane.itemKind===config.entityKind&&group.key!=='unspecified'?group.key:undefined;
   let cy=PAD+HEADER+94;
   for(const item of group.cards){add(item.e.kind,gx+PAD,cy,group.width-PAD*2,item.c.height,fills.card,item.c,item.e,lane.key);cy+=item.c.height+GAP;}
   gx+=group.width+GAP;
  }
 }
 const singleLine=(title:string,width:number):Content=>{const lines=wrapText(title,width-80,15);return {height:44,text:[{text:lines[0]+(lines.length>1?'…':''),tone:'title',x:40,y:28,size:15,weight:600,color:'#304b5a'}]};};
 let y=PAD+HEADER;
 for(const p of rowPlans){
  const rowHeight=p.height;rows.push({capabilityId:p.cap?.id,y,height:rowHeight});
  if(p.collapsed){
   const cap=add('capability',x[1],y,capW,rowHeight,fills.capability,singleLine(p.cap.name,capW),p.cap);cap.collapsed=true;
   if(populated[2]){
    const q=add('quality-profile',x[2],y,widths[2],rowHeight,fills.capability,p.qualities.length?undefined:singleLine(options.language==='ja'?'品質要求なし':'No quality requirements',widths[2]),p.cap);q.collapsed=true;
    const width=(widths[2]-PAD*2-Math.max(0,p.qualities.length-1)*GAP)/Math.max(1,p.qualities.length);
    p.qualities.forEach((quality,index)=>{const summary=qualitySummary(quality,options.language);const lines=wrapText(summary,width-16,12);const chip=add('quality-summary',x[2]+PAD+index*(width+GAP),y+6,width,32,fills.card,{height:32,text:[{text:lines[0]+(lines.length>1?'…':''),x:8,y:21,size:12,weight:500,color:'#304b5a',tone:'body'}]},quality,q.key);chip.summary=summary;});
   }
   y+=rowHeight+GAP;continue;
  }
  if(populated[1]){
  const cap=add('capability',x[1],y,capW,rowHeight,fills.capability,{...p.title,text:p.title.text.map(t=>({...t,x:t.x+26}))},p.cap);
  const contentY=y+p.title.height;
  add('capability-fields',x[1]+PAD,contentY,metaW,rowHeight-p.title.height-PAD,fills.meta,p.meta,p.cap,cap.key);
  let by=contentY;
  for(const b of p.behaviors){
   const bx=x[1]+metaW+PAD*2;
   const behavior=add('behavior',bx,by,behaviorW,b.height,fills.behavior,b.collapsed?singleLine(b.entity.name,behaviorW):{...b.title,text:b.title.text.map(t=>({...t,x:t.x+26}))},b.entity,cap.key);
   behavior.collapsed=b.collapsed;
   if(b.collapsed){by+=b.height+GAP;continue;}
   add('behavior-fields',bx+PAD,by+b.title.height,detailW,b.height-b.title.height-PAD,fills.detail,b.details,b.entity,behavior.key);
   let sy=by+b.title.height;
   for(let i=0;i<b.scenarios.length;i++){
    add('scenario',bx+PAD*2+detailW,sy,scenarioW,b.sc[i].height,fills.scenario,b.sc[i],b.scenarios[i],behavior.key);sy+=b.sc[i].height+GAP;
   }
   if(!b.scenarios.length){const empty=add('empty-scenario',bx+PAD*2+detailW,sy,EMPTY_LANE,Math.max(160,b.height-b.title.height-PAD),fills.lane,compactContent(label('scenario')),b.entity,behavior.key);empty.collapsed=true;empty.helpKey=empty.role==='empty-scenario'?'scenario':'behavior';}
   by+=b.height+GAP;
  }
  for(let i=0;i<p.looseScenarios.length;i++){add('scenario',x[1]+PAD*2+metaW,by,scenarioW,p.loose[i].height,fills.scenario,p.loose[i],p.looseScenarios[i],cap.key);by+=p.loose[i].height+GAP;}
  if(!p.behaviors.length&&!p.looseScenarios.length){const empty=add('empty-behavior',x[1]+PAD*2+metaW,by,EMPTY_LANE,rowHeight-p.title.height-PAD,fills.behavior,compactContent(label('behavior')),p.cap,cap.key);empty.collapsed=true;empty.helpKey=empty.role==='empty-scenario'?'scenario':'behavior';}
  }
  if(populated[2]){
  const quality=add('quality-profile',x[2],y,widths[2],rowHeight,fills.capability,content(widths[2],p.cap?label('quality')+' · '+p.cap.name:(options.language==='ja'?'未所属の品質要求':'Unassigned Quality'),[]),p.cap);
  const qy=y+Math.max(HEADER,content(widths[2],p.cap?label('quality')+' · '+p.cap.name:(options.language==='ja'?'未所属の品質要求':'Unassigned Quality'),[]).height);
  for(const [index,group] of p.groups.entries()){
   const qx=x[2]+PAD+p.groups.slice(0,index).reduce((sum,g)=>sum+(g.cards.length?qualityLaneWidth:EMPTY_LANE)+GAP,0);
   const title=label(group.attribute);
   const category=add('quality-category',qx,qy,group.cards.length?qualityLaneWidth:EMPTY_LANE,y+rowHeight-PAD-qy,fills.lane,!group.cards.length?compactContent(title):content(qualityLaneWidth-44,title,[],12),undefined,quality.key);
   category.collapsed=!group.cards.length;category.helpKey=group.attribute;category.qualityAttribute=group.attribute;category.capabilityId=p.cap?.id;
   let cy=qy+94;
   for(let i=0;i<group.entities.length;i++){add('quality',qx+PAD,cy,qualityLaneWidth-PAD*2,group.cards[i].height,fills.card,group.cards[i],group.entities[i],category.key);cy+=group.cards[i].height+GAP;}
  }
  }
  y+=rowHeight+GAP;
 }
 return {width:x[6]+widths[6]+PAD,height,boxes,rows};
}
export function designMapSelection(model:Model,id:string,scope:TraversalOptions={depth:3,direction:'forward'}):Set<string>{
 return relatedIds(model,id,scope);
}
export function renderDesignMap(model:Model,options:DesignMapOptions={}){
 const layout=computeDesignMap(model,options);
 const selected=options.selectedId?designMapSelection(model,options.selectedId,options.scope):undefined;
 const text=(t:MapText)=>`<text x="${t.x}" y="${t.y}" transform="${t.rotate?`rotate(${t.rotate} ${t.x} ${t.y})`: ''}" data-text-tone="${t.tone??'body'}" font-size="${t.size}" font-weight="${t.weight}" fill="${t.color}">${escapeXml(t.text)}</text>`;
 const boxes=layout.boxes.map(b=>{
  const active=b.entityId===options.selectedId,structural=['lane','capability','behavior','quality-profile'].includes(b.role);
  const opacity=selected&&b.entityId&&!selected.has(b.entityId)&&!structural ? 0.34 : 1;
  const heading=b.role==='lane'&&!b.collapsed?`<path d="M 5 0 H ${b.width-5} Q ${b.width} 0 ${b.width} 5 V ${HEADER-10} H 0 V 5 Q 0 0 5 0 Z" fill="#137f88"/>`:'';
  return `<g data-map-key="${b.key}" data-role="${b.role}" ${b.itemKind?`data-item-kind="${b.itemKind}" ${b.itemType?`data-item-type="${escapeXml(b.itemType)}"`:''}`:''} ${b.helpKey?`data-help-key="${escapeXml(b.helpKey)}"`:''} data-collapsed="${!!b.collapsed}" ${b.policyCategory?`data-policy-category="${escapeXml(b.policyCategory)}"`:''} ${b.decisionCategory?`data-decision-category="${escapeXml(b.decisionCategory)}"`:''} ${b.qualityAttribute?`data-quality-attribute="${b.qualityAttribute}" ${b.capabilityId?`data-capability="${escapeXml(b.capabilityId)}"`:''}`:''} ${b.entityId?`data-node="${escapeXml(b.entityId)}" role="button" tabindex="0" aria-label="${escapeXml(model.entities.find(e=>e.id===b.entityId)?.name??b.entityId)}"`:''} transform="translate(${b.x} ${b.y})" opacity="${opacity}"><rect width="${b.width}" height="${b.height}" rx="${b.role==='lane'?5:4}" fill="${b.fill}" stroke="${active?'#426b91':b.stroke}" stroke-width="${active?2:1}" vector-effect="non-scaling-stroke"/>${b.summary?`<title>${escapeXml(b.summary)}</title>`:''}${heading}${b.text.map(t=>text(b.role==='lane'&&!b.collapsed?{...t,color:'#fffdf8'}:t)).join('')}</g>`;
 }).join('');
 const links:string[]=[];
 if(options.showRelations&&options.selectedId){
  const anchor=(id:string)=>layout.boxes.find(b=>b.entityId===id&&!['capability-fields','behavior-fields','quality-profile'].includes(b.role));
  for(const edge of model.edges.filter(e=>selected?.has(e.from)&&selected.has(e.to)&&(options.scope?.relationTypes??['has','realizedBy','implementedBy','verifiedBy','uses','provides','consumes']).includes(e.relation))){
   const a=anchor(edge.from),b=anchor(edge.to);if(!a||!b)continue;
   const ax=a.x+a.width,ay=a.y+Math.min(28,a.height/2),bx=b.x,by=b.y+Math.min(28,b.height/2);
   links.push(`<path d="M ${ax} ${ay} C ${ax+40} ${ay}, ${bx-40} ${by}, ${bx} ${by}" fill="none" stroke="#426b91" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#map-arrow)"><title>${escapeXml(edge.relation)}</title></path>`);
  }
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Productから技術実現までの設計マップ" style="font-family:Inter,Arial,'Noto Sans JP',sans-serif"><title>ArchModel Design Map</title><defs><marker id="map-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#426b91"/></marker></defs><rect width="100%" height="100%" fill="#f5f2ea"/>${boxes}<g pointer-events="none">${links.join('')}</g></svg>`;
 return {svg,layout};
}
