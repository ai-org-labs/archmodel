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
assert.equal(json('plan', 'syntax/examples/customer-platform.archmodel.yaml').primary, null);
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
