import { build } from "vite";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// IIFE, local icons, and inline styles allow opening this file via file://,
// with no server, CDN, import maps, or module fetches.
const root = fileURLToPath(new URL("../", import.meta.url));
const result = await build({
  configFile: false,
  root,
  logLevel: "warn",
  build: {
    write: false,
    minify: true,
    lib: { entry: `${root}site/site.ts`, name: "ArchModelStudio", formats: ["iife"] },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
const script = outputs.filter((item) => item.type === "chunk").map((item) => item.code).join("\n");
const styles = outputs.filter((item) => item.type === "asset" && item.fileName.endsWith(".css")).map((item) => String(item.source)).join("\n");
if (!script || !styles) throw new Error("Standalone build requires both JavaScript and CSS");
const notices = await readFile(`${root}THIRD_PARTY_NOTICES.md`, "utf8");
const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ArchModel — Offline Playground</title><style>${styles.replaceAll("</style", "<\\/style")}</style></head>
<body data-page="playground" data-standalone="true"><noscript>ArchModel の描画には JavaScript を有効にしてください。</noscript><script>${script.replaceAll("</script", "<\\/script")}</script><!--\n${notices.replaceAll("--", "—")}\n--></body></html>`;
await mkdir(`${root}site-dist`, { recursive: true });
await writeFile(`${root}site-dist/standalone.html`, html);
await writeFile(`${root}site-dist/.nojekyll`, "");
console.log(`Standalone playground: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB (all assets included)`);

// Publish canonical resources alongside the rendered pages for people and AI tools.
for (const dir of ['syntax', 'schema', 'docs', 'syntax/examples']) await mkdir(`${root}site-dist/${dir}`, {recursive:true});
for (const path of ['syntax/reference.md', 'schema/archmodel.schema.json', 'docs/AI_PROMPT_TEMPLATE.md', 'docs/EXAMPLES.md', 'syntax/examples/perspective-review.archmodel.yaml', 'syntax/examples/design-map.archmodel.yaml', 'syntax/examples/bottom-up.archmodel.yaml', 'syntax/examples/customer-platform.archmodel.yaml']) await copyFile(`${root}${path}`, `${root}site-dist/${path}`);
const prompt = await readFile(`${root}docs/AI_PROMPT_TEMPLATE.md`, 'utf8');
const reference = await readFile(`${root}syntax/reference.md`, 'utf8');
await writeFile(`${root}site-dist/archmodel-ai-prompt.txt`, `${prompt.trim()}\n\n---\n\n${reference.trim()}\n`);
