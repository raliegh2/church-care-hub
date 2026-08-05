import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) return 'react-vendor';
          return undefined;
        },
      },
    },
  },
});
