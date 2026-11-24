// usage: node --experimental-websocket shot.mjs <url> <out.png|-> <w> <h> "<async js expr>"   env INIT=script before load, WAIT=ms
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
const [url, out, w, h, expr] = process.argv.slice(2)
const port = 9300 + Math.floor(Math.random() * 500)
const dir = mkdtempSync('/tmp/chr-')
const ch = spawn('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, `--window-size=${w},${h}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let targets
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find((t) => t.type === 'page')) break } catch {} await sleep(200) }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map(); const issues = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) }
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(d.params.type)) issues.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' '))
  if (d.method === 'Runtime.exceptionThrown') issues.push('EXC: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text))
  if (d.method === 'Log.entryAdded' && ['error', 'warning'].includes(d.params.entry.level)) issues.push('log ' + d.params.entry.level + ': ' + d.params.entry.text + ' ' + (d.params.entry.url || ''))
}
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
if (process.env.GRANT) await send('Browser.grantPermissions', { permissions: ['notifications'], origin: new URL(url).origin }); await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 600 })
if (process.env.INIT) await send('Page.addScriptToEvaluateOnNewDocument', { source: process.env.INIT })
await send('Page.navigate', { url })
await sleep(+(process.env.WAIT || 2500))
if (expr) {
  const r = await send('Runtime.evaluate', { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true })
  console.log('EVAL:', JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r.result))
  await sleep(+(process.env.WAIT2 || 800))
}
if (process.env.EXPR2) {
  await sleep(+(process.env.WAIT3 || 3000))
  const r2 = await send('Runtime.evaluate', { expression: `(async()=>{${process.env.EXPR2}})()`, awaitPromise: true, returnByValue: true })
  console.log('EVAL2:', JSON.stringify(r2.result?.result?.value ?? r2.result?.exceptionDetails?.exception?.description ?? r2.result))
}
if (out !== '-') {
  const full = process.env.FULL
  let clip
  if (full) { const m = await send('Page.getLayoutMetrics'); const c = m.result.cssContentSize; clip = { x: 0, y: 0, width: c.width, height: c.height, scale: 1 } }
  const s = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) })
  writeFileSync(out, Buffer.from(s.result.data, 'base64'))
}
console.log('ISSUES:', issues.length ? '\n' + issues.join('\n') : 'none')
ch.kill(); process.exit(0)
