import {beforeEach,describe,expect,it,vi} from 'vitest';
import {installAuthoring} from '../site/authoring.js';
import {definitions,editableFields,EMPTY_MODEL,kinds,parseModel,validateModel,fieldLabel,qualityAttributes,scenarioFormats} from '../src/index.js';
import type {Kind} from '../src/index.js';
vi.mock('@archmodel/core',()=>import('../src/index.js'));

beforeEach(()=>{
 document.body.innerHTML='<button id="restore-work"></button><button id="merge-open"></button><input id="merge-file"><div id="merge-result"></div>';
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 HTMLDialogElement.prototype.close=function(){this.open=false;};
 vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{}});
});
function editor(initial=EMPTY_MODEL){
 let source=initial;
 const ui=installAuthoring({source:()=>source,model:()=>parseModel(source),replace:s=>{source=s;},select:()=>{},save:()=>{},beginLink:()=>{}});
 return {ui,model:()=>parseModel(source)};
}
const control=(key:string)=>document.querySelector<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(`[data-field="${key}"]`)!;
function submit(){document.getElementById('entity-form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));expect(document.getElementById('form-error')!.textContent).toBe('');}

describe('UI and canonical DSL agree',()=>{
 it.each(kinds)('%s exposes canonical keys and exactly the schema enum choices',kind=>{
  const {ui}=editor();ui.open(kind);
  for(const [key,rule] of editableFields(kind)){
   expect(document.querySelector(`[data-field-label="${key}"]`)!.textContent).toContain(fieldLabel(key,kind));
   const input=control(key);expect(input).not.toBeNull();
   if(rule.enum){
    const options=Array.from((input as HTMLSelectElement).options);
    expect(options.map(o=>o.value)).toEqual(['',...rule.enum]);
    for(const option of options.slice(1))expect(option.textContent).toContain(option.value);
   }
   if(rule.type==='array')expect(input.getAttribute('placeholder')).toBe('1行に1項目');
  }
 });
 it('saves a nameless draft as allowed by syntax',()=>{
  const {ui,model}=editor();ui.open('component');expect(control('name').required).toBe(false);submit();
  expect(model().entities).toHaveLength(1);expect(model().diagnostics.filter(d=>d.severity==='error')).toEqual([]);
  expect(validateModel(model()).some(d=>d.code==='MISSING_FIELD'&&d.field==='name')).toBe(true);
 });
 it('preserves numeric strings, array whitespace and specification on an unrelated edit',()=>{
  const {ui,model}=editor("version: '0.1'\nqualities: [{id: q, target: '001', attribute: availability}]\nbehaviors: [{id: b, use_cases: ['  original  ']}]\nscenarios: [{id: s, type: text, specification: \"  text\\n\\n\"}]");
  for(const [kind,id,key,value] of [['quality','q','target','001'],['behavior','b','use_cases',['  original  ']],['scenario','s','specification','  text\n\n']] as const){
   ui.open(kind,{id});control('owner').value='Team';submit();
   expect(model().entities.find(e=>e.id===id)?.data[key]).toEqual(value);
  }
 });
 it('lets target keep string values or accept numbers including exponent notation',()=>{
  const {ui,model}=editor();ui.open('quality');control('target').value='1e3';submit();
  expect(model().entities[0].data.target).toBe(1000);
  ui.open('quality',{id:model().entities[0].id});control('target').value='001';
  document.querySelector<HTMLSelectElement>('[data-value-type="target"]')!.value='string';submit();
  expect(model().entities[0].data.target).toBe('001');
 });
 it('shows the profile key as a fixed attribute and preserves profile identity',()=>{
  const {ui,model}=editor("version: '0.1'\ncapabilities: [{id: c, quality: {availability: {id: q, target: 99.9}}}]");
  ui.open('quality',{id:'q'});expect(control('attribute').value).toBe('availability');expect(control('attribute').disabled).toBe(true);
  control('target').value='99.99';submit();expect(model().entities.find(e=>e.id==='q')?.data).toMatchObject({attribute:'availability',target:99.99});
 });
 it('keeps arbitrary string categories and all schema-defined formats and attributes',()=>{
  expect(Object.keys(qualityAttributes).sort()).toEqual([...definitions.quality.properties.attribute.enum!].sort());
  expect(Object.keys(scenarioFormats).sort()).toEqual([...definitions.scenario.properties.type.enum!].sort());
  const {ui,model}=editor();
  for(const kind of ['policy','decision'] as Kind[]){ui.open(kind);control('category').value='custom-category';submit();}
  expect(model().entities.every(e=>e.data.category==='custom-category')).toBe(true);
 });
 it('persists false, arrays, objects and enum values using their DSL types',()=>{
  const {ui,model}=editor();ui.open('realization');control('public').value='false';control('kind').value='runtime';control('observability').value='logs\nmetrics';control('extensions').value='{"team":"platform"}';submit();
  expect(model().entities[0].data).toMatchObject({public:false,kind:'runtime',observability:['logs','metrics'],extensions:{team:'platform'}});
 });
});
