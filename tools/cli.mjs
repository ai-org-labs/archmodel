#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { renderDesignMap, parseModel, validateModel, nextQuestion, traceWhy, renderView, qualityMatrix, toMarkdown, toYaml, backlogCandidates, directoryProposal } from '../dist/archmodel.js';
const [command,file,arg,...rest]=process.argv.slice(2);
const help='Usage: npm run cli -- <validate|question|why|view|matrix|json|yaml|markdown|backlog|directories> file.archmodel.yaml [id|view] [--strict]';
try {
 if(!file||!command)throw new Error(help);
 const model=parseModel(await readFile(file,'utf8')),diagnostics=validateModel(model);
 if(command==='validate'){
  console.log(JSON.stringify(diagnostics,null,2));process.exitCode=diagnostics.some(d=>d.severity==='error'||([arg,...rest].includes('--strict')&&d.severity==='warning'))?1:0;
 }else{
  if(diagnostics.some(d=>d.severity==='error'))throw new Error(diagnostics.map(d=>`${d.path}: ${d.message}`).join('\n'));
  let result;
  switch(command){
   case 'question': result=nextQuestion(model);break;
   case 'why': if(!model.entities.some(e=>e.id===arg))throw new Error(`Unknown ID: ${arg}`);result=traceWhy(model,arg);break;
   case 'view': if(!['map','connections','contracts','capability','behavior','architecture','policy','decision','verification','implementation','impact'].includes(arg??'capability'))throw new Error('Unknown view');result=arg==='map'?renderDesignMap(model).svg:renderView(model,arg??'capability').svg;break;
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
