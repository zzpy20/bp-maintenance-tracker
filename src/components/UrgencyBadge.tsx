const urgencyColors: Record<string, string> = {
  'Urgent': 'bg-red-100 text-red-800',
  'High': 'bg-orange-100 text-orange-800',
  'Normal': 'bg-gray-100 text-gray-600',
  'Low': 'bg-gray-50 text-gray-400',
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === 'Normal' || urgency === 'Low') return null
  const cls = urgencyColors[urgency] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {urgency}
    </span>
  )
}
