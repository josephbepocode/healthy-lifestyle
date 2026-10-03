import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { deflateSync } from 'node:zlib'

// Generates the PWA home-screen icons at build time (a lime progress ring on near-black),
// so no binary files need to live in the repo. Emitted to <base>icons/icon-{192,512}.png.
function crc32(buf: Buffer) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function iconPng(size: number, maskable: boolean) {
  const bg = [7, 8, 12]
  const lime = [182, 255, 59]
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const cx = size / 2
  const scale = maskable ? 0.62 : 0.8 // maskable keeps the glyph inside the safe zone
  const R = (size / 2) * scale * 0.72
  const w = (size / 2) * scale * 0.2
  const SS = 3
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let cov = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const dx = x + (sx + 0.5) / SS - cx
          const dy = y + (sy + 0.5) / SS - cx
          const d = Math.hypot(dx, dy)
          if (Math.abs(d - R) <= w / 2) {
            // arc covers ~70% of the ring, starting at 12 o'clock
            const a = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)
            if (a <= Math.PI * 2 * 0.7) cov++
          }
        }
      const t = cov / (SS * SS)
      const o = y * (size * 4 + 1) + 1 + x * 4
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(bg[c] + (lime[c] - bg[c]) * t)
      raw[o + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
function pwaIcons(): Plugin {
  const files: [string, number, boolean][] = [
    ['icons/icon-192.png', 192, false],
    ['icons/icon-512.png', 512, false],
    ['icons/icon-maskable-512.png', 512, true],
    ['icons/apple-touch-icon.png', 180, false],
  ]
  return {
    name: 'pwa-icons',
    generateBundle() {
      for (const [fileName, size, mask] of files) this.emitFile({ type: 'asset', fileName, source: iconPng(size, mask) })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const hit = files.find(([f]) => req.url?.split('?')[0].endsWith('/' + f))
        if (!hit) return next()
        res.setHeader('Content-Type', 'image/png')
        res.end(iconPng(hit[1], hit[2]))
      })
    },
  }
}

export default defineConfig({
  base: '/healthy-lifestyle/',
  plugins: [react(), pwaIcons()],
  server: { host: true, port: 5173, strictPort: true },
  preview: { host: true, port: 4173, strictPort: true },
  build: { chunkSizeWarningLimit: 1200 },
})
