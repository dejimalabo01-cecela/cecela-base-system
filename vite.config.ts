import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['xlsx-js-style'],
  },
  build: {
    commonjsOptions: {
      include: [/xlsx-js-style/, /node_modules/],
    },
  },
})
