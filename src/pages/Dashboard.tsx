import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, type Issue, type DashboardStats } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { UrgencyBadge } from '../components/UrgencyBadge'
import { fmtProperty, daysInStatus } from '../lib/utils'

function dueDayLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [actionIssues, setActionIssues] = useState<Issue[]>([])
  const [staleIssues, setStaleIssues] = useState<Issue[]>([])
  const [weekIssues, setWeekIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.dashboardStats(),
      api.dashboardIssues('action'),
      api.dashboardIssues('stale'),
      api.dashboardIssues('week'),
    ]).then(([s, action, stale, week]) => {
      setStats(s)
      setActionIssues(action)
      setStaleIssues(stale)
      setWeekIssues(week)
      setLoading(false)
    })
  }, [])

  const allClear = !loading && actionIssues.length === 0 && staleIssues.length === 0 && weekIssues.length === 0

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <Link
          to="/issues/new"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + New Issue
        </Link>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <SummaryCard label="Total open" value={stats?.total ?? '…'} />
        <SummaryCard label="Overdue" value={stats?.overdue ?? '…'} color="red" />
        <SummaryCard label="Needs chasing" value={stats?.stale ?? '…'} color="orange" />
        <SummaryCard label="Urgent" value={stats?.urgent ?? '…'} color="amber" />
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>
      ) : allClear ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-10 text-center">
          <p className="text-2xl mb-2">✓</p>
          <p className="text-green-800 font-medium text-base">All clear — nothing overdue or waiting on you</p>
          <Link to="/issues" className="text-sm text-green-600 hover:text-green-800 mt-2 inline-block">
            View all open issues →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <BriefingSection
            colorScheme="red"
            label="Action Needed"
            subtitle="Overdue or due today"
            issues={actionIssues}
            emptyText="Nothing overdue"
            renderMeta={(issue) =>
              <span className="text-xs font-semibold text-red-600 whitespace-nowrap">OVERDUE</span>
            }
          />

          <BriefingSection
            colorScheme="orange"
            label="Needs Chasing"
            subtitle="Waiting too long with no update"
            issues={staleIssues}
            emptyText="Nothing stale"
            renderMeta={(issue) => {
              const days = daysInStatus(issue.status_changed_at)
              return <span className="text-xs font-medium text-orange-600 whitespace-nowrap">{days}d waiting</span>
            }}
          />

          <BriefingSection
            colorScheme="blue"
            label="Due This Week"
            subtitle="Coming up in the next 7 days"
            issues={weekIssues}
            emptyText="Nothing due this week"
            renderMeta={(issue) =>
              issue.next_due_date
                ? <span className="text-xs font-medium text-blue-600 whitespace-nowrap">{dueDayLabel(issue.next_due_date)}</span>
                : null
            }
          />
        </div>
      )}
    </div>
  )
}

type BriefingSectionProps = {
  colorScheme: 'red' | 'orange' | 'blue'
  label: string
  subtitle: string
  issues: Issue[]
  emptyText: string
  renderMeta: (issue: Issue) => React.ReactNode
}

const sectionColors = {
  red:    { dot: 'bg-red-500',    header: 'text-red-700',    border: 'border-red-200',    bg: 'bg-red-50' },
  orange: { dot: 'bg-orange-400', header: 'text-orange-700', border: 'border-orange-200', bg: 'bg-orange-50' },
  blue:   { dot: 'bg-blue-500',   header: 'text-blue-700',   border: 'border-blue-200',   bg: 'bg-blue-50' },
}

function BriefingSection({ colorScheme, label, subtitle, issues, emptyText, renderMeta }: BriefingSectionProps) {
  const c = sectionColors[colorScheme]

  return (
    <div className={`rounded-xl border ${c.border} overflow-hidden`}>
      {/* Section header */}
      <div className={`${c.bg} px-4 py-3 flex items-center gap-3 border-b ${c.border}`}>
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`} />
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-semibold ${c.header}`}>{label}</span>
          <span className="text-xs text-gray-400 ml-2">{subtitle}</span>
        </div>
        <span className={`text-xs font-medium ${c.header} bg-white/70 px-2 py-0.5 rounded-full border ${c.border}`}>
          {issues.length}
        </span>
      </div>

      {issues.length === 0 ? (
        <div className="px-4 py-4 text-sm text-gray-400 bg-white">{emptyText} ✓</div>
      ) : (
        <div className="bg-white divide-y divide-gray-100">
          {issues.map(issue => (
            <div key={issue.id} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/issues/${issue.id}`}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate"
                  >
                    {issue.title}
                  </Link>
                  <UrgencyBadge urgency={issue.urgency} />
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-400">
                    {fmtProperty(issue.property_ref, issue.property_address, issue.property_suburb)}
                  </span>
                  <StatusBadge status={issue.status} />
                </div>
              </div>
              <div className="shrink-0">
                {renderMeta(issue)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number | string; color?: 'red' | 'orange' | 'amber' }) {
  const valueColor =
    color === 'red' ? 'text-red-600' :
    color === 'orange' ? 'text-orange-500' :
    color === 'amber' ? 'text-amber-600' :
    'text-gray-900'
  const borderColor =
    color === 'red' ? 'border-red-200' :
    color === 'orange' ? 'border-orange-200' :
    color === 'amber' ? 'border-amber-200' :
    'border-gray-200'
  return (
    <div className={`bg-white rounded-xl border ${borderColor} p-4`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
