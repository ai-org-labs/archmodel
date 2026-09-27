import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseModel, planNextQuestions, nextQuestion, nextQuestions, validateModel } from '../src/index.js';
import type { ConversationPhase, Model } from '../src/index.js';
const sample = () => parseModel(readFileSync('syntax/examples/customer-platform.archmodel.yaml', 'utf8'));
const draft = () => parseModel(readFileSync('examples/agent-landscape.archmodel.yaml', 'utf8'));
const all = (m: Model, phase?: ConversationPhase) => { const p = planNextQuestions(m, { phase }); return [p.primary, ...p.related, ...p.deferred].filter(q => q !== null); };
describe('conversation planning', () => {
 it('starts from value, groups fields, and defers detail', () => {
  const m = parseModel("version: '0.1'\nproduct: {id: p, capabilities: [{id: c, behaviors: [{id: b}]}]}");
  const p = planNextQuestions(m);
  expect(p.phase).toBe('landscape');
  expect(p.primary?.concept).toBe('product');
  expect(p.deferred.some(q => q.code === 'UNCOVERED' || q.code === 'NO_SCENARIO')).toBe(true);
  expect(all(m).filter(q => q.code === 'PRODUCT_LANDSCAPE')).toHaveLength(1);
  expect(all(m).filter(q => q.code === 'CAPABILITY_SHAPE')).toHaveLength(1);
  expect(p.related.length).toBeLessThanOrEqual(2);
  expect(p.related.every(q => q.targetId === p.primary?.targetId && q.phase === p.primary?.phase)).toBe(true);
 });
 it('keeps a small but coherent product in Shape without forcing three capabilities', () => {
  const m = draft();
  expect(planNextQuestions(m).phase).toBe('shape');
  m.entities = m.entities.filter(e => !['audit-history', 'review-analysis'].includes(e.id));
  m.edges = m.edges.filter(e => m.entities.some(n => n.id === e.to));
  expect(planNextQuestions(m).phase).toBe('shape');
 });
 it('does not modify validation, graph, status, or source', () => {
  const m = draft(); const before = JSON.stringify(m); const diagnostics = validateModel(m);
  planNextQuestions(m, { phase: 'realization' });
  expect(JSON.stringify(m)).toBe(before); expect(validateModel(m)).toEqual(diagnostics);
 });
 it('accepts bottom-up and prioritizes Why before choosing more technology', () => {
  const m = parseModel("version: '0.1'\nrealizations: [{id: r, name: Cloud Run, kind: runtime}]");
  const p = planNextQuestions(m);
  expect(p.primary?.code).toBe('ORPHAN_REALIZATION');
  expect(p.primary?.message).toContain('価値');
 });
 it('overrides early phases for public authentication risk', () => {
  const m = parseModel("version: '0.1'\nrealizations: [{id: r, kind: runtime, public: true}]");
  const p = planNextQuestions(m, { phase: 'landscape' });
  expect(p.primary?.code).toBe('PUBLIC_AUTH'); expect(p.rationaleCodes).toContain('RISK_OVERRIDE');
 });
 it('prioritizes uncovered high availability even with a different focus', () => {
  const m = sample(); m.edges = m.edges.filter(e => !(e.from === 'auth-availability' && e.relation === 'verifiedBy'));
  const p = planNextQuestions(m, { phase: 'landscape', focusIds: ['logout'] });
  expect(p.primary).toMatchObject({ code: 'UNCOVERED', targetId: 'auth-availability' });
 });
 it('selects Depth, Realization and Assurance from unresolved design', () => {
  const m = sample();
  const depth = sample(); depth.edges = depth.edges.filter(e => !(e.from === 'login' && e.relation === 'has'));
  // Remove detached examples as well; otherwise their missing parent is a breadth issue.
  const ids = new Set(depth.entities.filter(e => e.kind === 'scenario' && !depth.edges.some(x => x.to === e.id && x.relation === 'has')).map(e => e.id));
  depth.entities = depth.entities.filter(e => !ids.has(e.id)); depth.edges = depth.edges.filter(e => !ids.has(e.from) && !ids.has(e.to));
  expect(planNextQuestions(depth).phase).toBe('depth');
  m.edges = m.edges.filter(e => !(e.from === 'auth-service' && e.relation === 'implementedBy'));
  expect(planNextQuestions(m).phase).toBe('realization');
  expect(planNextQuestions(sample()).phase).toBe('assurance');
  expect(planNextQuestions(sample()).primary).toBeNull();
 });
 it('respects explicit deep focus and overview suppression', () => {
  const m = draft();
  const p = planNextQuestions(m, { phase: 'shape', focusIds: ['review-analysis'] });
  expect(p.primary?.targetId).toBe('review-analysis');
  const overview = planNextQuestions(m, { userRequestedDepth: 'overview' });
  expect(overview.phase).toBe('landscape');
  expect(overview.primary).toBeNull();
  expect(overview.rationaleCodes).toContain('ALL_DEFERRED');
 });
 it('penalizes repeated types and can stop rather than endlessly repeat', () => {
  const m = parseModel("version: '0.1'");
  const before = planNextQuestions(m).primary!;
  const once = planNextQuestions(m, { recentQuestionTypes: ['NO_PRODUCT'] }).primary!;
  expect(once.score).toBeLessThan(before.score);
  const twice = planNextQuestions(m, { recentQuestionTypes: ['NO_PRODUCT', 'NO_PRODUCT'] });
  expect(twice.primary).toBeNull(); expect(twice.deferred[0].strategy).toBe('defer');
 });
 it('proposes structural inference without silently applying it', () => {
  const m = parseModel("version: '0.1'\nproduct: {id: p}\ncapabilities: [{id: c}]");
  const q = all(m).find(q => q.code === 'NO_PARENT');
  expect(q?.strategy).toBe('infer'); expect(m.edges).toEqual([]);
 });
 it('suggests realization but never silently accepts a decision', () => {
  const m = sample(); m.edges = m.edges.filter(e => !(e.from === 'login' && e.relation === 'realizedBy'));
  expect(all(m, 'realization').find(q => q.code === 'NO_REALIZATION')?.strategy).toBe('suggest');
 });
 it('does not invent E2E or force Gherkin on representative examples', () => {
  const m = parseModel("version: '0.1'\nbehaviors: [{id: b}]");
  const q = all(m, 'depth').find(q => q.code === 'NO_SCENARIO');
  expect(q?.message).not.toMatch(/E2E|Given/);
 });
 it('reports invalid models and rejects invalid context', () => {
  expect(planNextQuestions(parseModel('invalid')).rationaleCodes).toContain('INVALID_MODEL');
  expect(() => planNextQuestions(draft(), { focusIds: ['absent'] })).toThrow('Unknown focus');
  expect(() => planNextQuestions(draft(), { phase: 'bad' as ConversationPhase })).toThrow('phase');
  expect(() => planNextQuestions(draft(), { locale: 'fr' })).toThrow('locales');
 });
 it('preserves legacy nextQuestion shape, ordering, options and null', () => {
  const m = draft(); const options = { locale: 'en' as const, messages: { MISSING_FIELD: 'Custom {name}' }, priorities: { capability: 999 } };
  expect(nextQuestion(m, options)).toEqual(nextQuestions(m, options)[0]);
  expect(Object.keys(nextQuestion(m)!)).toEqual(['id', 'entityId', 'field', 'priority', 'text', 'reason']);
  expect(nextQuestion(sample())).toBeNull();
 });
 it('asks only unresolved aspects rather than repeating a supplied actor/input', () => {
  const m = parseModel("version: '0.1'\nproduct: {id: p, capabilities: [{id: c, purpose: value, actor: [staff], inputs: [PDF]}]}");
  const q = all(m, 'shape').find(q => q.code === 'CAPABILITY_SHAPE');
  expect(q?.message).toContain('何を受け取れるか');
  expect(q?.message).not.toContain('誰が使うか');
  expect(q?.message).not.toContain('何を渡すか');
 });
 it('leaves proposed decisions for a human to adopt', () => {
  const m = parseModel("version: '0.1'\ndecisions: [{id: d, name: Region, decision: Multi-region, reason: Availability, decision_status: proposed}]");
  const before = JSON.stringify(m);
  expect(all(m, 'realization').find(q => q.code === 'DECISION_REVIEW')?.strategy).toBe('ask');
  expect(JSON.stringify(m)).toBe(before);
 });
 it('is deterministic and localizes planner output', () => {
  const m = draft(); m.entities.forEach(e => { e.name = e.id; }); const context = { locale: 'en', focusIds: ['submit-pdf'] };
  expect(planNextQuestions(m, context)).toEqual(planNextQuestions(m, context));
  expect(JSON.stringify(planNextQuestions(m, context))).not.toMatch(/[ぁ-んァ-ン一-龥]/);
 });
});
