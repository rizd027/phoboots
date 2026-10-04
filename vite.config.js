import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('peerjs')) return 'vendor-peer';
        },
      },
    },
  },
  server: {
    host: true,
  },
});
