import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Scope collection to this project's own test directory. Vitest's default
    // `include` glob is `**/*.{test,spec}.?(c|m)[jt]s?(x)` from the project root,
    // which does not skip dotfile-prefixed directories -- so the git worktrees
    // checked out under `.worktrees/` each contributed a full duplicate copy of
    // `src/test/`. An allowlist is robust against any future nested checkout.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Belt and braces: keep vitest's default excludes and add the worktree dir.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      '**/.worktrees/**',
    ],
  },
})
