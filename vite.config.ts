import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          tiptap: ['@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-underline', '@tiptap/extension-task-list', '@tiptap/extension-task-item', '@tiptap/extension-link', '@tiptap/extension-text-style', '@tiptap/extension-color', '@tiptap/extension-font-family', '@tiptap/extension-image'],
        },
      },
    },
  },
})
