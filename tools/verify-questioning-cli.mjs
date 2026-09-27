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
