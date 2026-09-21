import {readFile,writeFile} from 'node:fs/promises';
const schema=JSON.parse(await readFile(new URL('../schema/archmodel.schema.json',import.meta.url),'utf8'));
const path=new URL('../syntax/reference.md',import.meta.url),current=await readFile(path,'utf8'),marker='<!-- GENERATED FIELD TYPES -->';
const safe=s=>String(s).replaceAll('|',' / ').replaceAll('\n',' ');
function type(s){if(s.$ref)return s.$ref.split('/').pop();if(s.oneOf)return s.oneOf.map(type).join(' または ');if(s.const!==undefined)return JSON.stringify(s.const);if(s.enum)return s.enum.map(x=>`\`${x}\``).join(' / ');if(s.type==='array')return `配列<${type(s.items)}>`;if(Array.isArray(s.type))return s.type.join(' / ');return s.type??'任意';}
let generated='\n\n## 全フィールドの型（Schemaから生成）\n\n';
for(const [name,definition]of [['Document',schema],...Object.entries(schema.$defs)]){
 generated+=`### ${name}\n\n| フィールド | 型・Enum | 必須性 |\n| --- | --- | --- |\n`;
 for(const [key,rule]of Object.entries(definition.properties??{}))generated+=`| ${key} | ${safe(type(rule))} | ${(definition.required??[]).includes(key)?'構造上必須':(definition['x-design-required']??[]).includes(key)?'設計上必須（不足はwarning）':'任意'} |\n`;
 generated+='\n';
}
const expected=current.split(marker)[0]+marker+generated;
if(process.argv.includes('--check')){if(current!==expected)throw new Error('Field reference is stale. Run npm run reference.');}
else await writeFile(path,expected);
