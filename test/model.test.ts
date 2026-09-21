import { describe,it,expect } from 'vitest';
import {readFileSync} from 'node:fs';
import {parseModel,validateModel,nextQuestion,nextQuestions,traceWhy,qualityMatrix,renderView,projectView,relatedIds,completeness,toYaml,toMarkdown,backlogCandidates,directoryProposal} from '../src/index.js';
const source=readFileSync('syntax/examples/customer-platform.archmodel.yaml','utf8');
const bottom=readFileSync('syntax/examples/bottom-up.archmodel.yaml','utf8');
const model=()=>parseModel(source);
const codes=(s:string)=>validateModel(parseModel(s)).map(d=>d.code);
describe('ArchModel v0.1 acceptance',()=>{
 it('AC-01 parses Product → Capability → Behavior → Scenario and round trips',()=>{
  const m=model();expect(validateModel(m)).toEqual([]);
  expect(m.edges).toContainEqual({from:'login',to:'login-success',relation:'has'});
  const round=parseModel(toYaml(m));expect(round.entities).toEqual(m.entities);expect(round.edges).toEqual(m.edges);
 });
 it('AC-02 binds quality to its capability and preserves targets',()=>{
  const m=model();expect(m.entities.find(e=>e.id==='auth-availability')?.data).toMatchObject({target:99.99,attribute:'availability'});
  expect(qualityMatrix(m)[0].qualities[0].id).toBe('auth-availability');
 });
 it('AC-03 retains many-to-many behavior and quality realization',()=>{
  const m=model();expect(m.edges.filter(e=>e.relation==='realizedBy'&&e.to==='auth-service').map(e=>e.from)).toEqual(expect.arrayContaining(['login','logout','auth-availability']));
  expect(m.edges.filter(e=>e.from==='login'&&e.relation==='realizedBy')).toHaveLength(2);
 });
 it('AC-04 links component to runtime, code and IaC',()=>{
  expect(model().edges.filter(e=>e.from==='auth-service'&&e.relation==='implementedBy').map(e=>e.to)).toEqual(['auth-runtime','auth-source','auth-iac']);
 });
 it('AC-05 maps scenario and quality to distinct verification levels',()=>{
  const m=model();expect(m.edges).toContainEqual({from:'login-success',to:'login-contract',relation:'verifiedBy'});
  expect(m.entities.find(e=>e.id==='login-contract')?.data.level).toBe('contract');
  expect(m.entities.find(e=>e.id==='failover-test')?.data.level).toBe('resilience');
 });
 it('AC-06 diagnoses absence, orphan components and uncovered quality',()=>{
  const s="version: '0.1'\nbehaviors: [{id: b}]\nqualities: [{id: q}]\ncomponents: [{id: c}]";
  expect(codes(s)).toEqual(expect.arrayContaining(['NO_PRODUCT','MISSING_FIELD','NO_SCENARIO','NO_REALIZATION','UNCOVERED','ORPHAN_COMPONENT','NO_IMPLEMENTATION']));
 });
 it('AC-07 asks one question, prioritizes value and supports localization',()=>{
  const m=parseModel(bottom);expect(nextQuestion(m)?.id).toBe('NO_PRODUCT:model:');
  expect(nextQuestion(m,{locale:'en'})?.text).toContain('Who benefits');
  expect(nextQuestion(m,{messages:{NO_PRODUCT:'Who is it for?'}})?.text).toBe('Who is it for?');
  expect(nextQuestion(model())).toBeNull();
  const high=model();high.edges=high.edges.filter(e=>!(e.from==='auth-availability'&&e.relation==='verifiedBy'));
  expect(nextQuestion(high)).toMatchObject({entityId:'auth-availability',priority:85});
 });
 it('AC-08 accepts bottom-up inputs and later adds value via flat references',()=>{
  expect(parseModel(bottom).diagnostics).toEqual([]);
  const m=parseModel("version: '0.1'\nproduct: {id: p, has: [cap]}\ncapabilities: [{id: cap, has: [b]}]\nbehaviors: [{id: b, realized_by: [c]}]\ncomponents: [{id: c, implemented_by: [r]}]\nrealizations: [{id: r, kind: runtime}]");
  expect(traceWhy(m,'r')[0].nodes).toEqual(['r','c','b','cap','p']);
  expect(validateModel(m).filter(d=>d.entityId==='cap'&&d.field==='behaviors')).toEqual([]);
 });
 it('AC-09 generates capability / architecture SVG and quality matrix',()=>{
  const m=model();for(const view of ['capability','architecture'] as const){const r=renderView(m,view);expect(r.svg).toContain('<svg');expect(r.svg).not.toMatch(/NaN|Infinity/);expect(r.layout.nodes.length).toBe(projectView(m,view).nodes.length);}
  const q=qualityMatrix(m)[0].qualities[0];expect(q.components).toContain('auth-service');expect(q.implementations).toContain('auth-iac');expect(q.verifications).toEqual(['failover-test']);
 });
 it('AC-10 traces Resource and Component back to Product, with distinct shared paths',()=>{
  const paths=traceWhy(model(),'auth-runtime');expect(paths.map(p=>p.nodes)).toContainEqual(['auth-runtime','auth-service','login','authentication','customer-platform']);
  expect(paths.map(p=>p.nodes)).toContainEqual(['auth-runtime','auth-service','auth-availability','authentication','customer-platform']);
  expect(traceWhy(model(),'auth-service').length).toBeGreaterThan(1);expect(traceWhy(model(),'missing')).toEqual([]);
 });
});
describe('robustness and semantic boundaries',()=>{
 it.each([
  ['duplicate IDs',"version: '0.1'\ncomponents: [{id: x}, {id: x}]",'DUPLICATE_ID'],
  ['duplicate YAML key',"version: '0.1'\nversion: '0.1'",'YAML'],
  ['missing version','product: {id: p}','REQUIRED'],
  ['bad version',"version: '2.0'",'VERSION'],
  ['scalar root','hello','TYPE'],
  ['bad nested type',"version: '0.1'\nproduct: {id: p, capabilities: 1}",'TYPE'],
  ['bad reference type',"version: '0.1'\ncomponents: [{id: x, realizes: [4]}]",'TYPE'],
  ['unknown reference',"version: '0.1'\ncomponents: [{id: x, realizes: [absent]}]",'UNKNOWN_REFERENCE'],
  ['incorrect relationship',"version: '0.1'\ncomponents: [{id: x, has: [y]}, {id: y}]",'RELATION_TYPE'],
  ['unknown key',"version: '0.1'\nproduct: {id: p, pupose: typo}",'UNKNOWN_FIELD'],
  ['enum',"version: '0.1'\nverifications: [{id: v, level: magic}]",'ENUM'],
  ['quality key',"version: '0.1'\ncapabilities: [{id: c, quality: {magic: {id: q}}}]",'UNKNOWN_FIELD'],
  ['quality mismatch',"version: '0.1'\ncapabilities: [{id: c, quality: {security: {id: q, attribute: cost}}}]",'ENUM'],
  ['unsafe ID',"version: '0.1'\nproduct: {id: '<script>'}",'FORMAT'],
  ['alias cycle',"version: '0.1'\nextensions: &x {loop: *x}",'ALIAS'],
  ['shared alias',"version: '0.1'\ncomponents: [&x {id: a}, *x]",'ALIAS'],
 ])('rejects %s without throwing',(_name,s,code)=>{expect(codes(s)).toContain(code);expect(()=>nextQuestions(parseModel(s))).not.toThrow();});
 it('bounds input size and entity count',()=>{
  expect(codes('x'.repeat(500001))).toContain('LIMIT');
  expect(codes("version: '0.1'\ncomponents:\n"+Array.from({length:401},(_,i)=>`  - id: c${i}`).join('\n'))).toContain('LIMIT');
 });
 it('normalizes inverse links and deduplicates shared declarations',()=>{
  const m=parseModel("version: '0.1'\nbehaviors: [{id: b, realized_by: [c]}]\ncomponents: [{id: c, realizes: [b]}]");
  expect(m.edges).toEqual([{from:'b',to:'c',relation:'realizedBy'}]);
 });
 it('does not infer E2E or verified state from coverage alone',()=>{
  const c=completeness(model(),'authentication');expect(c.coverage).toBe('covered');expect(c.verified).toBe(false);
  const m=model();for(const e of m.entities)if(e.kind==='verification')e.data.result='passed';expect(completeness(m,'authentication').verified).toBe(true);expect(validateModel(m).map(d=>d.code)).toContain('NO_EVIDENCE');
 });
 it('warns for public API, ADR, invalid Gherkin and unsupported state',()=>{
  const s="version: '0.1'\nrealizations: [{id: r, kind: runtime, public: true}]\ndecisions: [{id: d}]\nscenarios: [{id: s, type: gherkin, specification: Given only}]\ncomponents: [{id: c, status: operational}]";
  expect(codes(s)).toEqual(expect.arrayContaining(['PUBLIC_AUTH','UNBOUND_DECISION','INVALID_GHERKIN','STATE_GAP']));
 });
 it('escapes user text in SVG and exposes conservative related set',()=>{
  const m=parseModel("version: '0.1'\nproduct: {id: p, name: '<script>alert(1)</script>'}");
  expect(renderView(m).svg).toContain('&lt;script&gt;');expect(renderView(m).svg).not.toContain('<script>');
  expect(relatedIds(model(),'auth-runtime',{direction:'reverse',depth:4})).toContain('customer-platform');
 });
 it('projects documents and proposals without mutating the model',()=>{
  const m=model(),before=JSON.stringify(m);expect(toMarkdown(m)).toContain('Traceability');expect(backlogCandidates(m).find(x=>x.sourceId==='login')?.acceptanceCriteria).toHaveLength(1);expect(directoryProposal(m)[0].paths[0]).toBe('src/components/auth-service/domain/');expect(JSON.stringify(m)).toBe(before);
 });
});
