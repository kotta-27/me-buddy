import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  base: '/me-buddy/',
  plugins: [preact()],
  define: { __APP_VERSION__: JSON.stringify(version) },
})
