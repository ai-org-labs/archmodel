import {describe,it,expect,beforeAll} from 'vitest';
import {parseDiagram} from '../src/focused/parser.js';
import {renderDiagram} from '../src/focused/render.js';
import {installDiagramIcons} from '../src/focused/icons.js';
import {DIAGRAM_SAMPLES} from '../src/focused/samples.js';
beforeAll(installDiagramIcons);
describe('official Mermaid input → ArchMap renderer',()=>{
  it.each(DIAGRAM_SAMPLES)('renders $id sample',async sample=>{
    const model=await parseDiagram(sample.source);
    expect(model.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
    expect(model.kind).toBe(sample.id);
    expect(model.title).toBe(/^title: (.+)$/m.exec(sample.source)![1]);
    const rendered=renderDiagram(model);
    expect(rendered.svg).toContain('<svg');expect(rendered.svg).not.toMatch(/NaN|Infinity/);
    expect(rendered.layout.nodes.length).toBe(model.nodes.length);
  });
  it('preserves nested groups, edges and arrows',async()=>{
    const m=await parseDiagram('flowchart LR\nsubgraph outer[Cloud]\nsubgraph inner[App]\nA[Web] -->|request| B[(Data)]\nend\nC[Queue]\nend\nB -.-> C\nA --- C\nA <--> B');
    expect(m.diagnostics).toEqual([]);expect(m.groups.find(g=>g.id==='inner')?.parent).toBe('outer');
    expect(m.nodes.find(n=>n.id==='A')?.group).toBe('inner');
    expect(m.edges.map(e=>[e.style,e.bidirectional,e.arrow])).toEqual([['solid',false,'open'],['dashed',false,'open'],['solid',false,'none'],['solid',true,'open']]);
  });
  it('keeps activation events and nested fragment order',async()=>{
    const m=await parseDiagram(DIAGRAM_SAMPLES[2].source);
    expect(m.activationEvents?.map(e=>e.action)).toEqual(['activate','activate','deactivate','deactivate']);
    expect(m.fragmentEvents?.map(e=>e.action)).toEqual(['alt','par','and','end','else','end']);
    const l=renderDiagram(m).layout;expect(l.activations).toHaveLength(2);expect(l.fragments).toHaveLength(2);
  });
  it('supports modal, state and local actions',async()=>{
    const m=await parseDiagram(DIAGRAM_SAMPLES[3].source);expect(m.nodes.find(n=>n.id==='confirm')?.shape).toBe('modal');
    const r=renderDiagram(m);expect(r.svg).toContain('data-action-kind="state"');expect(r.svg).toContain('data-action-kind="close"');
  });
  it('does not mix concurrent diagram databases',async()=>{
    const models=await Promise.all(DIAGRAM_SAMPLES.map(s=>parseDiagram(s.source)));
    expect(models.map(m=>m.kind)).toEqual(DIAGRAM_SAMPLES.map(s=>s.id));
    expect(models[0].nodes.some(n=>n.id==='api')).toBe(true);expect(models[1].nodes.some(n=>n.id==='api')).toBe(false);
  });
  it.each(['classDiagram\nA --> B','architecture-beta\nservice A(cloud)[A]','flowchart RL\nA-->B','flowchart LR\nA-->G\nsubgraph G\nB\nend','sequenceDiagram\nA->>B: Hi\nNote over A: hello','stateDiagram-v2\nA-->B\nnote right of A: hello','flowchart LR\nA@{img: "https://example.com/a.png"}'])('reports unsupported syntax: %s',async source=>{
    expect((await parseDiagram(source)).diagnostics.some(d=>d.severity==='error')).toBe(true);
  });
  it('escapes untrusted labels and rejects bad metadata',async()=>{
    const m=await parseDiagram('flowchart LR\nA["<script>alert(1)</script>"] --> B[Safe]');
    expect(renderDiagram(m).svg).not.toContain('<script>');
    for(const meta of ['{"nodes":{"missing":{"icon":"user"}}}','{"nodes":{"A":{"at":[0,1]}}}','{"unknown":true}','{"nodes":{"A":{"icon":"bogus"}}}'])expect((await parseDiagram(`%% archmap: ${meta}\nflowchart LR\nA-->B`)).diagnostics.some(d=>d.severity==='error')).toBe(true);
  });
  it('renders a plain Mermaid graph without custom metadata',async()=>{
    const m=await parseDiagram('graph TB\nA[Start] --> B{OK?}\nB -->|yes| C[Done]');expect(m.diagnostics).toEqual([]);expect(renderDiagram(m).layout.edges).toHaveLength(2);
  });
});

it('accepts 400 nodes / 200 nested containers and rejects node 401', async()=>{
  installDiagramIcons();
  const source=['flowchart LR',...Array.from({length:200},(_,i)=>`subgraph g${i}[Group ${i}]\na${i}[A ${i}] --> b${i}[B ${i}]\nend`)].join('\n');
  const m=await parseDiagram(source);expect(m.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
  expect(m.nodes).toHaveLength(400);expect(m.groups).toHaveLength(200);
  expect(renderDiagram(m).svg).not.toMatch(/NaN|Infinity/);
  expect((await parseDiagram(source+'\nextra[Extra]')).diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('supports 1000 edges and rejects the next edge',async()=>{
  const source='flowchart LR\n'+('A-->B\n'.repeat(1000));
  expect((await parseDiagram(source)).edges).toHaveLength(1000);
  expect((await parseDiagram(source+'A-->B')).diagnostics.some(d=>d.severity==='error')).toBe(true);
});
it('rejects click callbacks and unclosed activations',async()=>{
  for(const source of ['flowchart LR\nA-->B\nclick A callback','sequenceDiagram\nA->>+B: call'])expect((await parseDiagram(source)).diagnostics.some(d=>d.severity==='error')).toBe(true);
});


it('keeps the activity decision connected to the actual stock node', async()=>{
  const m=await parseDiagram(DIAGRAM_SAMPLES.find(s=>s.id==='activity')!.source);
  expect(m.diagnostics).toEqual([]);
  expect(m.nodes).toHaveLength(9);
  expect(m.nodes.filter(n=>n.shape==='decision')).toEqual([expect.objectContaining({id:'stock',label:'在庫あり？'})]);
  expect(m.edges.filter(e=>e.to==='stock').map(e=>e.from)).toEqual(['root_start']);
  expect(m.edges.filter(e=>e.from==='stock').map(e=>[e.to,e.label])).toEqual([['parallel','はい'],['wait','いいえ']]);
  for(const node of m.nodes)expect(m.edges.some(e=>e.from===node.id||e.to===node.id)).toBe(true);
  const result=renderDiagram(m);
  expect(result.layout.nodes.find(n=>n.node.id==='stock')?.node.shape).toBe('decision');
  expect(result.model.diagnostics).toEqual([]);
});
it.each(['choice','fork','join'])('preserves labeled %s types in nested states',async type=>{
  const source=`%% archmap: {"view":"activity"}
stateDiagram-v2
state Container {
  state typed <<${type}>>
  typed : 日本語ラベル
  [*] --> typed
  typed --> Next
}`;
  const m=await parseDiagram(source);
  expect(m.diagnostics).toEqual([]);
  expect(m.nodes.find(n=>n.id==='typed')).toMatchObject({shape:type==='choice'?'decision':type,label:'日本語ラベル',group:'Container'});
});
it('diagnoses a combined alias and special-state declaration instead of rendering a disconnected node',async()=>{
  const m=await parseDiagram('stateDiagram-v2\nstate "在庫あり？" as stock <<choice>>\n[*] --> stock');
  expect(m.diagnostics.some(d=>d.severity==='error' && d.message.includes('別行'))).toBe(true);
});


it.each(['TB','LR'])('keeps the activity bypass separate from parallel branches (%s)',async direction=>{
  const sample=DIAGRAM_SAMPLES.find(s=>s.id==='activity')!.source.replace('direction TB',`direction ${direction}`);
  const {layout}=renderDiagram(await parseDiagram(sample));
  for(let i=0;i<layout.edges.length;i++)for(let j=i+1;j<layout.edges.length;j++) {
    const a=layout.edges[i],b=layout.edges[j];
    for(let k=1;k<a.points.length;k++)for(let l=1;l<b.points.length;l++){
      const p=a.points[k-1],q=a.points[k],r=b.points[l-1],s=b.points[l];
      const sharedVertical=p.x===q.x && r.x===s.x && p.x===r.x && Math.min(Math.max(p.y,q.y),Math.max(r.y,s.y))>Math.max(Math.min(p.y,q.y),Math.min(r.y,s.y));
      const sharedHorizontal=p.y===q.y && r.y===s.y && p.y===r.y && Math.min(Math.max(p.x,q.x),Math.max(r.x,s.x))>Math.max(Math.min(p.x,q.x),Math.min(r.x,s.x));
      expect(sharedVertical||sharedHorizontal,`${a.edge.from}->${a.edge.to} / ${b.edge.from}->${b.edge.to}`).toBe(false);
    }
  }
});
