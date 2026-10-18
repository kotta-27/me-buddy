import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  base: '/me-buddy/',
  plugins: [
    preact(),
    {
      // dev で /lp/ を public/lp/index.html に向ける（本番の GitHub Pages は自動でそうなる）
      name: 'lp-dir-index',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url?.startsWith('/me-buddy/lp/') && req.url.split('?')[0].endsWith('/')) req.url = req.url.replace('/lp/', '/lp/index.html')
          next()
        })
      },
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(version) },
})
