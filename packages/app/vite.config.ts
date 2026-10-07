import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(AQUI, 'src/interfaz'),
  base: './',
  plugins: [vue()],
  build: { outDir: path.join(AQUI, 'dist/interfaz'), emptyOutDir: true, chunkSizeWarningLimit: 2000 },
});
