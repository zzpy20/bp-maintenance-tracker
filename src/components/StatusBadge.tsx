const statusColors: Record<string, string> = {
  'New': 'bg-gray-100 text-gray-700',
  'Need Quote': 'bg-yellow-100 text-yellow-800',
  'Waiting Quote': 'bg-yellow-100 text-yellow-800',
  'Waiting Owner Approval': 'bg-purple-100 text-purple-800',
  'Owner Approved': 'bg-blue-100 text-blue-800',
  'Supplier Instructed': 'bg-blue-100 text-blue-800',
  'Waiting Repair': 'bg-orange-100 text-orange-800',
  'Waiting Invoice': 'bg-pink-100 text-pink-800',
  'Owner Notified': 'bg-teal-100 text-teal-800',
  'Closed': 'bg-green-100 text-green-800',
}

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'lg' }) {
  const cls = statusColors[status] ?? 'bg-gray-100 text-gray-600'
  const sizeCls = size === 'lg'
    ? 'px-4 py-1.5 rounded-lg text-sm font-semibold tracking-wide'
    : 'px-2 py-0.5 rounded text-xs font-medium'
  return (
    <span className={`inline-flex items-center ${sizeCls} ${cls}`}>
      {status}
    </span>
  )
}
