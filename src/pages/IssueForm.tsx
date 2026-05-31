import { useState, useEffect, useRef, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, type Property, type Supplier, type IssueDetail, STATUSES, CATEGORIES, URGENCIES, AU_STATES } from '../lib/api'
import { PostcodeSuburbInput } from '../components/PostcodeSuburbInput'
import { parseEml, type ParsedAttachment } from '../lib/emailParser'

export function IssueForm({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [properties, setProperties] = useState<Property[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    property_id: '',
    title: '',
    category: '',
    urgency: 'Normal',
    status: 'New',
    description: '',
    next_action: '',
    next_due_date: '',
    supplier_id: '',
  })

  // Email import state
  const [emailFrom, setEmailFrom] = useState('')
  const [importedHtml, setImportedHtml] = useState('')
  const [emailAttachments, setEmailAttachments] = useState<ParsedAttachment[]>([])
  const [importing, setImporting] = useState(false)
  const emlRef = useRef<HTMLInputElement>(null)

  // Inline quick-add property state
  const [showAddProperty, setShowAddProperty] = useState(false)
  const [propForm, setPropForm] = useState({ ref: '', address: '', suburb: '', postcode: '', state: 'Queensland', owner_name: '', owner_email: '', tenant_name: '', tenant_phone: '' })
  const [savingProp, setSavingProp] = useState(false)

  const loadProperties = () => api.getProperties().then(p => {
    setProperties(p)
    return p
  })

  useEffect(() => {
    Promise.all([loadProperties(), api.getSuppliers()]).then(([, s]) => setSuppliers(s))
    if (mode === 'edit' && id) {
      api.getIssue(Number(id)).then((issue: IssueDetail) => {
        setForm({
          property_id: String(issue.property_id),
          title: issue.title,
          category: issue.category ?? '',
          urgency: issue.urgency,
          status: issue.status,
          description: issue.description ?? '',
          next_action: issue.next_action ?? '',
          next_due_date: issue.next_due_date ?? '',
          supplier_id: String(issue.supplier_id ?? ''),
        })
      })
    }
  }, [mode, id])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const setP = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPropForm(f => ({ ...f, [field]: e.target.value }))

  const handleSaveProperty = async (e: FormEvent) => {
    e.preventDefault()
    setSavingProp(true)
    try {
      const created = await api.createProperty(propForm)
      const updated = await loadProperties()
      // Auto-select the newly created property
      if (updated.find(p => p.id === created.id)) {
        setForm(f => ({ ...f, property_id: String(created.id) }))
      }
      setShowAddProperty(false)
      setPropForm({ ref: '', address: '', suburb: '', postcode: '', state: 'Queensland', owner_name: '', owner_email: '', tenant_name: '', tenant_phone: '' })
    } finally {
      setSavingProp(false)
    }
  }

  const handleImportEml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const parsed = await parseEml(file)
      setForm(f => ({ ...f, title: parsed.subject || f.title }))
      setEmailFrom(parsed.from)
      setImportedHtml(parsed.htmlBody)
      setEmailAttachments(parsed.attachments)
    } finally {
      setImporting(false)
      if (emlRef.current) emlRef.current.value = ''
    }
  }

  const clearImport = () => {
    setEmailFrom('')
    setImportedHtml('')
    setEmailAttachments([])
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...form,
        property_id: Number(form.property_id),
        supplier_id: form.supplier_id ? Number(form.supplier_id) : undefined,
        description: importedHtml || form.description || undefined,
      }
      if (mode === 'new') {
        const issue = await api.createIssue(payload)
        for (const att of emailAttachments) {
          const file = new File([att.blob], att.filename, { type: att.mimeType })
          await api.uploadAttachment(issue.id, file, 'Email attachment')
        }
        navigate(`/issues/${issue.id}`)
      } else {
        await api.updateIssue(Number(id), payload)
        navigate(`/issues/${id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <h1 className="text-xl font-semibold">{mode === 'new' ? 'New Issue' : 'Edit Issue'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Email import */}
        {mode === 'new' && (
          <div className={`rounded-xl border p-4 ${importedHtml ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Import from email</p>
                <p className="text-xs text-gray-400 mt-0.5">Download the email as .eml from Outlook Web (⋯ → Download), then import here</p>
              </div>
              {!importedHtml ? (
                <label className={`text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer border transition-colors ${importing ? 'text-gray-400 border-gray-200' : 'text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100'}`}>
                  {importing ? 'Importing…' : '📧 Import .eml'}
                  <input ref={emlRef} type="file" accept=".eml" className="hidden" onChange={handleImportEml} disabled={importing} />
                </label>
              ) : (
                <button type="button" onClick={clearImport} className="text-xs text-gray-400 hover:text-gray-600">✕ Clear</button>
              )}
            </div>

            {importedHtml && (
              <div className="mt-2 space-y-2">
                {emailFrom && (
                  <p className="text-xs text-blue-700">
                    <span className="font-medium">From:</span> {emailFrom}
                  </p>
                )}
                <div className="bg-white rounded-lg border border-blue-200 p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs text-gray-400 mb-1">Email body preview</p>
                  <div
                    className="text-xs text-gray-700 rich-text"
                    dangerouslySetInnerHTML={{ __html: importedHtml }}
                  />
                </div>
                {emailAttachments.length > 0 && (
                  <div>
                    <p className="text-xs text-blue-700 font-medium mb-1">{emailAttachments.length} attachment{emailAttachments.length > 1 ? 's' : ''} will be uploaded:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {emailAttachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1 bg-white border border-blue-200 rounded px-2 py-1 text-xs text-gray-600">
                          📎 {att.filename}
                          <button
                            type="button"
                            onClick={() => setEmailAttachments(prev => prev.filter((_, j) => j !== i))}
                            className="text-gray-300 hover:text-red-500 ml-1"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <Field label="Property *">
            <select value={form.property_id} onChange={set('property_id')} required className={inputCls}>
              <option value="">{properties.length === 0 ? 'No properties yet' : 'Select property…'}</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {[p.ref, p.address + (p.suburb ? `, ${p.suburb}` : '')].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>

            {/* Quick-add property */}
            {!showAddProperty ? (
              <button
                type="button"
                onClick={() => setShowAddProperty(true)}
                className="mt-1.5 text-xs text-blue-600 hover:text-blue-800"
              >
                + Add a property here
              </button>
            ) : (
              <div className="mt-3 border border-blue-200 rounded-lg bg-blue-50 p-3 space-y-2">
                <p className="text-xs font-medium text-blue-700 mb-2">New property</p>
                <MiniField label="Property ID">
                  <input value={propForm.ref} onChange={setP('ref')} placeholder="e.g. BP001" className={miniInput} />
                </MiniField>
                <MiniField label="Address *">
                  <input value={propForm.address} onChange={setP('address')} required placeholder="123 Example St" className={miniInput} />
                </MiniField>
                <PostcodeSuburbInput
                  postcode={propForm.postcode}
                  suburb={propForm.suburb}
                  onPostcodeChange={v => setPropForm(f => ({ ...f, postcode: v }))}
                  onSuburbChange={v => setPropForm(f => ({ ...f, suburb: v }))}
                  inputCls={miniInput}
                  size="mini"
                />
                <MiniField label="State">
                  <select value={propForm.state} onChange={setP('state')} className={miniInput}>
                    {AU_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </MiniField>
                <div className="grid grid-cols-2 gap-2">
                  <MiniField label="Owner name">
                    <input value={propForm.owner_name} onChange={setP('owner_name')} className={miniInput} />
                  </MiniField>
                  <MiniField label="Owner email">
                    <input type="email" value={propForm.owner_email} onChange={setP('owner_email')} className={miniInput} />
                  </MiniField>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MiniField label="Tenant name">
                    <input value={propForm.tenant_name} onChange={setP('tenant_name')} className={miniInput} />
                  </MiniField>
                  <MiniField label="Tenant phone">
                    <input value={propForm.tenant_phone} onChange={setP('tenant_phone')} className={miniInput} />
                  </MiniField>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveProperty}
                    disabled={savingProp || !propForm.address}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg"
                  >
                    {savingProp ? 'Saving…' : 'Save & select'}
                  </button>
                  <button type="button" onClick={() => setShowAddProperty(false)} className="text-xs text-gray-500 hover:text-gray-700">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Field>

          <Field label="Title *">
            <input value={form.title} onChange={set('title')} required placeholder="e.g. Kitchen tap leaking" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select value={form.category} onChange={set('category')} className={inputCls}>
                <option value="">— None —</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Urgency">
              <select value={form.urgency} onChange={set('urgency')} className={inputCls}>
                {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>

          {mode === 'edit' && (
            <Field label="Status">
              <select value={form.status} onChange={set('status')} className={inputCls}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          )}

          <Field label="Description">
            {importedHtml ? (
              <p className="text-xs text-blue-600 py-2">✓ Email body imported — editable on the issue page after saving</p>
            ) : (
              <textarea value={form.description} onChange={set('description')} rows={3} placeholder="Details from tenant, photos reference, etc." className={inputCls} />
            )}
          </Field>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <Field label="Supplier">
            <select value={form.supplier_id} onChange={set('supplier_id')} className={inputCls}>
              <option value="">— None assigned —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.trade ? ` (${s.trade})` : ''}</option>
              ))}
            </select>
          </Field>

          <Field label="Next Action">
            <input value={form.next_action} onChange={set('next_action')} placeholder="e.g. Follow up with supplier" className={inputCls} />
          </Field>

          <Field label="Due Date">
            <input type="date" value={form.next_due_date} onChange={set('next_due_date')} className={inputCls} />
          </Field>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Saving…' : mode === 'new' ? 'Create Issue' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-800 px-4 py-2.5 text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const miniInput = 'w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
      {children}
    </div>
  )
}
