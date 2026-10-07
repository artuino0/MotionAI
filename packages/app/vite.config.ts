import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(AQUI, 'src/interfaz'),
  base: './',
  // <hyperframes-player> es un elemento propio del navegador, no un componente de Vue.
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('hyperframes-') } } })],
  build: { outDir: path.join(AQUI, 'dist/interfaz'), emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
