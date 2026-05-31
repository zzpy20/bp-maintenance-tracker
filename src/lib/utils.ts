export function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function isOverdue(dateStr?: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr) < new Date(new Date().toDateString())
}

export function fmtProperty(ref?: string | null, address?: string | null, suburb?: string | null): string {
  const addr = address ? address + (suburb ? `, ${suburb}` : '') : ''
  return [ref, addr].filter(Boolean).join(' · ') || '—'
}

const STALE_DAYS: Record<string, number> = {
  'Need Quote': 3,
  'Waiting Quote': 3,
  'Waiting Owner Approval': 2,
  'Owner Approved': 2,
  'Supplier Instructed': 5,
  'Waiting Repair': 7,
  'Waiting Invoice': 5,
  'Owner Notified': 5,
}

export function daysInStatus(statusChangedAt?: string | null): number {
  if (!statusChangedAt) return 0
  return Math.floor((Date.now() - new Date(statusChangedAt).getTime()) / 86_400_000)
}

export function staleThreshold(status: string): number {
  return STALE_DAYS[status] ?? 7
}

export function staleness(status: string, statusChangedAt?: string | null): 'none' | 'warning' | 'critical' {
  if (!statusChangedAt || status === 'Closed' || status === 'New') return 'none'
  const days = daysInStatus(statusChangedAt)
  const threshold = staleThreshold(status)
  if (days >= threshold * 2) return 'critical'
  if (days >= threshold) return 'warning'
  return 'none'
}

export function fmtCurrency(amount?: number | null): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
}
