import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {computeDesignMap,renderDesignMap,designMapSelection,parseModel,validateModel} from '../src/index.js';
const sample=readFileSync('syntax/examples/design-map.archmodel.yaml','utf8');
const model=()=>parseModel(sample);
describe('design map follows the reference structure',()=>{
 it('keeps seven lanes, including a full-height Product and cross-cutting design',()=>{
  const m=model();expect(validateModel(m)).toEqual([]);
  const layout=computeDesignMap(m),lanes=layout.boxes.filter(b=>b.role==='lane');
  expect(lanes).toHaveLength(7);expect(new Set(lanes.map(b=>b.height)).size).toBe(1);
  expect(lanes.map(b=>b.text[0].text)).toEqual(['Product','Capability','Quality','Policy','Decision','Component','Realization']);
 });
 it('nests Behavior in Capability and Scenario in Behavior; aligns each Quality row',()=>{
  const layout=computeDesignMap(model());expect(layout.rows).toHaveLength(2);
  for(const row of layout.rows){
   const cap=layout.boxes.find(b=>b.entityId===row.capabilityId&&b.role==='capability')!;
   const quality=layout.boxes.find(b=>b.entityId===row.capabilityId&&b.role==='quality-profile')!;
   expect(quality.y).toBe(cap.y);expect(quality.height).toBe(cap.height);
  }
  for(const b of layout.boxes.filter(b=>b.parent)){
   const p=layout.boxes.find(p=>p.key===b.parent)!;
   expect(b.x).toBeGreaterThanOrEqual(p.x);expect(b.y).toBeGreaterThanOrEqual(p.y);
   expect(b.x+b.width).toBeLessThanOrEqual(p.x+p.width+.01);expect(b.y+b.height).toBeLessThanOrEqual(p.y+p.height+.01);
  }
 });
 it.each([false,true])('fits content within boxes and preserves all IDs, expanded=%s',expanded=>{
  const m=model(),layout=computeDesignMap(m,{expanded});
  for(const e of m.entities)expect(layout.boxes.some(b=>b.entityId===e.id),e.id).toBe(true);
  for(const b of layout.boxes){
   expect(b.x+b.width).toBeLessThanOrEqual(layout.width);expect(b.y+b.height).toBeLessThanOrEqual(layout.height);
   for(const t of b.text)expect(t.y,b.role+' / '+t.text).toBeLessThanOrEqual(b.height);
  }
  const before=JSON.stringify(m);renderDesignMap(m,{expanded});expect(JSON.stringify(m)).toBe(before);
 });
 it('shows Gherkin text when expanded; selected relations are optional',()=>{
  const compact=renderDesignMap(model()),expanded=renderDesignMap(model(),{expanded:true});
  expect(expanded.svg).toContain('Given');expect(expanded.layout.height).toBeGreaterThanOrEqual(compact.layout.height);
  expect(compact.svg).not.toContain('marker-end=');
  expect(renderDesignMap(model(),{selectedId:'auth-service',showRelations:true}).svg).toContain('marker-end=');
 });
 it('highlights a capability’s scenarios, quality, shared components and technical realizations',()=>{
  const selected=designMapSelection(model(),'profile-management');
  for(const id of ['profile-found','profile-performance','profile-service','audit-service','profile-runtime'])expect(selected.has(id),id).toBe(true);
  expect(selected.has('login-success')).toBe(false);expect(selected.has('customer-platform')).toBe(false);
 });
 it('retains shared and unowned elements rather than silently hiding them',()=>{
  const m=parseModel("version: '0.1'\nproducts: [{id: p, has: [a,b]}]\ncapabilities: [{id: a, behaviors: [x]}, {id: b, behaviors: [x]}]\nbehaviors: [{id: x}, {id: orphan}]\nscenarios: [{id: s, type: gherkin, specification: 'Given test'}]\nqualities: [{id: q}]\nrealizations: [{id: r}]");
  const layout=computeDesignMap(m);
  expect(layout.boxes.filter(b=>b.role==='behavior'&&b.entityId==='x')).toHaveLength(2);
  for(const id of ['orphan','s','q','r'])expect(layout.boxes.some(b=>b.entityId===id)).toBe(true);
 });
 it('escapes model text in export and expands long labels without clipping',()=>{
  const m=parseModel("version: '0.1'\nproduct: {id: p, name: '<script>alert(1)</script>'}\ncapabilities: [{id: c, name: '非常に長い能力の名前が折り返して表示されることを確認します', quality: {security: {id: q, requirement: '安全な認証'}}}]");
  const {svg,layout}=renderDesignMap(m);expect(svg).not.toContain('<script>');expect(svg).toContain('&lt;script&gt;');
  for(const b of layout.boxes)for(const t of b.text)expect(t.y).toBeLessThanOrEqual(b.height);
 });
});

