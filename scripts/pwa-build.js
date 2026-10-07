import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

// Include Vite's actual hashed output so the installed app can load offline.
export function pwaBuild() {
  let publicDir
  return {
    name: 'pwa-precache',
    apply: 'build',
    configResolved(config) { publicDir = config.publicDir },
    generateBundle(_options, bundle) {
      const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.json'), 'utf8'))
      const staticPaths = [...new Set([
        '/manifest.json', '/images/logo-wordmark.png', '/images/apple-touch-icon-v3.png',
        '/images/favicon-v3.png', ...manifest.icons.map(icon => icon.src),
      ])]
      const template = fs.readFileSync(path.join(publicDir, 'service-worker.js'), 'utf8')
      const hash = createHash('sha256').update(template)
      for (const file of staticPaths) hash.update(fs.readFileSync(path.join(publicDir, file.slice(1))))
      for (const file of Object.keys(bundle).sort()) {
        hash.update(file).update(bundle[file].code || bundle[file].source || '')
      }
      const urls = [...new Set(['/', '/index.html', ...staticPaths, ...Object.keys(bundle).map(file => '/' + file)])]
      this.emitFile({ type: 'asset', fileName: 'service-worker.js', source: template
        .replace('/*__BUILD_ID__*/ \'development\'', JSON.stringify(hash.digest('hex').slice(0, 12)))
        .replace('/*__PWA_ASSETS__*/ []', JSON.stringify(urls)) })
    },
  }
}
