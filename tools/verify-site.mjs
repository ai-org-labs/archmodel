import {readFile,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
for(const [route,page] of [['index.html','home'],['playground/index.html','playground'],['syntax/index.html','syntax'],['examples/index.html','examples']]) {
  const source=await readFile(`site-dist/${route}`,'utf8');
  assert(source.includes(`data-page="${page}"`));
  for(const [,url] of source.matchAll(/(?:src|href)="([^"]+)"/g))if(url.endsWith('.js')||url.endsWith('.css')) {
    assert(!url.startsWith('/'),'assets must be relative for project Pages');
    await stat(new URL(url, new URL(`../site-dist/${route}`,import.meta.url)));
  }
}
const offline=await readFile('site-dist/standalone.html','utf8');
assert(offline.includes('data-standalone="true"'));
assert(!/<script[^>]+src=/.test(offline));
assert(!/<link[^>]+rel="stylesheet"/.test(offline));
assert(offline.includes('archmodel:canonical:v0.1')&&offline.includes('primary_users（利用者）')&&!offline.includes('Quality Profiles'));
await stat('dist/archmodel.js');
console.log('PASS: four routes, relative assets, standalone HTML and browser library');

assert(offline.includes('プロンプトをコピー') && offline.includes('構文の目次'));
for (const path of ['syntax/reference.md','schema/archmodel.schema.json','docs/AI_PROMPT_TEMPLATE.md','syntax/examples/design-map.archmodel.yaml','syntax/examples/bottom-up.archmodel.yaml','syntax/examples/customer-platform.archmodel.yaml']) assert.equal(await readFile(`site-dist/${path}`,'utf8'),await readFile(path,'utf8'));
const prompt=await readFile('site-dist/archmodel-ai-prompt.txt','utf8');
assert(prompt.includes((await readFile('syntax/reference.md','utf8')).trim()));
assert(prompt.includes((await readFile('docs/AI_PROMPT_TEMPLATE.md','utf8')).trim()));
