import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const fixture = 'examples/agent-landscape.archmodel.yaml';
const run = (...args) => spawnSync(process.execPath, ['tools/cli.mjs', ...args], { encoding: 'utf8' });
const json = (...args) => { const r = run(...args); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
assert.equal(json('question', fixture).text.length > 0, true);
const plan = json('plan', fixture, '--phase', 'shape', '--focus', 'review-analysis');
assert.equal(plan.phase, 'shape');
assert.equal(plan.primary.targetId, 'review-analysis');
assert.ok(plan.related.length <= 2);
assert.equal(json('question', fixture, '--phase', 'shape', '--focus', 'review-analysis').code, plan.primary.code);
const markdown = run('plan', fixture, '--format', 'markdown');
assert.equal(markdown.status, 0, markdown.stderr); assert.match(markdown.stdout, /## Deferred/);
for (const flags of [['--phase', 'oops'], ['--focus', 'missing'], ['--depth', 'oops'], ['--locale', 'fr'], ['--format', 'xml'], ['--phase'], ['--typo', 'x']]) {
 const r = run('plan', fixture, ...flags); assert.equal(r.status, 1, flags.join(' ')); assert.ok(r.stderr.length);
}
assert.match(json('plan', 'syntax/examples/customer-platform.archmodel.yaml').primary.code, /^REVIEW_UNREVIEWED:/);
assert.equal(run('validate', fixture).status, 0);
console.log('Planner CLI integration checks passed.');

const reviewFixture='syntax/examples/perspective-review.archmodel.yaml';
assert.equal(json('reviews',fixture).summary.tracked,false);
const review=json('reviews',reviewFixture,'converter');
assert.equal(review.summary.complete,false);
assert.equal(review.summary.resolved,2);
assert.equal(review.summary.counts.deferred,1);
assert.equal(json('reviews',reviewFixture,'conversion').summary.resolved,0);
assert.equal(run('reviews',reviewFixture,'missing').status,1);
console.log('Review CLI integration checks passed.');

// The design agent's actual read -> focus -> record -> validate -> replan path.
const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');
const {tmpdir}=await import('node:os');
const {join}=await import('node:path');
const temp=mkdtempSync(join(tmpdir(),'archmodel-review-agent-'));
try {
 const modelPath=join(temp,'model.yaml'),recordPath=join(temp,'review.json');
 writeFileSync(modelPath,"version: '0.1'\nproduct: {id: p, capabilities: [{id: c}]}\n");
 const before=json('coverage',modelPath,'c');assert(before.unconcluded>0);assert.equal(before.concluded,0);
 const started=run('review-start',modelPath,'c');assert.equal(started.status,0,started.stderr);writeFileSync(modelPath,started.stdout);
 assert.equal(json('coverage',modelPath,'c').scopes[0].tracked,true);
 assert.deepEqual(json('focus',modelPath,'c','contracts').entities.map(e=>e.id),['c']);
 writeFileSync(recordPath,JSON.stringify({id:'review-contracts',target:'c',perspective:'contracts',status:'not_applicable',owner:'team',rationale:'外部I/Fを提供しない',assumptions:['端末内で完結'],revisit_when:'外部連携の追加時'}));
 const saved=run('review-set',modelPath,recordPath);assert.equal(saved.status,0,saved.stderr);writeFileSync(modelPath,saved.stdout);
 assert.equal(run('validate',modelPath).status,0);assert.equal(json('coverage',modelPath,'c').concluded,1);
 const next=json('plan',modelPath,'--phase','shape','--focus','c');assert(![next.primary,...next.related,...next.deferred].some(q=>q?.targetId==='c'&&q.code==='REVIEW_UNREVIEWED:contracts'));
 assert.equal(json('coverage',modelPath,'p').concluded,0);
 assert.equal(run('focus',modelPath,'missing').status,1);
 console.log('Design agent coverage/focus/record/validate/replan integration passed.');
}finally{rmSync(temp,{recursive:true,force:true});}