it('groups quality requirements into category lanes without duplicating semantic nodes',()=>{
 const m=parseModel("version: '0.1'\ncapabilities: [{id: c, qualities: [q1,q2]}]\nqualities: [{id: q1, attribute: availability}, {id: q2, attribute: security}, {id: q3}]");
 const layout=computeDesignMap(m),groups=layout.boxes.filter(b=>b.role==='quality-category');
 const owned=groups.filter(b=>b.capabilityId==='c');
 expect(owned).toHaveLength(9);
 expect(new Set(owned.map(b=>b.y)).size).toBe(1);
 for(let i=1;i<owned.length;i++)expect(owned[i].x).toBeGreaterThanOrEqual(owned[i-1].x+owned[i-1].width);
 for(const [id,attribute]of [['q1','reliability'],['q2','security'],['q3','unspecified']]){
  const card=layout.boxes.find(b=>b.role==='quality'&&b.entityId===id)!;
  const parent=groups.find(b=>b.key===card.parent)!;
  expect(parent.qualityAttribute).toBe(attribute);
  expect(card.y+card.height).toBeLessThanOrEqual(parent.y+parent.height);
 }
 expect(renderDesignMap(m).svg).toContain('data-quality-attribute="reliability"');
});

it('groups design decisions horizontally and retains custom and unclassified categories',()=>{
 const m=parseModel("version: '0.1'\ndecisions: [{id: d1, category: cost}, {id: d2, category: sustainability}, {id: d3}]");
 const layout=computeDesignMap(m),groups=layout.boxes.filter(b=>b.role==='decision-category');
 expect(groups).toHaveLength(7);expect(new Set(groups.map(b=>b.y)).size).toBe(1);
 for(const [id,category]of [['d1','cost'],['d2','sustainability'],['d3','unspecified']]){
  const card=layout.boxes.find(b=>b.entityId===id)!;const parent=groups.find(b=>b.key===card.parent)!;
  expect(parent.decisionCategory).toBe(category);expect(card.x+card.width).toBeLessThanOrEqual(parent.x+parent.width);expect(card.y+card.height).toBeLessThanOrEqual(parent.y+parent.height);
 }
});

it('uses one-line-wide rotated empty lanes and expands populated lanes',()=>{
 const empty=computeDesignMap(parseModel("version: '0.1'"));
 expect(empty.boxes.filter(b=>b.role==='lane')).toHaveLength(7);
 for(const lane of empty.boxes.filter(b=>b.role==='lane')){expect(lane.collapsed).toBe(true);expect(lane.width).toBe(36);expect(lane.text[0].rotate).toBe(90);}
 expect(empty.boxes.some(b=>b.role==='placeholder')).toBe(false);
 const filled=computeDesignMap(parseModel("version: '0.1'\nproducts: [{id: p, name: Product}]"));
 expect(filled.boxes.find(b=>b.role==='lane')!.width).toBeGreaterThan(36);
});
it('collapses each empty category independently of other capability rows',()=>{
 const layout=computeDesignMap(parseModel("version: '0.1'\ncapabilities: [{id: a, qualities: [q]}, {id: b}]\nqualities: [{id: q, attribute: availability}]\ndecisions: [{id: d, category: runtime}]"));
 const qa=layout.boxes.find(b=>b.qualityAttribute==='reliability'&&b.capabilityId==='a')!;
 const qb=layout.boxes.find(b=>b.qualityAttribute==='reliability'&&b.capabilityId==='b')!;
 expect(qa.width).toBeGreaterThan(qb.width);expect(qb.collapsed).toBe(true);
 for(const lane of layout.boxes.filter(b=>b.decisionCategory))expect(lane.collapsed).toBe(lane.decisionCategory!=='runtime');
});

it('groups policies into six categories and preserves unclassified and custom policies',()=>{
 const m=parseModel("version: '0.1'\npolicies: [{id: a, category: security_baseline}, {id: b, category: custom}, {id: c}]");
 const layout=computeDesignMap(m),groups=layout.boxes.filter(b=>b.role==='policy-category');
 expect(groups).toHaveLength(8);expect(new Set(groups.map(b=>b.y)).size).toBe(1);
 for(const [id,key]of [['a','security_baseline'],['b','custom'],['c','unspecified']]){
  const card=layout.boxes.find(b=>b.entityId===id)!;const lane=groups.find(b=>b.key===card.parent)!;
  expect(lane.policyCategory).toBe(key);expect(lane.collapsed).toBe(false);expect(card.x+card.width).toBeLessThanOrEqual(lane.x+lane.width);expect(card.y+card.height).toBeLessThanOrEqual(lane.y+lane.height);
 }
 expect(groups.find(b=>b.policyCategory==='iam_policy')!.width).toBe(36);
});

