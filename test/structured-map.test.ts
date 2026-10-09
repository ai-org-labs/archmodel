import {describe,it,expect} from 'vitest';
import {examples} from '../site/content.js';
import {parseModel,renderStructuredMap,structuredScopes,mapQualityGroups,mapReviewRows,mapReviewSummary} from '../src/index.js';
import {entityDetail} from '../site/map-details.js';
import type {Model} from '../src/index.js';
import {vi} from 'vitest';
vi.mock('@archmodel/core',()=>import('../src/index.js'));
const read=(source:Record<string,unknown>)=>parseModel(JSON.stringify({version:'0.1',...source}));
function documentOf(svg:string){return new DOMParser().parseFromString(svg,'image/svg+xml');}
function verifyLayout(model:Model){
 const before=JSON.stringify(model),r=renderStructuredMap(model),doc=documentOf(r.svg);
 expect(doc.querySelector('parsererror')).toBeNull();
 expect([...doc.querySelectorAll('[data-node]')].map(e=>e.getAttribute('data-node')).sort()).toEqual(model.entities.map(e=>e.id).sort());
 expect(JSON.stringify(model)).toBe(before);
 const ancestors=(id:string):string[]=>{const p=r.layout.boxes.find(b=>b.id===id)?.parentId;return p?[p,...ancestors(p)]:[];};
 for(const a of r.layout.boxes){
   expect(a.x).toBeGreaterThanOrEqual(0);expect(a.y).toBeGreaterThanOrEqual(0);expect(a.x+a.width).toBeLessThanOrEqual(r.layout.width);expect(a.y+a.height).toBeLessThanOrEqual(r.layout.height);
   if(a.parentId){const p=r.layout.boxes.find(b=>b.id===a.parentId)!;expect(a.x).toBeGreaterThan(p.x);expect(a.y).toBeGreaterThan(p.y);expect(a.x+a.width).toBeLessThan(p.x+p.width);expect(a.y+a.height).toBeLessThanOrEqual(p.y+p.height);}
   for(const b of r.layout.boxes){if(a.id===b.id||ancestors(a.id).includes(b.id)||ancestors(b.id).includes(a.id))continue;const overlap=Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);expect(overlap,`${a.id} overlaps ${b.id}`).toBe(false);}
 }
 if(model.entities.length){const chosen=renderStructuredMap(model,{selectedId:model.entities[0].id});expect(chosen.layout).toEqual(r.layout);}
 return r;
}
describe('structured whole-model map',()=>{
 it.each(examples)('keeps every entity in $id once without overlap or mutation',example=>{const r=verifyLayout(parseModel(example.source));expect(documentOf(r.svg).querySelector('[data-connection-line]')).toBeNull();});
 it('nests behavior and scenario within their actual parent',()=>{const m=read({capabilities:[{id:'c',behaviors:[{id:'b',scenarios:[{id:'s'}]}]}]});const {layout}=verifyLayout(m);expect(layout.boxes.find(b=>b.id==='b')?.parentId).toBe('c');expect(layout.boxes.find(b=>b.id==='s')?.parentId).toBe('b');});
 it('preserves multiple products, unassigned objects and a shared behavior without copying it',()=>{
  const m=read({products:[{id:'p1',capabilities:['a']},{id:'p2',capabilities:['b']}],capabilities:[{id:'a',behaviors:['shared']},{id:'b',behaviors:['shared']}],behaviors:[{id:'shared',scenarios:[{id:'s'}]},{id:'orphan'}],components:[{id:'unused'}],scenarios:[{id:'loose'}]});
  const r=verifyLayout(m),doc=documentOf(r.svg);expect(r.scopes.get('shared')).toEqual(new Set(['a','b']));expect(doc.querySelectorAll('[data-shared-reference="shared"]')).toHaveLength(2);expect(r.layout.boxes.find(b=>b.id==='unused')?.scope).toEqual([]);
 });
 it('derives subset sharing from requirements, without propagating communication or product ownership',()=>{
  const m=read({product:{id:'p',capabilities:['a','b','c'],components:['unassigned']},capabilities:[{id:'a',behaviors:[{id:'ba',realized_by:['shared'],verified_by:['va']}]},{id:'b',behaviors:[{id:'bb',realized_by:['shared']}]},{id:'c',behaviors:[{id:'bc',realized_by:['local']}]}],policies:[{id:'policy',applies_to:['p'],realized_by:['local']}],components:[{id:'shared',implemented_by:['runtime']},{id:'local'},{id:'unassigned'}],realizations:[{id:'runtime'}],verifications:[{id:'va',evidenced_by:['ev']}],evidence:[{id:'ev'}],relations:[{id:'network',from:'shared',to:'local',type:'calls'}]});
  const s=structuredScopes(m);expect(s.get('shared')).toEqual(new Set(['a','b']));expect(s.get('runtime')).toEqual(new Set(['a','b']));expect(s.get('local')).toEqual(new Set(['c']));expect(s.get('va')).toEqual(new Set(['a']));expect(s.get('ev')).toEqual(new Set(['a']));expect(s.get('unassigned')?.size).toBe(0);verifyLayout(m);
 });
 it('shows quality viewpoints even without requirements and never inherits an exclusion',()=>{
  const m=read({product:{id:'p',capabilities:['c']},capabilities:[{id:'c'}],review_scopes:['p'],reviews:[{id:'r',target:'p',perspective:'quality.availability',status:'not_applicable',rationale:'offline',owner:'owner',assumptions:['offline'],revisit_when:'online'}]});
  const svg=renderStructuredMap(m).svg;for(const g of mapQualityGroups)expect(svg).toContain(`data-review-group="${g.id}"`);expect(mapReviewSummary(m,'c','availability')).toContain('未検討');expect(mapReviewRows(m,'c','availability').every(r=>r.status==='unreviewed')).toBe(true);expect(mapReviewSummary(m,'c','environment')).toBe('観点未定義');
 });
 it('distinguishes incomplete evidence, deferred review and a declared test result',()=>{
  const m=read({capabilities:[{id:'c',quality:{availability:{id:'q',target:99.9,unit:'%',requirement:'稼働率',verified_by:['v']}}}],verifications:[{id:'v',result:'passed'}],reviews:[{id:'r',target:'c',perspective:'quality.availability',status:'deferred',rationale:'not settled',owner:'team',residual_risk:'outage',revisit_when:'release'}]});
  const r=verifyLayout(m);expect(r.svg).toContain('成功（この検証のみ）');expect(r.svg).toContain('保留');expect(r.svg).toContain('未検討');expect(r.svg).not.toContain('検証完了');
 });
 it('handles empty, bottom-up, long text and shared scenarios with the same rules',()=>{
  verifyLayout(read({}));verifyLayout(read({realizations:[{id:'only',name:'非常に長い名前と条件'.repeat(25)}]}));
  verifyLayout(read({capabilities:[{id:'c',behaviors:['a','b']}],behaviors:[{id:'a',scenarios:['s']},{id:'b',scenarios:['s']}],scenarios:[{id:'s',type:'text',specification:'  first\n\n  second'}]}));
 });
 it('escapes untrusted labels and retains exact scenario line breaks in readable details',()=>{
  const m=read({scenarios:[{id:'s',name:'<script>bad</script>',type:'gherkin',specification:'Given first\nWhen next\nThen last',extensions:{note:'<img src=x onerror=alert(1)>'}}]});
  const r=verifyLayout(m);expect(r.svg).not.toContain('<script>');document.body.innerHTML=entityDetail(m,'s');expect(document.querySelector('[data-detail-field="specification"]')?.textContent).toBe('Given first\nWhen next\nThen last');expect(document.querySelector('script,img,button')).toBeNull();expect(document.body.textContent).toContain('<img');
 });
});
