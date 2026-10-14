import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ragdoll-game/',  // ← Должно совпадать с именем репо!
  build: {
    outDir: 'dist',
  }
});