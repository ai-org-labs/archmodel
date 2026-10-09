#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { renderStructuredMap, parseModel, validateModel, nextQuestion, planNextQuestions, traceWhy, renderView, qualityMatrix, designCoverage, designFocus, startReview, saveReview, reviewRows, reviewScopeIds, reviewSummary, toMarkdown, toYaml, backlogCandidates, directoryProposal } from '../dist/archmodel.js';
const [command,file,arg,...rest]=process.argv.slice(2);
const help='Usage: npm run cli -- <validate|question|plan|coverage|focus|review-start|review-set|reviews|why|view|matrix|json|yaml|markdown|backlog|directories> file.archmodel.yaml [id|view] [--strict]\nPlanner: plan|question file [--phase landscape|shape|depth|realization|assurance] [--focus id[,id]] [--depth overview|normal|deep] [--locale ja|en] [--format json|markdown]';
function plannerOptions(args) {
 const context = {}, allowed = ['--phase', '--focus', '--depth', '--locale', '--format'];
 let format = 'json';
 for (let i = 0; i < args.length; i++) {
  const flag = args[i];
  if (!allowed.includes(flag)) throw new Error(`Unknown option: ${flag}`);
  const value = args[++i];
  if (!value || value.startsWith('--')) throw new Error(`Missing value: ${flag}`);
  if (flag === '--phase') context.phase = value;
  if (flag === '--focus') context.focusIds = [...(context.focusIds ?? []), ...value.split(',')];
  if (flag === '--depth') context.userRequestedDepth = value;
  if (flag === '--locale') context.locale = value;
  if (flag === '--format') format = value;
 }
 if (!['json', 'markdown'].includes(format)) throw new Error('Format must be json or markdown');
 return { context, format };
}
const escapeMarkdown = s => String(s).replace(/[\\`*_{}\[\]<>#|]/g, c => `\\${c}`).replace(/\r?\n/g, ' ');
function planMarkdown(plan) {
 const question = q => `- **${escapeMarkdown(q.strategy)}** ${escapeMarkdown(q.message)} (${escapeMarkdown(q.targetId ?? 'model')}; score=${q.score})`;
 return `# Question plan: ${plan.phase}\n\n## Primary\n\n${plan.primary ? question(plan.primary) : 'None'}\n\n## Related\n\n${plan.related.map(question).join('\n') || 'None'}\n\n## Deferred\n\n${plan.deferred.map(question).join('\n') || 'None'}\n\nReasons: ${plan.rationaleCodes.join(', ')}\n`;
}
try {
 if(!file||!command)throw new Error(help);
 const model=parseModel(await readFile(file,'utf8')),diagnostics=validateModel(model);
 if(command==='validate'){
  console.log(JSON.stringify(diagnostics,null,2));process.exitCode=diagnostics.some(d=>d.severity==='error'||([arg,...rest].includes('--strict')&&d.severity==='warning'))?1:0;
 }else{
  if(diagnostics.some(d=>d.severity==='error'))throw new Error(diagnostics.map(d=>`${d.path}: ${d.message}`).join('\n'));
  let result;
  switch(command){
   case 'question':
   case 'plan': {
    const args = [arg, ...rest].filter(x => x !== undefined);
    // No flags preserves the exact historical Question response.
    if (command === 'question' && !args.length) { result = nextQuestion(model); break; }
    const { context, format } = plannerOptions(args);
    const plan = planNextQuestions(model, context);
    result = format === 'markdown' ? planMarkdown(command === 'question' ? { ...plan, related: [], deferred: [] } : plan) : command === 'plan' ? plan : plan.primary;
    break;
   }
   case 'why': if(!model.entities.some(e=>e.id===arg))throw new Error(`Unknown ID: ${arg}`);result=traceWhy(model,arg);break;
   case 'view': if(!['map','connections','contracts','capability','behavior','architecture','policy','decision','verification','implementation','impact'].includes(arg??'capability'))throw new Error('Unknown view');result=arg==='map'?renderStructuredMap(model).svg:renderView(model,arg??'capability').svg;break;
   case 'review-start': {let source=toYaml(model);for(const id of arg?[arg]:designCoverage(model).scopes.map(s=>s.target))source=startReview(source,id);result=source;break;}
   case 'review-set': {if(!arg)throw new Error('review-set requires a JSON record file');result=saveReview(toYaml(model),JSON.parse(await readFile(arg,'utf8')));break;}
   case 'coverage': result=designCoverage(model,arg);break;
   case 'focus': result=designFocus(model,arg,rest[0]);break;
   case 'reviews': {const targets=arg?[arg]:reviewScopeIds(model);result={summary:reviewSummary(model,arg),scopes:targets.map(target=>({target,summary:reviewSummary(model,target),rows:reviewRows(model,target)}))};break;}
   case 'matrix': result=qualityMatrix(model);break;
   case 'json': result=model;break;
   case 'yaml': result=toYaml(model);break;
   case 'markdown': result=toMarkdown(model);break;
   case 'backlog': result=backlogCandidates(model);break;
   case 'directories': result=directoryProposal(model);break;
   default: throw new Error(help);
  }
  console.log(typeof result==='string'?result:JSON.stringify(result,null,2));
 }
}catch(e){console.error(e.message);process.exitCode=1;}
