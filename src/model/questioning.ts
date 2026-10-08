import {designReviewTargets} from './coverage.js';
import {reviewRows,reviewScopeIds} from './reviews.js';
import config from '../../rules/conversation.json';
import templates from '../../rules/questioning.json';
import { validateModel } from './analysis.js';
import type { ConversationContext, ConversationPhase, DesignQuestion, Diagnostic, Entity, Kind, Model, QuestionPlan } from './types.js';

const phases: ConversationPhase[] = ['landscape', 'shape', 'depth', 'realization', 'assurance'];
const index = (p: ConversationPhase) => phases.indexOf(p);
const present = (v: unknown) => v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length > 0);
const phaseFor = (d: Diagnostic, e?: Entity): ConversationPhase => {
 if (d.code.startsWith('REVIEW_')) return 'shape';
 if (d.code === 'QUALITY_DISCOVERY') return 'shape';
 if (d.code === 'DECISION_REVIEW') return 'realization';
 if (['NO_PRODUCT', 'NO_CAPABILITY'].includes(d.code) || e?.kind === 'product') return 'landscape';
 if (d.code === 'NO_PARENT') return 'shape';
 if (['ORPHAN_COMPONENT', 'ORPHAN_REALIZATION'].includes(d.code)) return 'realization';
 if (['UNCOVERED', 'NO_EVIDENCE', 'STATE_GAP'].includes(d.code) || ['verification', 'evidence'].includes(e?.kind ?? '')) return 'assurance';
 if (['NO_REALIZATION', 'NO_IMPLEMENTATION', 'UNBOUND_DECISION', 'PUBLIC_AUTH'].includes(d.code) || ['component', 'realization', 'decision'].includes(e?.kind ?? '')) return 'realization';
 if (e?.kind === 'capability' || e?.kind === 'quality' || e?.kind === 'policy') return 'shape';
 return 'depth';
};
function inferPhase(model: Model, ds: Diagnostic[]): ConversationPhase {
 const products = model.entities.filter(e => e.kind === 'product');
 const caps = model.entities.filter(e => e.kind === 'capability');
 if (!products.length || !caps.length || products.some(e => ['purpose', 'primary_users', 'user_value', 'scope'].some(f => !present(e.data[f])))) return 'landscape';
 if (ds.some(d => phaseFor(d, model.entities.find(e => e.id === d.entityId)) === 'shape')) return 'shape';
 if (ds.some(d => phaseFor(d, model.entities.find(e => e.id === d.entityId)) === 'depth')) return 'depth';
 if (ds.some(d => phaseFor(d, model.entities.find(e => e.id === d.entityId)) === 'realization')) return 'realization';
 return 'assurance';
}

