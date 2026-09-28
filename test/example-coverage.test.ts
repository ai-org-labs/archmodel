import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseModel,validateModel,kinds,editableFields,definitions,connectionTypes,computeDesignMap,traceWhy,referenceFields} from '../src/index.js';
const names=['design-map','customer-platform','bottom-up'];
const models=names.map(name=>parseModel(readFileSync(`syntax/examples/${name}.archmodel.yaml`,'utf8')));
const all=models.flatMap(m=>m.entities);
describe('published examples cover the DSL',()=>{
 it.each(names)('%s covers every entity kind without validation gaps',name=>{
  const model=models[names.indexOf(name)];expect(validateModel(model)).toEqual([]);
  expect(new Set(model.entities.map(e=>e.kind))).toEqual(new Set(kinds));
  const map=computeDesignMap(model,{expanded:true});
  for(const entity of model.entities)expect(map.boxes.some(b=>b.entityId===entity.id),entity.id).toBe(true);
  for(const box of map.boxes)for(const text of box.text)expect(text.y,box.role+' / '+text.text).toBeLessThanOrEqual(box.height);
  for(const entity of model.entities.filter(e=>e.kind==='realization'))expect(traceWhy(model,entity.id).length,entity.id).toBeGreaterThan(0);
 });
 it.each(kinds)('documents every editable %s field across the collection',kind=>{
  const entities=all.filter(e=>e.kind===kind);
  for(const [key]of editableFields(kind))expect(entities.some(e=>e.data[key]!==undefined),`${kind}.${key}`).toBe(true);
 });
 it.each([['scenario','type'],['quality','attribute'],['component','kind'],['component','template'],['realization','kind'],['contract','kind'],['verification','level']] as const)('covers every %s.%s classification', (kind,key)=>{
  const values=all.filter(e=>e.kind===kind&&e.data[key]!==undefined).map(e=>e.data[key]);expect(new Set(values)).toEqual(new Set(definitions[kind].properties[key].enum));
 });
 it('covers physical and semantic relationships with valid references',()=>{
  expect(new Set(models.flatMap(m=>m.connections.map(c=>c.type)))).toEqual(new Set(connectionTypes));
  const relations=new Set(models.flatMap(m=>m.edges.map(e=>e.relation)));
  for(const relation of Object.values(referenceFields))expect(relations.has(relation),relation).toBe(true);
  for(const key of ['realizes','verifies'])expect(all.some(e=>Array.isArray(e.data[key])&&(e.data[key] as unknown[]).length>0),key).toBe(true);
 });
 it('never implies that illustrative tests have actually passed',()=>{
  for(const entity of all.filter(e=>['verification','evidence'].includes(e.kind)))expect(entity.data.result,entity.id).toBe('unknown');
  for(const entity of all.filter(e=>e.data.collected_at))expect(entity.data.extensions).toMatchObject({synthetic:true});
 });
});
