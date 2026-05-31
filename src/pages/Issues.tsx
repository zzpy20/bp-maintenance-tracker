import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, type Issue, STATUSES } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { UrgencyBadge } from '../components/UrgencyBadge'
import { fmtDate, isOverdue, fmtProperty, staleness, daysInStatus } from '../lib/utils'

export function Issues() {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    const params = statusFilter === 'open' ? {} : statusFilter === 'all' ? { status: 'all' } : { status: statusFilter }
    api.getIssues(params).then(data => {
      setIssues(data)
      setLoading(false)
    })
  }, [statusFilter])

  const q = search.toLowerCase()
  const filtered = issues.filter(i => {
    if (!q) return true
    return (
      i.title.toLowerCase().includes(q) ||
      i.property_ref?.toLowerCase().includes(q) ||
      i.property_address?.toLowerCase().includes(q) ||
      i.property_suburb?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      i.supplier_name?.toLowerCase().includes(q) ||
      i.status.toLowerCase().includes(q) ||
      i.urgency.toLowerCase().includes(q) ||
      i.next_action?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Issues</h1>
        <Link to="/issues/new" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + New Issue
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search issues…"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="open">All Open</option>
          <option value="all">All (incl. Closed)</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No issues found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Issue</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Property</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Due</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden xl:table-cell">Supplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(issue => (
                <tr key={issue.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/issues/${issue.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                      {issue.title}
                    </Link>
                    <div className="mt-0.5 flex gap-1 flex-wrap">
                      <UrgencyBadge urgency={issue.urgency} />
                      {issue.category && <span className="text-xs text-gray-400">{issue.category}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                    {fmtProperty(issue.property_ref, issue.property_address, issue.property_suburb)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={issue.status} />
                      {(() => {
                        const s = staleness(issue.status, issue.status_changed_at)
                        if (s === 'none') return null
                        const days = daysInStatus(issue.status_changed_at)
                        return (
                          <span className={`text-xs font-medium ${s === 'critical' ? 'text-red-600' : 'text-orange-500'}`}>
                            {days}d waiting
                          </span>
                        )
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className={isOverdue(issue.next_due_date) ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {fmtDate(issue.next_due_date)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden xl:table-cell">
                    {issue.supplier_name ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
