import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⬜' },
  { to: '/issues', label: 'Issues', icon: '🔧' },
  { to: '/properties', label: 'Properties', icon: '🏠' },
  { to: '/suppliers', label: 'Suppliers', icon: '👷' },
]

export function Layout() {
  const { logout } = useAuth()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('nav_collapsed') === '1')

  const toggle = () => {
    setCollapsed(c => {
      const next = !c
      localStorage.setItem('nav_collapsed', next ? '1' : '0')
      return next
    })
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`bg-gray-900 text-white flex flex-col shrink-0 transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}>

        {/* Header */}
        <div className={`border-b border-gray-700 flex items-center ${collapsed ? 'justify-center py-4' : 'px-4 py-5'}`}>
          {collapsed ? (
            <span className="text-xs font-bold text-gray-300">BP</span>
          ) : (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest">BP</p>
              <h1 className="text-base font-semibold leading-tight">Maintenance Tracker</h1>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 py-2.5 text-sm transition-colors ${collapsed ? 'justify-center px-0' : 'px-4'} ${
                  isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <span className="text-base leading-none">{icon}</span>
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className={`border-t border-gray-700 py-3 flex flex-col gap-2 ${collapsed ? 'items-center px-0' : 'px-4'}`}>
          <button
            onClick={toggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
          >
            {collapsed ? '›' : '‹ Hide'}
          </button>
          {!collapsed && (
            <button onClick={logout} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Sign out
            </button>
          )}
          {collapsed && (
            <button onClick={logout} title="Sign out" className="text-gray-500 hover:text-gray-300 transition-colors text-xs">
              ⏻
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
