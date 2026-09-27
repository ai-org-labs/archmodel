import designMap from '../syntax/examples/design-map.archmodel.yaml?raw';
import bottomUp from '../syntax/examples/bottom-up.archmodel.yaml?raw';
import customer from '../syntax/examples/customer-platform.archmodel.yaml?raw';
import reference from '../syntax/reference.md?raw';
import instructions from '../docs/AI_PROMPT_TEMPLATE.md?raw';
export {reference};
export const authoringPrompt=`${instructions.trim()}\n\n---\n\n${reference.trim()}\n`;
export const examples=[
 {id:'design-map',title:'認証とプロフィール管理',description:'2つのCapabilityから、Behavior・Scenario・Quality・実装・検証までを辿る設計例。',source:designMap},
 {id:'bottom-up',title:'既存の技術構成から設計する',description:'既存のRealizationを出発点に、Componentと利用者の価値をつなぐ設計例。',source:bottomUp},
 {id:'customer-platform',title:'顧客プラットフォーム',description:'Productから検証のEvidenceまで、DSLの基本要素と参照を確認する設計例。',source:customer}
] as const;
export const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function siteBase(page:string,standalone=false){return page==='home'||standalone?'./':'../';}
export function navigation(page:string,base:string){return `<nav class="site-nav" aria-label="サイトナビゲーション">${[['home','','Overview'],['playground','playground/','Playground'],['syntax','syntax/','Syntax'],['examples','examples/','Examples']].map(([id,path,label])=>`<a href="${base}${path}" ${id===page?'aria-current="page"':''}>${label}</a>`).join('')}<a href="https://github.com/ai-org-labs/archmodel">GitHub ↗</a></nav>`;}
export function downloadText(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
