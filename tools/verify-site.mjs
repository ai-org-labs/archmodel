import {readFile,stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
for(const route of ['index.html','playground/index.html','syntax/index.html','examples/index.html']) {
  const source=await readFile(`site-dist/${route}`,'utf8');
  assert(source.includes('data-page='));
  for(const [,url] of source.matchAll(/(?:src|href)="([^"]+)"/g))if(url.endsWith('.js')||url.endsWith('.css')) {
    assert(!url.startsWith('/'),'assets must be relative for project Pages');
    await stat(new URL(url, new URL(`../site-dist/${route}`,import.meta.url)));
  }
}
const offline=await readFile('site-dist/standalone.html','utf8');
assert(offline.includes('data-standalone="true"'));
assert(!/<script[^>]+src=/.test(offline));
assert(!/<link[^>]+rel="stylesheet"/.test(offline));
assert(offline.includes('archmodel:canonical:v0.1')&&offline.includes('Quality Profiles'));
await stat('dist/archmodel.js');
console.log('PASS: four routes, relative assets, standalone HTML and browser library');
