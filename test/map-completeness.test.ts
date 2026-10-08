import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {mapCompleteness,parseModel,renderModelMap,saveReview} from '../src/index.js';
it('shows every perspective including missing and custom entries, without inheriting exclusions',()=>{
 const m=parseModel(readFileSync('syntax/examples/perspective-review.archmodel.yaml','utf8')),before=JSON.stringify(m),c=mapCompleteness(m);
 expect(c.rows).toHaveLength(2);expect(c.rows[0].reviews).toHaveLength(36);
 const review=(target:string,p:string)=>c.rows.find(r=>r.target.id===target)!.reviews.find(r=>r.perspective.id===p)!;
 expect(review('converter','quality.availability').tone).toBe('excluded');expect(review('conversion','quality.availability').label).toBe('未検討');expect(review('converter','quality.recoverability').tone).toBe('pending');expect(review('converter','distribution_cost').label).toBe('未検討');
 const svg=renderModelMap(m).svg;expect((svg.match(/data-coverage-cell=/g)??[]).length).toBe(72);expect(svg).not.toContain('接続先へ移動');expect(svg).not.toContain('関係カード');expect(JSON.stringify(m)).toBe(before);
});
it('exposes a broken branch even when a sibling has implementation and verification',()=>{
 const m=parseModel("version: '0.1'\nproduct: {id: p, capabilities: [{id: c, behaviors: [{id: good, realized_by: [comp], scenarios: [{id: s, verified_by: [v]}]}, {id: broken}]}]}\ncomponents: [{id: comp, implemented_by: [impl]}]\nrealizations: [{id: impl}]\nverifications: [{id: v, result: unknown}]\n");
 const row=mapCompleteness(m,'c').rows[0];expect(row.cells.find(c=>c.stage.id==='component')!.gaps.some(g=>g.id==='broken')).toBe(true);expect(row.cells.find(c=>c.stage.id==='scenario')!.gaps.some(g=>g.id==='broken')).toBe(true);expect(row.cells.find(c=>c.stage.id==='verification')!.summary).toContain('1 未実施/不明');expect(row.cells.find(c=>c.stage.id==='evidence')!.gaps.some(g=>g.id==='v')).toBe(true);
});
it('distinguishes missing rationale, failed verification and disconnected elements',()=>{
 let source="version: '0.1'\nproduct: {id: p, capabilities: [{id: c, behaviors: [{id: b, scenarios: [{id: s, verified_by: [v]}]}]}]}\nverifications: [{id: v, result: failed}]\nrealizations: [{id: orphan}]\n";
 source=saveReview(source,{id:'r',target:'c',perspective:'verification_evidence',status:'applicable',addresses:['s']});
 const m=parseModel(source),c=mapCompleteness(m),row=c.rows.find(r=>r.target.id==='c')!;
 expect(row.reviews.find(r=>r.perspective.id==='verification_evidence')!.label).toContain('根拠不足');expect(row.reviews.find(r=>r.perspective.id==='verification_evidence')!.verifications.map(e=>e.id)).toEqual(['v']);expect(row.cells.find(c=>c.stage.id==='verification')!.tone).toBe('failed');expect(c.unassigned.map(e=>e.id)).toContain('orphan');expect(renderModelMap(m).svg).toContain('data-node="orphan"');
});
it('retains the complete judgment table when relation layers hide lines',()=>{const m=parseModel(readFileSync('syntax/examples/design-map.archmodel.yaml','utf8'));const svg=renderModelMap(m,{relationLayer:'architecture',relationMode:'all'}).svg;expect((svg.match(/data-coverage-cell=/g)??[]).length).toBe(105);expect((svg.match(/data-node=/g)??[]).length).toBe(57);});
