import { parseDiagram } from './focused/parser.js';
import { renderDiagram } from './focused/render.js';
import { installDiagramIcons } from './focused/icons.js';
export { parseDiagram as parseMermaid, DIAGRAM_LIMITS } from './focused/parser.js';
export { renderDiagram } from './focused/render.js';
export { installDiagramIcons, getDiagramIconCatalog } from './focused/icons.js';
export { registerIcon } from './icons.js';
export type * from './focused/types.js';
/** Browser API; does not invoke Mermaid's SVG renderer. */
export async function renderMermaid(source: string) {
  installDiagramIcons();
  const model = await parseDiagram(source);
  const errors = model.diagnostics.filter(d => d.severity === 'error');
  if(errors.length) throw new Error(errors.map(d=>d.message).join('\n'));
  return renderDiagram(model);
}
