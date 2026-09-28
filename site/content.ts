import designMap from '../syntax/examples/design-map.archmodel.yaml?raw';
import bottomUp from '../syntax/examples/bottom-up.archmodel.yaml?raw';
import customer from '../syntax/examples/customer-platform.archmodel.yaml?raw';
import reference from '../syntax/reference.md?raw';
import instructions from '../docs/AI_PROMPT_TEMPLATE.md?raw';
export {reference};
export const authoringPrompt=`${instructions.trim()}\n\n---\n\n${reference.trim()}\n`;
export const examples=[
 {id:'design-map',title:'認証とプロフィール管理',description:'認証とプロフィール管理。入出力・失敗時の動作、9つの品質要求、API契約、監査・証跡を含む57要素。',source:designMap},
 {id:'bottom-up',title:'既存の技術構成から設計する',description:'設備監視APIから価値を逆引き。8種類のScenario、9種類のRealization、7種類の実接続を含む54要素。',source:bottomUp},
 {id:'customer-platform',title:'顧客プラットフォーム',description:'認証・監査基盤の詳細設計。4種類のContract、5種類のComponent、移行・運用までを含む54要素。',source:customer}
] as const;
export const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function siteBase(page:string,standalone=false){return page==='home'||standalone?'./':'../';}
export function navigation(page:string,base:string){return `<nav class="site-nav" aria-label="サイトナビゲーション">${[['home','','Overview'],['playground','playground/','Playground'],['syntax','syntax/','Syntax'],['examples','examples/','Examples']].map(([id,path,label])=>`<a href="${base}${path}" ${id===page?'aria-current="page"':''}>${label}</a>`).join('')}<a href="https://github.com/ai-org-labs/archmodel">GitHub ↗</a></nav>`;}
export function downloadText(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
