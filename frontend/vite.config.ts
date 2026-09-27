import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// @omega-os/ui ships nested react 18 copies (file: dep installs its dev tree);
// force every react import to the root React 19 copy to avoid
// "React Element from an older version of React" runtime errors.
const reactRoot = path.resolve(__dirname, 'node_modules/react')
const reactDomRoot = path.resolve(__dirname, 'node_modules/react-dom')

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: /^react-dom$/, replacement: reactDomRoot },
      { find: /^react-dom\//, replacement: `${reactDomRoot}/` },
      { find: /^react$/, replacement: reactRoot },
      { find: /^react\//, replacement: `${reactRoot}/` },
    ],
  },
  server: {
    // @omega-os/ui is a symlinked file: dep — allow serving its real path
    // (self-hosted @fontsource files resolve inside the omega-os repo).
    fs: {
      allow: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../../omega-os')],
    },
    proxy: {
      '/simulate': 'http://localhost:8000',
      '/scenarios': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
