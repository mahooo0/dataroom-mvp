// Copy pdf.js cmaps into public/ so the PDF viewer never has to hit an
// external CDN. Runs before dev + build. Safe to invoke repeatedly.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const req = createRequire(import.meta.url)
const pkgPath = req.resolve('pdfjs-dist/package.json')
const pkgDir = dirname(pkgPath)

const src = join(pkgDir, 'cmaps')
const dst = 'public/pdfjs-cmaps'

if (!existsSync(src)) {
  console.warn(`[copy-pdf-assets] cmaps not found at ${src} — skipping`)
  process.exit(0)
}

mkdirSync(dst, { recursive: true })
cpSync(src, dst, { recursive: true, force: true })
console.log(`[copy-pdf-assets] cmaps copied to ${dst}`)
