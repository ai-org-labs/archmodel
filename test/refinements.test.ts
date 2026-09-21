import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseModel,validateModel,relatedIds,verificationSummary,completeness,renderView,renderDesignMap,traceWhy,toYaml,connectionTypes} from '../src/index.js';
const input=readFileSync('syntax/examples/design-map.archmodel.yaml','utf8');
const errors=(s:string)=>parseModel(s).diagnostics.filter(d=>d.severity==='error').map(d=>d.code);
const graph=`version: '0.1'
components: [{id: a}, {id: b}, {id: c}, {id: d}]
relations:
 - {id: ab, from: a, to: b, type: calls, protocol: https}
 - {id: bc, from: b, to: c, type: calls}
 - {id: ca, from: c, to: a, type: calls}
 - {id: cd, from: c, to: d, type: writes}
`;
describe('architecture connections and contracts',()=>{
 it('preserves connection IDs, protocols, contracts, and parallel physical edges',()=>{
  const m=parseModel(input);expect(validateModel(m)).toEqual([]);expect(m.connections).toHaveLength(4);
  expect(m.edges.find(e=>e.id==='auth-to-idp')).toMatchObject({relation:'calls',protocol:'https',contract:'identity-api'});
  const parallel=parseModel(graph+' - {id: ab2, from: a, to: b, type: calls, protocol: grpc}\n');expect(parallel.connections).toHaveLength(5);
 });
 it('generates a real system topology separately from traceability',()=>{
  const m=parseModel(input),result=renderView(m,'connections');
  expect(result.model.edges).toHaveLength(4);expect(result.svg).toContain('https');expect(result.svg).toContain('identity-api');expect(result.model.edges.some(e=>e.label==='realizedBy')).toBe(false);
  const contracts=renderView(m,'contracts');expect(contracts.model.nodes.some(n=>n.id==='login-api')).toBe(true);expect(contracts.svg).toContain('provides');expect(contracts.svg).toContain('consumes');
 });
 it('binds Behavior, provider and consumer to a single contract and traces its Why',()=>{
  const m=parseModel(input);for(const [from,relation,to]of [['login','uses','login-api'],['auth-service','provides','login-api'],['audit-service','consumes','user-authenticated']])expect(m.edges).toContainEqual({from,relation,to});
  expect(traceWhy(m,'login-api').some(p=>p.nodes[p.nodes.length-1]==='customer-platform')).toBe(true);
  expect(renderDesignMap(m).layout.boxes.some(b=>b.entityId==='login-api')).toBe(true);
 });
 it.each(connectionTypes)('accepts %s with Component or Realization endpoints',type=>{
  expect(errors(`version: '0.1'\ncomponents: [{id: c}]\nrealizations: [{id: r}]\nrelations: [{id: e, from: c, to: r, type: ${type}}]`)).toEqual([]);
 });
 it.each([
  ["relations: [{id: x, from: c, to: absent, type: calls}]",'UNKNOWN_REFERENCE'],
  ["relations: [{id: c, from: c, to: r, type: calls}]",'DUPLICATE_ID'],
  ["relations: [{id: x, from: c, to: r, type: calls}, {id: x, from: r, to: c, type: calls}]",'DUPLICATE_ID'],
  ["relations: [{id: x, from: c, to: r, type: calls, contract: r}]",'CONTRACT_REFERENCE'],
  ["relations: [{id: x, from: c, to: r, type: invokes}]",'ENUM'],
  ["relations: [{id: x, from: c, to: r, type: calls, protocol: 443}]",'TYPE'],
  ["relations: [{id: x, from: c, type: calls}]",'REQUIRED'],
  ["behaviors: [{id: b}]\nrelations: [{id: x, from: b, to: r, type: calls}]",'RELATION_TYPE'],
  ["contracts: [{id: api, kind: function}]",'ENUM'],
 ])('rejects invalid connection or contract: %s',(body,code)=>expect(errors("version: '0.1'\ncomponents: [{id: c}]\nrealizations: [{id: r}]\n"+body)).toContain(code));
 it('rejects uses/provides/consumes targeting non-contracts',()=>expect(errors("version: '0.1'\ncomponents: [{id: c, provides: [r]}]\nrealizations: [{id: r}]")).toContain('RELATION_TYPE'));
 it('allows Product-wide decisions',()=>expect(errors("version: '0.1'\nproduct: {id: p}\ndecisions: [{id: d, affects: [p]}]")).toEqual([]));
});
describe('canonical syntax',()=>{
 it('round trips canonical fields without aliases or implicit type conversions',()=>{
  const m=parseModel(input);const round=parseModel(toYaml(m));expect(round.entities).toEqual(m.entities);expect(round.connections).toEqual(m.connections);expect(validateModel(round)).toEqual([]);
 });
 it.each([
  ["behaviors: [{id: b, usecases: [login]}]",'UNKNOWN_FIELD'],
  ["scenarios: [{id: s, gherkin: x}]",'UNKNOWN_FIELD'],
  ["policies: [{id: p, rule: a}]",'UNKNOWN_FIELD'],
  ["decisions: [{id: d, trade_off: cost}]",'TYPE'],
  ["capabilities: [{id: c, qualities: [{id: q}]}]",'TYPE'],
 ])('rejects non-canonical syntax: %s',(body,code)=>expect(errors("version: '0.1'\n"+body)).toContain(code));
 it('permits only the current scenario representation while allowing incomplete drafts',()=>{
  expect(errors("version: '0.1'\nscenarios: [{id: s, type: unknown_format, specification: x}]")).toContain('ENUM');
  expect(errors("version: '0.1'\nscenarios: [{id: s}]")).toEqual([]);
 });
 it('defines Quality Profile shorthand and ID references consistently with generated names',()=>{
  const m=parseModel("version: '0.1'\ncapabilities: [{id: c, name: Login, quality: {availability: {id: a, requirement: uptime}}, qualities: [q]}]\nqualities: [{id: q, name: Security, attribute: security, requirement: encrypt}]");
  expect(m.entities.find(e=>e.id==='a')).toMatchObject({name:'Login / availability',data:{attribute:'availability'}});
  expect(m.edges.filter(e=>e.from==='c'&&e.relation==='has').map(e=>e.to).sort()).toEqual(['a','q']);
  expect(m.diagnostics.filter(d=>d.entityId==='a'&&d.code==='MISSING_FIELD')).toEqual([]);
 });
 it.each(['guarantees','constraints','inputs','actor'])('checks %s as an array, never an ambiguous scalar',field=>expect(errors(`version: '0.1'\ncapabilities: [{id: c, ${field}: wrong}]`)).toContain('TYPE'));
 it('does not interpret arbitrary extension payload as syntax aliases',()=>{
  const m=parseModel("version: '0.1'\nextensions: {gherkin: keep, rule: keep, usecases: keep}");expect(m.source.extensions).toEqual({gherkin:'keep',rule:'keep',usecases:'keep'});
 });
});
describe('bounded related scope',()=>{
 it('honors depth, direction and edge types even with a cycle',()=>{
  const m=parseModel(graph);expect([...relatedIds(m,'a',{depth:0,relationTypes:connectionTypes})]).toEqual(['a']);
  expect([...relatedIds(m,'a',{depth:1,relationTypes:['calls']})]).toEqual(['a','b']);
  expect([...relatedIds(m,'a',{depth:2,relationTypes:['calls']})]).toEqual(['a','b','c']);
  expect([...relatedIds(m,'a',{depth:10,relationTypes:['calls']})]).toEqual(['a','b','c']);
  expect([...relatedIds(m,'a',{depth:1,direction:'reverse',relationTypes:['calls']})]).toEqual(['a','c']);
  expect([...relatedIds(m,'a',{depth:1,direction:'both',relationTypes:['calls']})]).toEqual(['a','b','c']);
  expect(relatedIds(m,'a',{depth:3,relationTypes:connectionTypes}).has('d')).toBe(true);
  expect(()=>relatedIds(m,'a',{depth:Infinity})).toThrow();
 });
 it('does not pull an unrelated capability through a shared policy by default',()=>{
  const m=parseModel("version: '0.1'\ncapabilities: [{id: a},{id: b}]\npolicies: [{id: p, applies_to: [a,b]}]");expect([...relatedIds(m,'a')]).toEqual(['a']);
  expect([...relatedIds(m,'a',{depth:2,direction:'both',relationTypes:['appliesTo']})]).toEqual(['a','p','b']);
 });
});
describe('verification coverage and result are separate',()=>{
 const make=(results:string[])=>parseModel("version: '0.1'\nscenarios:\n - id: s\n   verified_by: ["+results.map((_,i)=>`v${i}`).join(',')+"]\nverifications: ["+results.map((r,i)=>`{id: v${i}, result: ${r}}`).join(',')+"]");
 it.each([
  [[], 'uncovered','unknown','uncovered'],
  [['unknown'],'covered','unknown','covered_unknown'],
  [['passed'],'covered','passed','verified'],
  [['passed','unknown'],'covered','unknown','covered_unknown'],
  [['passed','failed'],'covered','failed','failed'],
  [['failed','unknown'],'covered','failed','failed'],
 ] as const)('classifies %j', (results,coverage,result,status)=>{
  const m=make([...results]);expect(verificationSummary(m,'s')).toMatchObject({coverage,verification_status:result,status});expect(completeness(m,'s').verified).toBe(status==='verified');
 });
 it('does not mark an aggregate verified when a child has no tests',()=>{
  const m=make(['passed']);m.entities.push({id:'s2',name:'s2',kind:'scenario',path:'$',data:{}},{id:'b',name:'b',kind:'behavior',path:'$',data:{}});m.edges.push({from:'b',to:'s',relation:'has'},{from:'b',to:'s2',relation:'has'});
  expect(verificationSummary(m,'b')).toMatchObject({coverage:'uncovered',verification_status:'passed',status:'uncovered'});
 });

});

it.each(['state_transition','timing','example','batch','iot','async_event','text'])('accepts %s without applying Gherkin rules and preserves it on export',type=>{
 const model=parseModel(`version: '0.1'\nscenarios: [{id: s, name: Example, type: ${type}, specification: '待機 → 実行 → 完了'}]`);
 expect(model.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 expect(validateModel(model).some(d=>d.code==='INVALID_GHERKIN')).toBe(false);
 expect(parseModel(toYaml(model)).entities[0].data.type).toBe(type);
 expect(renderDesignMap(model).svg).not.toContain('Given · When · Then');
});
