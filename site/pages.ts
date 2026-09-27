import {parseModel,renderDesignMap} from '@archmodel/core';
import {examples,escapeHtml,navigation,siteBase} from './content.js';
import {guideMarkup,mountGuide} from './guide.js';
import './pages.css';
export function renderPage(page:string){
 const base=siteBase(page);
 document.body.className='docs-page';
 const title=page==='syntax'?'Syntax & AI prompts':page==='examples'?'Examples':'価値から実装まで、ひとつの設計へ。';
 const description=page==='syntax'?'ArchModel v0.1の正規構文・型・関連と、AIに設計を依頼するためのプロンプト。':page==='examples'?'サンプルのYAMLを開き、編集しながらDSLを試せます。':'YAMLで記述し、設計マップで確かめる。要求・品質・構成・検証のつながりをブラウザーで編集できます。';
 const preview=(source:string)=>renderDesignMap(parseModel(source),{collapsedCapabilityIds:parseModel(source).entities.filter(e=>e.kind==='capability').map(e=>e.id)}).svg;
 const cards=()=>`<div class="example-grid">${examples.map((e,i)=>`<a class="example-card" href="${base}playground/?sample=${e.id}"><span class="eyebrow">0${i+1} / ${e.id}</span><h2>${escapeHtml(e.title)} ↗</h2><p>${escapeHtml(e.description)}</p><div class="example-preview">${preview(e.source)}</div><span>Playgroundで開く →</span></a>`).join('')}</div>`;
 document.body.innerHTML=`<a class="skip-link" href="#main">本文へ移動</a><header class="site-header"><a class="site-brand" href="${base}"><b>A</b> ArchModel</a>${navigation(page,base)}</header><main id="main" class="docs-main"><section class="page-heading"><p class="eyebrow">ARCHMODEL / DESIGN AS CODE</p><h1>${title}</h1><p>${description}</p>${page==='home'?`<div class="hero-actions"><a class="button primary" href="${base}playground/">Playgroundを開く →</a><a class="button" href="${base}syntax/#ai-prompt">AIプロンプトから始める</a><a class="button" href="${base}standalone.html" download>オフライン版を保存</a></div>`:''}</section>${page==='syntax'?`<div class="guide-actions resource-downloads"><a class="button" href="${base}syntax/reference.md" download>構文 Markdown</a><a class="button" href="${base}schema/archmodel.schema.json" download>JSON Schema</a></div>${guideMarkup()}`:`${page==='home'?'<section class="intro-grid"><div><h2>書く</h2><p>ProductからRealizationまで、同じYAMLにまとめます。</p></div><div><h2>確かめる</h2><p>設計マップと診断で、参照切れや未定義の項目を確認します。</p></div><div><h2>持ち帰る</h2><p>YAML・SVG・Markdownを保存。処理はブラウザー内で完結します。</p></div></section><h2>サンプルから試す</h2>':''}${cards()}`}</main><footer class="site-footer"><span>ArchModel · Apache-2.0</span><a href="${base}syntax/">Syntax & AI prompts</a><a href="https://github.com/ai-org-labs/archmodel">GitHub</a></footer>`;
 if(page==='syntax')mountGuide();
}
