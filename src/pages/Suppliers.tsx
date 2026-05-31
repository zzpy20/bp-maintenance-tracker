import { useState, useEffect, FormEvent } from 'react'
import { api, type Supplier } from '../lib/api'

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = () => api.getSuppliers().then(s => { setSuppliers(s); setLoading(false) })
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(emptyForm()); setEditing(null); setShowForm(true) }
  const openEdit = (s: Supplier) => {
    setForm({ name: s.name, trade: s.trade ?? '', email: s.email ?? '', phone: s.phone ?? '', website: s.website ?? '' })
    setEditing(s)
    setShowForm(true)
  }

  const normaliseWebsite = (url: string) => {
    if (!url.trim()) return ''
    return /^https?:\/\//i.test(url) ? url : `https://${url}`
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const data = { ...form, website: normaliseWebsite(form.website) }
    if (editing) {
      await api.updateSupplier(editing.id, data)
    } else {
      await api.createSupplier(data)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this supplier?')) return
    await api.deleteSupplier(id)
    load()
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Suppliers</h1>
        <button onClick={openNew} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Add Supplier
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 max-w-md">
          <h2 className="text-sm font-semibold mb-4">{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Row label="Name *"><input value={form.name} onChange={set('name')} required className={inp} /></Row>
            <Row label="Trade (e.g. Plumber)"><input value={form.trade} onChange={set('trade')} className={inp} /></Row>
            <Row label="Phone"><input value={form.phone} onChange={set('phone')} className={inp} /></Row>
            <Row label="Email"><input type="email" value={form.email} onChange={set('email')} className={inp} /></Row>
            <Row label="Website"><input type="text" value={form.website} onChange={set('website')} placeholder="example.com" className={inp} /></Row>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium">
                {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-3 py-2">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : suppliers.length === 0 ? (
        <div className="text-gray-400 text-sm">No suppliers yet</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Trade</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Website</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.trade ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {s.website
                      ? <a href={s.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm truncate max-w-[180px] block">{s.website.replace(/^https?:\/\//, '')}</a>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(s)} className="text-xs text-gray-400 hover:text-gray-700 mr-3">Edit</button>
                    <button onClick={() => handleDelete(s.id)} className="text-xs text-gray-400 hover:text-red-600">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function emptyForm() {
  return { name: '', trade: '', email: '', phone: '', website: '' }
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
