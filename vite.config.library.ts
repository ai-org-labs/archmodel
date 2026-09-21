import { defineConfig } from 'vite';
export default defineConfig({build:{outDir:'dist',lib:{entry:'src/index.ts',formats:['es'],fileName:'archmodel'},rollupOptions:{output:{inlineDynamicImports:true}}}});