it('folds a capability and its quality row to one line without changing the model or stretching to side columns',()=>{
 const m=model(),before=JSON.stringify(m),full=computeDesignMap(m);
 const id=full.rows[0].capabilityId!;
 const folded=computeDesignMap(m,{collapsedCapabilityIds:[id]});
 expect(folded.rows[0].height).toBe(44);
 expect(folded.rows[1].y).toBe(folded.rows[0].y+44+12);
 for(const role of ['capability','quality-profile']){
  const box=folded.boxes.find(b=>b.role===role&&b.entityId===id)!;
  expect(box.height).toBe(44);expect(box.text).toHaveLength(role==='capability'?1:0);expect(box.collapsed).toBe(true);
 }
 expect(folded.boxes.filter(b=>b.role==='scenario').length).toBeLessThan(full.boxes.filter(b=>b.role==='scenario').length);
 expect(JSON.stringify(m)).toBe(before);
 expect(computeDesignMap(m)).toEqual(full);
});
it('groups implementation nodes by kind, keeps every entity, and presets creation in empty lanes',()=>{
 const m=model(),layout=computeDesignMap(m);
 for(const col of ['component-category','realization-category']){
  const groups=layout.boxes.filter(b=>b.role===col);
  expect(groups.length).toBeGreaterThan(1);
  expect(new Set(groups.map(g=>g.y)).size).toBe(1);
  for(let i=1;i<groups.length;i++)expect(groups[i].x).toBeGreaterThanOrEqual(groups[i-1].x+groups[i-1].width);
 }
 for(const e of m.entities.filter(e=>['component','contract','realization','verification','evidence'].includes(e.kind))){
  const cards=layout.boxes.filter(b=>b.entityId===e.id);expect(cards).toHaveLength(1);
  const parent=layout.boxes.find(b=>b.key===cards[0].parent)!;expect(parent.itemKind).toBe(e.kind);
  if(['component','realization'].includes(e.kind)&&e.data.kind)expect(parent.itemType).toBe(e.data.kind);
 }
 const empty=layout.boxes.find(b=>b.itemKind==='realization'&&b.itemType==='network')!;
 expect(empty.collapsed).toBe(true);expect(empty.width).toBe(36);
});

it('folds behaviors independently and preserves their state across capability folding',()=>{
 const m=model(),original=JSON.stringify(m),normal=computeDesignMap(m);
 const behavior=normal.boxes.find(b=>b.role==='behavior')!,id=behavior.entityId!;
 const folded=computeDesignMap(m,{collapsedBehaviorIds:[id]});
 const compact=folded.boxes.find(b=>b.role==='behavior'&&b.entityId===id)!;
 expect(compact.height).toBe(44);expect(compact.text).toHaveLength(1);expect(compact.collapsed).toBe(true);
 expect(folded.boxes.some(b=>b.parent===compact.key)).toBe(false);
 expect(folded.boxes.filter(b=>b.role==='scenario').length).toBeLessThan(normal.boxes.filter(b=>b.role==='scenario').length);
 const cap=normal.boxes.find(b=>b.key===behavior.parent)!;
 expect(computeDesignMap(m,{collapsedCapabilityIds:[cap.entityId!],collapsedBehaviorIds:[id]}).boxes.some(b=>b.entityId===id)).toBe(false);
 expect(computeDesignMap(m,{collapsedBehaviorIds:[id]})).toEqual(folded);
 expect(JSON.stringify(m)).toBe(original);
});

it('summarizes actual quality targets and keeps editable quality IDs in folded rows',()=>{
 const m=model(),cap=computeDesignMap(m).rows[0].capabilityId!;const layout=computeDesignMap(m,{collapsedCapabilityIds:[cap],language:'ja'});
 const summaries=layout.boxes.filter(b=>b.role==='quality-summary');expect(summaries.length).toBeGreaterThan(0);
 expect(summaries.some(b=>b.summary?.includes('可用性: 99.99%'))).toBe(true);
 for(const box of summaries){expect(m.entities.find(e=>e.id===box.entityId)?.kind).toBe('quality');const parent=layout.boxes.find(b=>b.key===box.parent)!;expect(box.x+box.width).toBeLessThanOrEqual(parent.x+parent.width);expect(box.y+box.height).toBeLessThanOrEqual(parent.y+parent.height);}
 expect(renderDesignMap(m,{collapsedCapabilityIds:[cap]}).svg).toContain('Availability: 99.99%');
});
