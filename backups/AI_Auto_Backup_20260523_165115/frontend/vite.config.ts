import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'web' ? '/' : './',
  plugins: [react()],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('react-router-dom')) {
            return 'react'
          }
          if (id.includes('node_modules/firebase')) {
            return 'firebase'
          }
          if (id.includes('node_modules/recharts')) {
            return 'charts'
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons'
          }
          if (id.includes('node_modules/emoji-picker-react')) {
            return 'emoji'
          }
          if (id.includes('node_modules/react-quill-new') || id.includes('node_modules/quill-cursors') || id.includes('node_modules/y-quill')) {
            return 'quill'
          }
          if (id.includes('node_modules/tinymce') || id.includes('node_modules/@tinymce/tinymce-react')) {
            return 'tinymce'
          }
          if (id.includes('node_modules/yjs') || id.includes('node_modules/y-websocket')) {
            return 'collaboration'
          }
        },
      },
    },
  },
}))
