import {describe,it,expect,vi} from 'vitest';
import {renderPage} from '../site/pages.js';
import {authoringPrompt,examples,reference,siteBase} from '../site/content.js';
import {markdown} from '../site/markdown.js';
import {mountGuide} from '../site/guide.js';
import {parseModel} from '../src/index.js';
vi.mock('@archmodel/core',()=>import('../src/index.js'));
describe('GitHub Pages and bundled guides',()=>{
 it.each(['home','syntax','examples'])('renders a distinct %s page with relative navigation',page=>{
  renderPage(page);expect(document.querySelector('nav [aria-current="page"]')?.textContent).toBe(page==='home'?'Overview':page==='syntax'?'Syntax':'Examples');
  const links=Array.from(document.querySelectorAll<HTMLAnchorElement>('nav.site-nav a'));expect(links.slice(0,4).every(a=>a.getAttribute('href')?.startsWith(siteBase(page)))).toBe(true);
  if(page==='syntax'){expect(document.querySelectorAll('table').length).toBeGreaterThan(10);expect(document.querySelector('#prompt-source')?.textContent).toContain(reference.trim());}
  else expect(document.querySelectorAll('.example-card')).toHaveLength(examples.length);
 });
 it('includes canonical syntax in the downloadable prompt',()=>{expect(authoringPrompt).toContain(reference.trim());expect(authoringPrompt).toContain('decision_status');expect(authoringPrompt).not.toContain('この文書の旧内容');});
 it('offers only parseable examples',()=>{for(const example of examples)expect(parseModel(example.source).diagnostics.filter(d=>d.severity==='error'),example.id).toEqual([]);});
 it('falls back to selecting the prompt when clipboard access fails',async()=>{
  renderPage('syntax');Object.defineProperty(navigator,'clipboard',{value:{writeText:vi.fn().mockRejectedValue(new Error('denied'))},configurable:true});mountGuide();
  document.getElementById('copy-prompt')!.click();await Promise.resolve();await Promise.resolve();
  expect((document.getElementById('prompt-details') as HTMLDetailsElement).open).toBe(true);expect(document.activeElement?.id).toBe('prompt-source');expect(document.getElementById('prompt-status')!.textContent).toContain('自動コピーできません');
 });
 it('escapes HTML in reference and code blocks',()=>{const result=markdown('# <script>alert(1)</script>\n```yaml\n<img src=x onerror=alert(1)>\n```');expect(result.html).not.toContain('<script>');expect(result.html).not.toContain('<img');expect(result.html).toContain('&lt;img');});
});