/** Pure, deterministic planning; no model writes, natural-language extraction or LLM dependency. */
export function planNextQuestions(model: Model, context: ConversationContext = {}): QuestionPlan {
 if (context.phase !== undefined && !phases.includes(context.phase)) throw new RangeError('Unknown conversation phase');
 if (context.userRequestedDepth !== undefined && !['overview', 'normal', 'deep'].includes(context.userRequestedDepth)) throw new RangeError('Unknown conversation depth');
 if (context.locale !== undefined && !['ja', 'en'].includes(context.locale)) throw new RangeError('Supported locales: ja, en');
 const entities = new Map(model.entities.map(e => [e.id, e]));
 for (const id of context.focusIds ?? []) if (!entities.has(id)) throw new RangeError(`Unknown focus ID: ${id}`);
 const ds = [...validateModel(model)];
 // Design discovery is not a validation warning: these candidates never enter the model.
 if (model.entities.some(e => e.kind === 'capability') && !model.entities.some(e => e.kind === 'quality')) {
  const product = model.entities.find(e => e.kind === 'product');
  ds.push({ code: 'QUALITY_DISCOVERY', severity: 'warning', path: '$', entityId: product?.id, message: '' });
 }
 for (const e of model.entities) if (e.kind === 'decision' && e.data.decision_status === 'proposed')
  ds.push({ code: 'DECISION_REVIEW', severity: 'warning', path: e.path, entityId: e.id, message: '' });
 const phase = context.phase ?? (context.userRequestedDepth === 'overview' ? 'landscape' : context.userRequestedDepth === 'deep' && context.focusIds?.length ? 'depth' : inferPhase(model, ds));
 const rationale = new Set<string>([context.phase ? 'EXPLICIT_PHASE' : 'INFERRED_PHASE']);
 if (ds.some(d => d.severity === 'error')) return { phase, primary: null, related: [], deferred: [], rationaleCodes: [...rationale, 'INVALID_MODEL'] };
 // Unstarted scopes must never disappear from the design agent's work queue.
 for(const target of designReviewTargets(model).filter(id=>!reviewScopeIds(model).includes(id)))for(const row of reviewRows(model,target))ds.push({code:'REVIEW_UNREVIEWED',severity:'warning',path:'$.review_scopes',entityId:target,field:row.perspective.id,message:`「${row.perspective.name}」: 未検討です。対象・対象外・保留の判断と根拠を記録してください`});
 const locale = (context.locale ?? 'ja') as 'ja' | 'en';
 const text = (ja: string, en: string) => locale === 'ja' ? ja : en;
 const children = (id: string, kind?: Kind) => model.edges.filter(e => e.from === id && e.relation === 'has' && (!kind || entities.get(e.to)?.kind === kind)).map(e => e.to);
 const caps = model.entities.filter(e => e.kind === 'capability');
 const focus = new Set(context.focusIds ?? []);
 // Descendants only: a focused capability does not pull in all siblings through its Product.
 const queue = [...focus];
 for (let i = 0; i < queue.length; i++) for (const id of children(queue[i])) if (!focus.has(id)) { focus.add(id); queue.push(id); }
 const breadth = inferPhase(model, ds) === 'landscape' || caps.some(e => !children(e.id, 'behavior').length);
 if (breadth) rationale.add('BREADTH_GUARD');
 const risk = (e?: Entity) => !!e && (['high', 'critical'].includes(String(e.data.risk)) || (e.kind === 'quality' && (e.data.level === 'high' || e.data.attribute === 'availability' && Number(e.data.target) >= 99.99)));
 const candidates: Array<DesignQuestion & { theme: string; blocked: boolean; risk: boolean }> = [];
 const seen = new Set<string>();
 for (const d of ds.filter(d => d.severity === 'warning')) {
  const e = entities.get(d.entityId ?? '');
  let code = d.code.startsWith('REVIEW_')?`${d.code}:${d.field}`:d.code, message: string | undefined = d.code.startsWith('REVIEW_')?(locale==='ja'?d.message:`Review ${d.field}: ${d.code}`):undefined;
  let concept: Kind = e?.kind ?? 'product';
  let targetPhase = phaseFor(d, e);
  let strategy: DesignQuestion['strategy'] = 'ask';
  const name = e?.name ?? 'Product';
  const wording = (key: string, parent = '') => ((templates.conversation_messages[locale] as Record<string, string>)[key] ?? templates.conversation_messages[locale].DESIGN_DETAILS).replaceAll('{name}', name).replaceAll('{parent}', parent);
  if (code === 'QUALITY_DISCOVERY') { concept = 'quality'; message = wording(code); }
  if (code === 'DECISION_REVIEW') message = wording(code);
  if (code === 'MISSING_FIELD') {
   if (e?.kind === 'product') {
    code = 'PRODUCT_LANDSCAPE';
    message = wording(code);
   } else if (e?.kind === 'capability') {
    code = d.field === 'behaviors' ? 'CAPABILITY_BEHAVIORS' : 'CAPABILITY_SHAPE';
    message = wording(code);
   } else if (e?.kind === 'behavior') {
    code = 'BEHAVIOR_FLOW';
    message = wording(code);
   } else {
    code = `${e?.kind.toUpperCase() ?? 'DESIGN'}_DETAILS`;
    message = wording(code);
   }
  }
  if (['PRODUCT_LANDSCAPE', 'CAPABILITY_SHAPE', 'BEHAVIOR_FLOW'].includes(code)) {
   const labels = templates.conversation_fields[locale] as Record<string, string>;
   const missing = ds.filter(x => x.entityId === e?.id && x.code === 'MISSING_FIELD' && x.field && labels[x.field]).map(x => labels[x.field!]);
   if (missing.length) message = wording('MISSING_ASPECTS').replaceAll('{aspects}', missing.join(locale === 'ja' ? '・' : ', '));
  }
  if (code === 'NO_SCENARIO') {
   concept = 'scenario';
   message = wording('REPRESENTATIVE_SCENARIO');
  }
  if (code === 'NO_REALIZATION') concept = 'component';
  if (code === 'NO_IMPLEMENTATION') concept = 'realization';
  if (code === 'UNCOVERED') concept = 'verification';
  if (code === 'NO_EVIDENCE') concept = 'evidence';
  const why = ['ORPHAN_REALIZATION', 'ORPHAN_COMPONENT', 'NO_PARENT'].includes(code);
  if (why) {
   targetPhase = 'landscape';
   message = wording('WHY');
  }
  if (['NO_REALIZATION', 'NO_IMPLEMENTATION', 'UNBOUND_DECISION', 'DECISION_DETAILS'].includes(code)) strategy = 'suggest';
  // Structural inference is only a proposal: never write a parent or accept a decision here.
  if (code === 'NO_PARENT' && e) {
   const parentKind: Partial<Record<Kind, Kind>> = { capability: 'product', behavior: 'capability', scenario: 'behavior', quality: 'capability' };
   const parents = model.entities.filter(p => p.kind === parentKind[e.kind]);
   if (parents.length === 1) {
    strategy = 'infer';
    message = wording('PARENT_PROPOSAL', parents[0].name);
   }
  }
  const key = `${code}:${e?.id ?? 'model'}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const fallback = templates.messages[locale] as Record<string, string>;
  message ??= (fallback[d.code] ?? (templates.messages.ja as Record<string, string>)[d.code] ?? text(`「${name}」の未確定な設計を具体化できますか？`, `Can you clarify the unresolved design for ${name}?`)).replaceAll('{name}', name).replaceAll('{field}', d.field ?? '');
  const priority = d.code === 'NO_PRODUCT' ? 110 : (templates.priorities as Record<string, number>)[concept] ?? 50;
  const weights = config.phases[phase].weights as Record<string, number>;
  const isRisk = d.code === 'PUBLIC_AUTH' || risk(e);
  const isFocus = focus.has(e?.id ?? '');
  const repeats = (context.recentQuestionTypes ?? []).filter(t => t === code || t === key).length;
  const premature = index(targetPhase) > index(phase);
  const detail = index(targetPhase) >= index('depth');
  const explicitDepth = !!context.phase || context.userRequestedDepth === 'deep';
  let blocked = !isRisk && !why && (premature || breadth && detail && !explicitDepth || context.userRequestedDepth === 'overview' && detail);
  if (repeats >= 2 && !isRisk) blocked = true;
  let score = priority * (weights[concept] ?? 0) + (targetPhase === phase ? 40 : 0);
  score += isFocus ? config.scoring.focus_bonus : 0;
  score += isRisk ? config.scoring.risk_bonus : 0;
  score += why ? config.scoring.why_bonus : 0;
  score += breadth && !detail ? config.scoring.breadth_bonus : 0;
  score -= premature ? config.scoring.premature_depth_penalty : 0;
  score -= context.userRequestedDepth === 'overview' && detail ? config.scoring.granularity_penalty : 0;
  score -= repeats * config.scoring.repetition_penalty;
  candidates.push({ code, targetId: e?.id, concept, message, priority, score: Math.round(score * 100) / 100, phase: targetPhase, strategy, theme: `${e?.id ?? 'model'}:${targetPhase}`, blocked, risk: isRisk });
 }
 candidates.sort((a, b) => b.score - a.score || `${a.code}:${a.targetId ?? ''}`.localeCompare(`${b.code}:${b.targetId ?? ''}`));
 const primary = candidates.find(c => !c.blocked);
 const related = primary ? candidates.filter(c => c !== primary && !c.blocked && c.theme === primary.theme).slice(0, config.limits.related_subquestions_per_turn) : [];
 const clean = (q: typeof candidates[number], defer = false): DesignQuestion => ({ code: q.code, targetId: q.targetId, concept: q.concept, message: q.message, priority: q.priority, score: q.score, phase: q.phase, strategy: defer ? 'defer' : q.strategy });
 if (primary?.risk) rationale.add('RISK_OVERRIDE');
 if (focus.size) rationale.add('FOCUS_APPLIED');
 if (context.recentQuestionTypes?.length) rationale.add('REPETITION_PENALTY');
 if (context.userRequestedDepth) rationale.add(`DEPTH_${context.userRequestedDepth.toUpperCase()}`);
 if (!primary) rationale.add(candidates.length ? 'ALL_DEFERRED' : 'NO_OPEN_QUESTIONS');
 return { phase, primary: primary ? clean(primary) : null, related: related.map(q => clean(q)), deferred: candidates.filter(c => c !== primary && !related.includes(c)).map(q => clean(q, true)), rationaleCodes: [...rationale] };
}
