const PREFIX = 'healthy-'
export const FORMAT = 'healthy-lifestyle-backup'

export function dataKeys(): string[] {
  const k: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const n = localStorage.key(i)
    if (n && n.startsWith(PREFIX)) k.push(n)
  }
  return k.sort()
}
export function exportPayload() {
  const keys: Record<string, string> = {}
  dataKeys().forEach((k) => (keys[k] = localStorage.getItem(k) ?? ''))
  return { app: FORMAT, format: 1, exportedAt: new Date().toISOString(), keys }
}
export function downloadBackup() {
  const p = exportPayload()
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `healthy-backup-${p.exportedAt.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  return Object.keys(p.keys).length
}

export interface PreviewRow {
  key: string
  status: 'replace' | 'new'
  now: string
  incoming: string
}
function summary(raw: string): string {
  try {
    const j = JSON.parse(raw)
    if (j && typeof j === 'object') {
      const parts = Object.entries(j as Record<string, unknown>)
        .filter(([, v]) => Array.isArray(v) && v.length)
        .map(([k, v]) => `${(v as unknown[]).length} ${k}`)
      if (parts.length) return parts.slice(0, 4).join(', ')
      return `${Object.keys(j).length} fields`
    }
    return String(j).slice(0, 30)
  } catch {
    return 'unreadable'
  }
}
export function parseBackup(text: string): { ok: true; keys: Record<string, string>; exportedAt: string; rows: PreviewRow[] } | { ok: false; error: string } {
  let p: unknown
  try {
    p = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  const o = p as { app?: string; keys?: Record<string, unknown>; exportedAt?: string }
  if (!o || o.app !== FORMAT || typeof o.keys !== 'object' || !o.keys) return { ok: false, error: 'This is not a Healthy Lifestyle backup file.' }
  const keys: Record<string, string> = {}
  for (const [k, v] of Object.entries(o.keys)) {
    if (!k.startsWith(PREFIX)) return { ok: false, error: `Unexpected key “${k}” — only healthy-* data can be imported.` }
    if (typeof v !== 'string') return { ok: false, error: `Value for “${k}” is not text.` }
    try {
      JSON.parse(v)
    } catch {
      return { ok: false, error: `Data for “${k}” is corrupted.` }
    }
    keys[k] = v
  }
  if (!Object.keys(keys).length) return { ok: false, error: 'The backup contains no data.' }
  const rows = Object.keys(keys).map((k) => {
    const cur = localStorage.getItem(k)
    return { key: k, status: (cur === null ? 'new' : 'replace') as PreviewRow['status'], now: cur === null ? '—' : summary(cur), incoming: summary(keys[k]) }
  })
  return { ok: true, keys, exportedAt: o.exportedAt ?? '', rows }
}
/** Writes every key in the backup (keys not in the backup are left alone), then reloads so all stores re-read storage. */
export function applyBackup(keys: Record<string, string>) {
  Object.entries(keys).forEach(([k, v]) => localStorage.setItem(k, v))
  location.reload()
}
export function resetEverything() {
  dataKeys().forEach((k) => localStorage.removeItem(k))
  location.reload()
}
export function storageBytes() {
  return dataKeys().reduce((n, k) => n + k.length + (localStorage.getItem(k) || '').length, 0) * 2
}
