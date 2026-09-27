import {escapeHtml} from './content.js';
function inline(text:string){return escapeHtml(text).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');}
/** A deliberately small, escaped renderer for our bundled reference. No raw HTML. */
export function markdown(source:string){
 const lines=source.replace(/\r/g,'').split('\n'),html:string[]=[],toc:Array<{id:string;title:string}>=[];let i=0;
 while(i<lines.length){
  const line=lines[i];
  if(!line.trim()||line.startsWith('<!--')){i++;continue;}
  if(line.startsWith('```')){const code:string[]=[];i++;while(i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i++]);i++;html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);continue;}
  const heading=/^(#{1,4}) (.+)$/.exec(line);
  if(heading){const id=`reference-${toc.length}`,level=heading[1].length;toc.push({id,title:heading[2]});html.push(`<h${level} id="${id}">${inline(heading[2])}</h${level}>`);i++;continue;}
  if(line.startsWith('|')){const rows:string[][]=[];while(i<lines.length&&lines[i].startsWith('|')){const cells=lines[i++].replace(/^\||\|$/g,'').split('|').map(s=>s.trim());if(!cells.every(s=>/^:?-+:?$/.test(s)))rows.push(cells);}html.push(`<div class="table-scroll"><table><thead><tr>${(rows.shift()??[]).map(c=>`<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);continue;}
  if(/^[-*] /.test(line)){const items:string[]=[];while(i<lines.length&&/^[-*] /.test(lines[i]))items.push(`<li>${inline(lines[i++].slice(2))}</li>`);html.push(`<ul>${items.join('')}</ul>`);continue;}
  html.push(`<p>${inline(line)}</p>`);i++;
 }
 return {html:html.join(''),toc};
}
