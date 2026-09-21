import {it,expect} from 'vitest';
import {DocumentHistory} from '../site/history.js';
import {deleteEntity,parseModel} from '../src/index.js';
it('undoes grouped document changes and discards redo when a new edit branches',()=>{
 const history=new DocumentHistory('initial');history.record('edit');history.record('delete');
 expect(history.undo()).toBe('edit');expect(history.undo()).toBe('initial');expect(history.redo()).toBe('edit');history.record('new branch');expect(history.canRedo).toBe(false);expect(history.undo()).toBe('edit');
});
it('does not create duplicate undo steps and bounds retained snapshots',()=>{
 const history=new DocumentHistory('a',2);history.record('a');expect(history.canUndo).toBe(false);for(const s of ['b','c','d'])history.record(s);expect(history.undo()).toBe('c');expect(history.undo()).toBe('b');expect(history.canUndo).toBe(false);
});
it('deletes nested parents without deleting descendants or leaving dangling references',()=>{
 const source="version: '0.1'\nproduct: {id: p, capabilities: [{id: c, behaviors: [{id: b, scenarios: [{id: s, type: text, specification: test}]}], quality: {availability: {id: q, target: 99.9, unit: '%'}}}]}\ncomponents: [{id: co}]\npolicies: [{id: po, applies_to: [c]}]";
 const after=parseModel(deleteEntity(source,'c'));expect(after.entities.map(e=>e.id).sort()).toEqual(['b','co','p','po','q','s']);expect(after.entities.find(e=>e.id==='q')!.data.attribute).toBe('availability');expect(after.edges.some(e=>e.from==='b'&&e.to==='s')).toBe(true);expect(after.edges.some(e=>e.to==='c'||e.from==='c')).toBe(false);expect(after.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 const history=new DocumentHistory(source);history.record(deleteEntity(source,'c'));expect(history.undo()).toBe(source);
});
it('removes affected architecture connections while retaining unrelated ones',()=>{
 const source="version: '0.1'\ncomponents: [{id: a}, {id: b}, {id: c}]\nrelations: [{id: ab, from: a, to: b, type: calls}, {id: bc, from: b, to: c, type: calls}]";
 const after=parseModel(deleteEntity(source,'a'));expect(after.connections.map(c=>c.id)).toEqual(['bc']);expect(after.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
});
