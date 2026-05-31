import { useState, useEffect, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type Property, AU_STATES } from '../lib/api'
import { PostcodeSuburbInput } from '../components/PostcodeSuburbInput'

export function Properties() {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = () => api.getProperties().then(p => { setProperties(p); setLoading(false) })
  useEffect(() => { load() }, [])

  const openNew = () => { setForm(emptyForm()); setEditing(null); setShowForm(true) }
  const openEdit = (p: Property) => {
    setForm({
      ref: p.ref ?? '', address: p.address, suburb: p.suburb ?? '',
      state: p.state ?? 'Queensland', postcode: p.postcode ?? '',
      owner_name: p.owner_name ?? '', owner_email: p.owner_email ?? '',
      tenant_name: p.tenant_name ?? '', tenant_email: p.tenant_email ?? '',
      tenant_phone: p.tenant_phone ?? '', notes: p.notes ?? '',
    })
    setEditing(p)
    setShowForm(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    if (editing) {
      await api.updateProperty(editing.id, form)
    } else {
      await api.createProperty(form)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this property?')) return
    await api.deleteProperty(id)
    load()
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const q = search.toLowerCase()
  const filtered = properties.filter(p => {
    if (!q) return true
    return (
      p.ref?.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      p.suburb?.toLowerCase().includes(q) ||
      p.postcode?.toLowerCase().includes(q) ||
      p.state?.toLowerCase().includes(q) ||
      p.owner_name?.toLowerCase().includes(q) ||
      p.owner_email?.toLowerCase().includes(q) ||
      p.tenant_name?.toLowerCase().includes(q) ||
      p.tenant_phone?.toLowerCase().includes(q) ||
      p.notes?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Properties</h1>
        <button onClick={openNew} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Add Property
        </button>
      </div>
      <div className="mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by address, suburb, postcode, owner, tenant…"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 max-w-lg">
          <h2 className="text-sm font-semibold mb-4">{editing ? 'Edit Property' : 'New Property'}</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <FormRow label="Property ID">
              <input value={form.ref} onChange={set('ref')} placeholder="e.g. BP001" className={inp} />
              <p className="text-xs text-gray-400 mt-0.5">Your own reference code — can be changed later</p>
            </FormRow>

            <FormRow label="Address *">
              <input value={form.address} onChange={set('address')} required className={inp} />
            </FormRow>

            <PostcodeSuburbInput
              postcode={form.postcode}
              suburb={form.suburb}
              onPostcodeChange={v => setForm(f => ({ ...f, postcode: v }))}
              onSuburbChange={v => setForm(f => ({ ...f, suburb: v }))}
              inputCls={inp}
            />

            <FormRow label="State">
              <select value={form.state} onChange={set('state')} className={inp}>
                {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormRow>

            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Owner Name"><input value={form.owner_name} onChange={set('owner_name')} className={inp} /></FormRow>
              <FormRow label="Owner Email"><input type="email" value={form.owner_email} onChange={set('owner_email')} className={inp} /></FormRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormRow label="Tenant Name"><input value={form.tenant_name} onChange={set('tenant_name')} className={inp} /></FormRow>
              <FormRow label="Tenant Phone"><input value={form.tenant_phone} onChange={set('tenant_phone')} className={inp} /></FormRow>
            </div>
            <FormRow label="Tenant Email"><input type="email" value={form.tenant_email} onChange={set('tenant_email')} className={inp} /></FormRow>

            <FormRow label="Notes">
              <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Key access, parking, special instructions…" className={inp} />
            </FormRow>

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
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-sm col-span-full py-8 text-center">No properties match your search</p>
          ) : null}
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{p.suburb || p.address}</p>
                    {p.ref && <span className="text-xs font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{p.ref}</span>}
                  </div>
                  {p.suburb && <p className="text-xs text-gray-400">{p.address}</p>}
                  <p className="text-xs text-gray-400">{[p.suburb, p.postcode, p.state].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-gray-700">Edit</button>
                  <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-600">Delete</button>
                </div>
              </div>
              <div className="space-y-0.5 text-xs text-gray-500">
                {p.owner_name && <p>Owner: {p.owner_name}</p>}
                {p.tenant_name && <p>Tenant: {p.tenant_name} {p.tenant_phone ? `· ${p.tenant_phone}` : ''}</p>}
                {p.notes && <p className="text-gray-400 italic truncate">{p.notes}</p>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className={`text-xs font-medium ${(p.open_issues ?? 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                  {p.open_issues ?? 0} open issue{p.open_issues !== 1 ? 's' : ''}
                </span>
                <Link to={`/issues?property_id=${p.id}`} className="text-xs text-blue-600 hover:underline">
                  View issues →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function emptyForm() {
  return { ref: '', address: '', suburb: '', state: 'Queensland', postcode: '', owner_name: '', owner_email: '', tenant_name: '', tenant_email: '', tenant_phone: '', notes: '' }
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
