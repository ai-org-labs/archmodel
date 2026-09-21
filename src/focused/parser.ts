import mermaid from 'mermaid';
import { load, FAILSAFE_SCHEMA } from 'js-yaml';
import type { FlowDB } from 'mermaid/dist/diagrams/flowchart/flowDb.js';
import type { SequenceDB } from 'mermaid/dist/diagrams/sequence/sequenceDb.js';
import type { StateDB, StateStmt } from 'mermaid/dist/diagrams/state/stateDb.js';
import type { DiagramModel, DiagramNode, DiagramKind, DiagramShape, DiagramColor, DiagramFragmentEvent } from './types.js';
import { getIcon } from '../icons.js';

export const DIAGRAM_LIMITS = {sourceLength:500_000,nodes:400,groups:200,edges:1000,gridCoordinate:400,groupDepth:8} as const;
const colors = ['blue','green','orange','purple','gray'];
const kinds = ['system','layers','sequence','screens','activity'];
type RecordValue = Record<string, unknown>;
const record = (x: unknown): x is RecordValue => !!x && typeof x === 'object' && !Array.isArray(x);
// Mermaid's diagram databases/configuration are stateful; serialize all parsing,
// including simultaneous previews. The DB is copied before the next parse starts.
let pending: Promise<unknown> = Promise.resolve();
export function parseDiagram(source: string): Promise<DiagramModel> {
  const task = pending.then(() => parse(source)); pending = task.catch(() => {}); return task;
}
async function parse(source: string): Promise<DiagramModel> {
  const model: DiagramModel = {kind:'system',direction:'LR',title:'',nodes:[],groups:[],edges:[],diagnostics:[]};
  const error = (message: string, line = 0) => { if(model.diagnostics.length<50)model.diagnostics.push({line,severity:'error',message}); };
  const warning = (message: string) => { if(!model.diagnostics.some(d=>d.message===message)) model.diagnostics.push({line:0,severity:'warning',message}); };
  const text = (value: unknown) => {
    const s = Array.isArray(value) ? value.join('\n') : String(value ?? '');
    // HTML is never inserted in our SVG. Decode labels to plain text only.
    const element = document.createElement('textarea'); element.innerHTML = s.replace(/<br\s*\/?\s*>/gi,'\n');
    return element.value;
  };
  const direction = (dir: string | undefined) => {
    if (dir && !['LR','TD','TB'].includes(dir)) error(`方向 ${dir} は未対応です。LR または TB を指定してください。`);
    model.direction = dir === 'LR' ? 'LR' : 'TD';
  };
  const node = (id:string,label:string,shape:DiagramShape='card',group?:string): DiagramNode => ({id,label,shape,group,color:'blue',line:0});
  if(source.length>DIAGRAM_LIMITS.sourceLength){error('ソースは500,000文字以内にしてください。');return model;}
  let metadata: RecordValue = {};
  try {
    const metaLines=source.split('\n').map((value,index)=>({value,index})).filter(x=>/^\s*%%\s*archmap:/.test(x.value));
    if(metaLines.length>1) throw new Error('%% archmap: は1文書に1行だけ指定してください。');
    if(metaLines[0]){ const value=JSON.parse(metaLines[0].value.replace(/^\s*%%\s*archmap:\s*/,''));if(!record(value))throw new Error('archmap の補助設定はJSONオブジェクトです。');metadata=value; }
    for(const key of Object.keys(metadata)) if(!['view','style','nodes','actions'].includes(key)) error(`未対応の補助設定: ${key}`);
    if(metadata.view!==undefined && !kinds.includes(String(metadata.view)))error('view が不正です。');
    if(metadata.style!==undefined && !['cards','icons'].includes(String(metadata.style)))error('style は cards / icons です。');
    if(/%%\s*\{/.test(source))error('Mermaid の init ディレクティブは未対応です。');
    const front=/^\s*---\s*\n([\s\S]*?)\n---/.exec(source);
    if(front){const v=load(front[1],{schema:FAILSAFE_SCHEMA});if(!record(v)||Object.keys(v).some(k=>k!=='title')||typeof v.title!=='string')error('frontmatter は文字列の title のみ対応しています。');else model.title=v.title;}
    if(model.diagnostics.some(d=>d.severity==='error'))return model;
    const body=source.replace(/^\s*---\s*\n[\s\S]*?\n---/,'').replace(/^\s*%%.*$/gm,'').trim();
    if(!/^(flowchart\b|graph\b|sequenceDiagram\b|stateDiagram-v2\b)/.test(body)){error('対応するMermaid構文は flowchart / graph / sequenceDiagram / stateDiagram-v2 です。');return model;}
    if(/(?:^|;)\s*click\s+/m.test(body)){error('click / リンク操作は未対応です。');return model;}
    mermaid.initialize({startOnLoad:false,securityLevel:'strict',maxTextSize:500_000,maxEdges:1000,flowchart:{htmlLabels:false},suppressErrorRendering:true});
    const diagram=await mermaid.mermaidAPI.getDiagramFromText(source);
    model.title=text(diagram.db.getDiagramTitle?.()) || model.title;
    if(diagram.type.startsWith('flowchart')) {
      const db=diagram.db as FlowDB;
      model.kind=(metadata.view as DiagramKind) || 'system'; direction(db.getDirection());
      if(model.kind==='sequence')error('flowchart を sequence として表示できません。');
      const groups=db.getSubGraphs(); const vertices=db.getVertices();
      if(db.getClasses().size)warning('Mermaid の style / class の装飾は使わず、ArchMapのテーマで描画します。');
      const parent=(id:string)=>groups.find(g=>g.nodes.includes(id))?.id;
      model.groups=groups.map(g=>({id:g.id,label:text(g.title),parent:parent(g.id),color:'blue',line:0}));
      for(const g of groups){if(g.dir)warning('subgraph ごとの方向指定は未対応です。図全体の方向を使います。');if(g.metadata)error('subgraph の折りたたみメタデータは未対応です。');}
      const shapes:Record<string,DiagramShape>={square:'card',rect:'card',round:'card',stadium:'start',circle:'start',doublecircle:'end',cylinder:'database',diamond:'decision',diam:'decision',rounded:'card'};
      for(const v of vertices.values()) {
        if(model.groups.some(g=>g.id===v.id))continue;
        const shape=shapes[v.type || 'square']; if(!shape)error(`ノード ${v.id}: 形状 ${v.type} は未対応です。`);
        const n=node(v.id,text(v.text || v.id),shape || 'card',parent(v.id));
        if(v.icon)n.icon=getIcon(v.icon)?v.icon:v.icon.replace(':','/');
        if(v.img)error(`ノード ${v.id}: 外部画像は未対応です。組み込みアイコンを利用してください。`);
        if(v.link||v.haveCallback)error('click / リンク操作は未対応です。');
        if(v.styles.length||v.classes.length)warning('Mermaid の style / class の装飾は使わず、ArchMapのテーマで描画します。');
        if(v.labelType==='markdown' && /[*`]/.test(v.text || ''))warning('Markdownラベルの装飾は未対応です。文字列として表示します。');
        model.nodes.push(n);
      }
      for(const e of db.getEdges()){
        if(!['arrow_point','double_arrow_point','arrow_open'].includes(e.type || ''))error(`接続 ${e.start} → ${e.end}: 矢印 ${e.type} は未対応です。`);
        if(e.stroke==='invisible')error('不可視の接続 ~~~ は未対応です。');
        if(e.stroke==='thick'||e.style?.length||e.animate||e.animation)warning('接続の太さ・style・アニメーションはArchMapの表示に統一します。');
        model.edges.push({from:e.start,to:e.end,label:text(e.text),style:e.stroke==='dotted'?'dashed':'solid',bidirectional:e.type==='double_arrow_point',arrow:e.type==='arrow_open'?'none':'open',line:0});
      }
    } else if(diagram.type==='sequence') {
      const db=diagram.db as SequenceDB;model.kind='sequence';model.direction='LR';
      if(metadata.view && metadata.view!=='sequence')error('sequenceDiagram の view は sequence のみです。');
      for(const [id,a] of db.getActors()){
        if(!['actor','participant','database'].includes(a.type))error(`参加者の種類 ${a.type} は未対応です。`);
        model.nodes.push({...node(id,text(a.description || id)),icon:a.type==='actor'?'user':a.type==='database'?'database':undefined});
      }
      if(db.getBoxes().length||db.getCreatedActors().size||db.getDestroyedActors().size)error('sequence の box / create / destroy は未対応です。');
      if([...db.getActors().values()].some(a=>Object.keys(a.links).length||Object.keys(a.properties).length))error('participant の links / properties は未対応です。');
      model.activationEvents=[];model.fragmentEvents=[];
      const events:Record<number,DiagramFragmentEvent['action']>={10:'loop',11:'end',12:'alt',13:'else',14:'end',15:'opt',16:'end',19:'par',20:'and',21:'end'};
      let sequenceNumber:number|undefined,step=1;
      for(const [i,msg] of db.getMessages().entries()){
        const line=i+1, type=msg.type ?? -1;
        if(type===26){if(typeof msg.message==='object'){sequenceNumber=msg.message.visible?msg.message.start:undefined;step=msg.message.step;}continue;}
        if(type===17||type===18){model.activationEvents.push({action:type===17?'activate':'deactivate',node:msg.from!,afterEdge:model.edges.length,line});continue;}
        if(events[type]){model.fragmentEvents.push({action:events[type],label:text(msg.message),afterEdge:model.edges.length,line});continue;}
        if(![0,1,5,6,24,25,33,34].includes(type)){error(`sequence のメッセージ/枠 (種別 ${type}) は未対応です。Note / critical / break / rect / クロス矢印などは利用できません。`);continue;}
        if(msg.centralConnection)error('中央接続の指定は未対応です。');
        const label=(sequenceNumber===undefined?'':`${sequenceNumber}. `)+text(msg.message);if(sequenceNumber!==undefined)sequenceNumber+=step;
        model.edges.push({from:msg.from!,to:msg.to!,label,style:[1,6,25,34].includes(type)?'dashed':'solid',bidirectional:[33,34].includes(type),arrow:[0,1,33,34].includes(type)?'filled':[5,6].includes(type)?'none':'open',line});
      }
    } else if(diagram.type.startsWith('state')) {
      const db=diagram.db as StateDB;model.kind=(metadata.view as DiagramKind)||'screens';direction(db.getDirection());
      if(!['screens','activity'].includes(model.kind))error('stateDiagram-v2 の view は screens / activity です。');
      // getData() is Mermaid's renderer model: adding a description can turn a
      // semantic choice/fork/join into a generic rect there. Preserve the type
      // from the parsed state declarations, including nested state documents.
      const specialStates = new Map<string, DiagramShape>();
      const collectState = (state: StateStmt): void => {
        const shape = {choice:'decision',fork:'fork',join:'join'}[state.type as 'choice'|'fork'|'join'] as DiagramShape | undefined;
        if(shape) {
          specialStates.set(state.id, shape);
          if(/^".*"\s+as\s+/.test(state.id)) error('判断・fork・join は state ID <<choice>> のように宣言し、表示名は別行の ID : 表示名 で指定してください。');
        }
        for(const statement of state.doc || []) {
          if(statement.stmt==='state'||statement.stmt==='default') collectState(statement);
          else if(statement.stmt==='relation') { collectState(statement.state1); collectState(statement.state2); }
        }
      };
      for(const state of db.getStates().values()) collectState(state);
      const data=db.getData();
      for(const v of data.nodes){
        if(v.isGroup){model.groups.push({id:v.id,label:text(v.label),color:'blue',parent:v.parentId,line:0});continue;}
        const shapes:Record<string,DiagramShape>={rect:'card',rectWithTitle:'card',roundedWithTitle:'card',stateStart:'start',stateEnd:'end',choice:'decision',fork:'fork',join:'join'};
        if(!shapes[v.shape])error(`状態 ${v.id}: 形状 ${v.shape} は未対応です。`);
        const label=v.shape==='stateStart'?'開始':v.shape==='stateEnd'?'終了':text(v.label || v.id);
        model.nodes.push(node(v.id,label,specialStates.get(v.id)||shapes[v.shape]||'card',v.parentId));
        if(v.cssStyles.length||v.cssCompiledStyles?.length)warning('状態の装飾はArchMapのテーマで描画します。');
      }
      for(const e of data.edges)model.edges.push({from:e.start,to:e.end,label:text(e.label),style:'solid',bidirectional:false,line:0});
      if(db.getLinks().size)error('状態の click / リンク操作は未対応です。');
    }
    model.style=(metadata.style as 'cards'|'icons')||'cards';
    if(metadata.nodes!==undefined){
      if(!record(metadata.nodes))error('nodes はノードIDをキーにしたオブジェクトです。');
      else for(const [id,opts] of Object.entries(metadata.nodes)){
        const n=model.nodes.find(n=>n.id===id);if(!n){error(`補助設定のノード ${id} がありません。`);continue;}
        if(!record(opts)){error(`nodes.${id} はオブジェクトです。`);continue;}
        for(const [key,value] of Object.entries(opts)){
          if(key==='at' && Array.isArray(value)&&value.length===2&&value.every(v=>Number.isInteger(v)&&v>=1&&v<=400))n.at=value as [number,number];
          else if(key==='icon' && typeof value==='string')n.icon=value;
          else if(key==='description' && typeof value==='string')n.description=value;
          else if(key==='color' && colors.includes(String(value)))n.color=value as DiagramColor;
          else if(key==='shape' && value==='modal' && model.kind==='screens')n.shape='modal';
          else error(`nodes.${id}.${key} は未対応、または値が不正です。`);
        }
      }
    }
    if(metadata.actions!==undefined){
      if(model.kind!=='screens'||!Array.isArray(metadata.actions)){error('actions は screens 用の配列です。');}
      else {model.screenActions=[];for(const action of metadata.actions){
        if(!record(action)||typeof action.node!=='string'||typeof action.label!=='string'||!action.label.trim()){error('操作には node と空でない label が必要です。');continue;}
        const owner=model.nodes.find(n=>n.id===action.node);
        if(!owner||!['card','modal'].includes(owner.shape)){error('操作の node は画面またはモーダルです。');continue;}
        if(Object.keys(action).some(k=>!['node','label','state','effect','when','close'].includes(k))||['state','effect','when'].some(k=>action[k]!==undefined&&(typeof action[k]!=='string'||!String(action[k]).trim()))||(action.close!==undefined&&(action.close!==true||owner.shape!=='modal'))||['state','effect','close'].filter(k=>action[k]!==undefined).length>1){error('操作の state / effect / when / close の値が不正です。');continue;}
        model.screenActions.push({node:action.node,label:action.label,state:action.state as string|undefined,effect:action.effect as string|undefined,when:action.when as string|undefined,close:action.close as boolean|undefined,line:0});
      }}
    }
    if(model.nodes.length>400||model.groups.length>200||model.edges.length>1000||(model.screenActions?.length||0)>1000)error('上限は400ノード・200グループ・1,000接続・1,000操作です。');
    const ids=new Set(model.nodes.map(n=>n.id)),cells=new Set<string>();
    for(const n of model.nodes){if(n.icon&&!getIcon(n.icon))error(`未登録アイコン: ${n.icon}`);if(n.at){const cell=n.at.join(',');if(cells.has(cell))error(`配置 ${cell} が重複しています。`);cells.add(cell);}}
    for(const edge of model.edges)if(!ids.has(edge.from)||!ids.has(edge.to))error('グループそのものへの接続は未対応です。グループ内のノードに接続してください。');
    for(const group of model.groups){const seen=new Set([group.id]);let p=group.parent;while(p){if(seen.has(p)){error('グループの循環は未対応です。');break;}seen.add(p);p=model.groups.find(g=>g.id===p)?.parent;}if(seen.size>8)error('グループの入れ子は8段までです。');}
    if(model.style==='icons' && !['system','layers'].includes(model.kind))error('icons 表示は system / layers 専用です。');
    if(['sequence','layers'].includes(model.kind) && model.nodes.some(n=>n.at))warning('この表示では at を使わず、参加者またはグループの順序で配置します。');
    let fragmentDepth=0;const activations=new Map<string,number>();
    for(const e of model.fragmentEvents || []){if(e.action==='end')fragmentDepth--;else if(!['else','and'].includes(e.action))fragmentDepth++;if(fragmentDepth>8)error('フラグメントの入れ子は8段までです。');}
    for(const e of model.activationEvents || []){const depth=(activations.get(e.node)||0)+(e.action==='activate'?1:-1);activations.set(e.node,depth);if(depth<0||depth>16)error('活性区間の対応が不正、または16段を超えています。');}
    if([...activations.values()].some(d=>d!==0))error('活性区間は deactivate または - で閉じてください。');
    if((model.fragmentEvents?.length||0)>1000 || (model.activationEvents?.length||0)>2000)error('フラグメントは1,000文、活性区間は2,000文までです。');
    if(!model.nodes.length)error('ノードまたは参加者を記述してください。');
    return model;
  }catch(e){error(e instanceof Error?e.message:String(e));return model;}
}
