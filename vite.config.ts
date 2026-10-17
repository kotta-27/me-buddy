import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  base: '/me-buddy/',
  plugins: [preact()],
})
