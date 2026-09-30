import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Process CSS imports instead of stubbing them, so a test that imports a
    // stylesheet can assert on real computed styles.
    css: true,
  },
})
