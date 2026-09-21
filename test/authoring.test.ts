import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {EMPTY_MODEL,entryPoints,parseModel,saveEntity,linkEntities,availableLinks,mergeContribution,ownerOverview,traceWhy,renderFocusMap} from '../src/index.js';
const example=readFileSync('syntax/examples/design-map.archmodel.yaml','utf8');
describe('new model creation from three roles',()=>{
 it.each(entryPoints)('starts independently from $role',entry=>{
  const source=saveEntity(EMPTY_MODEL,entry.kind,{id:'first',name:'First',owner:entry.role});
  const model=parseModel(source);expect(model.entities).toHaveLength(1);expect(model.entities[0].kind).toBe(entry.kind);expect(model.diagnostics.some(d=>d.severity==='error')).toBe(false);
 });
 it('combines independent PM, architect and SE work and then traces a runtime back to value',()=>{
  const pm=saveEntity(EMPTY_MODEL,'product',{id:'p',name:'Product',purpose:'Value',owner:'PM'});
  const architect=saveEntity(EMPTY_MODEL,'realization',{id:'r',name:'Runtime',kind:'runtime',owner:'Architecture'});
  const se=saveEntity(EMPTY_MODEL,'behavior',{id:'b',name:'Login',trigger:'Request',outcomes:['Token'],owner:'SE'});
  let source=mergeContribution(mergeContribution(pm,architect),se);
  source=saveEntity(source,'capability',{id:'cap',name:'Authentication',owner:'PM'});
  source=saveEntity(source,'component',{id:'c',name:'Auth Service',kind:'application',owner:'Architecture'});
  for(const [from,field,to]of [['p','has','cap'],['cap','has','b'],['b','realized_by','c'],['c','implemented_by','r']])source=linkEntities(source,from,field,to);
  const model=parseModel(source);expect(traceWhy(model,'r')[0].nodes).toEqual(['r','c','b','cap','p']);expect(ownerOverview(model).map(g=>[g.owner,g.entities.length])).toEqual(expect.arrayContaining([['PM',2],['Architecture',2],['SE',1]]));
 });
 it('edits a nested behavior without removing scenarios or links',()=>{
  const before=parseModel(example);const behavior=before.entities.find(e=>e.id==='login')!;
  const source=saveEntity(example,'behavior',{...behavior.data,name:'New name',owner:'SE team'},'login');const after=parseModel(source);
  expect(after.entities.find(e=>e.id==='login')?.name).toBe('New name');expect(after.entities.find(e=>e.id==='login-success')).toBeDefined();expect(after.edges).toEqual(before.edges);
 });
 it('edits Quality Profile fields while preserving its identity and attribute',()=>{
  const m=parseModel(example),q=m.entities.find(e=>e.id==='auth-availability')!;
  const source=saveEntity(example,'quality',{...q.data,target:99.999,owner:'SRE'},q.id);expect(parseModel(source).entities.find(e=>e.id===q.id)?.data.target).toBe(99.999);
 });
 it('only offers valid relationship choices and rejects duplicate IDs or wrong targets',()=>{
  const options=availableLinks(parseModel(example),'profile-management');expect(options.some(o=>o.field==='has'&&o.target.id==='login')).toBe(true);expect(options.some(o=>o.target.id==='auth-runtime')).toBe(false);
  expect(()=>saveEntity(example,'component',{id:'login',name:'Duplicate'})).toThrow();expect(()=>linkEntities(example,'login','implemented_by','auth-runtime')).toThrow();
 });
 it('blocks conflicting imports atomically, including different kinds with the same ID',()=>{
  const original=saveEntity(EMPTY_MODEL,'product',{id:'p',name:'One'});const changed=saveEntity(EMPTY_MODEL,'product',{id:'p',name:'Two'});expect(()=>mergeContribution(original,changed)).toThrow(/内容が異なります/);expect(parseModel(original).entities[0].name).toBe('One');
  const other=saveEntity(EMPTY_MODEL,'behavior',{id:'p',name:'One'});expect(()=>mergeContribution(original,other)).toThrow();
  expect(parseModel(mergeContribution(original,original)).entities).toHaveLength(1);
 });
 it('preserves document extensions and rejects conflicting metadata',()=>{
  const a="version: '0.1'\nextensions: {team: A}\nproducts: [{id: p}]";const b="version: '0.1'\nbehaviors: [{id: b}]";
  expect(parseModel(mergeContribution(a,b)).source.extensions).toEqual({team:'A'});expect(()=>mergeContribution(a,"version: '0.1'\nextensions: {team: B}")).toThrow();
 });
 it('projects a focus map with shared nodes once and semantic edge labels intact',()=>{
  const m=parseModel(example),r=renderFocusMap(m,'auth-service');expect(r.model.nodes.filter(n=>n.id==='auth-service')).toHaveLength(1);expect(r.model.nodes.find(n=>n.id==='auth-service')?.color).toBe('orange');expect(r.model.edges.some(e=>e.label==='realizedBy')).toBe(true);expect(r.model.edges.some(e=>e.label==='implementedBy')).toBe(true);expect(new Set(r.model.nodes.map(n=>n.id)).size).toBe(r.model.nodes.length);
 });
});
