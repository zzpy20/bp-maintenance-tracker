const getToken = () => localStorage.getItem('bp_token')

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (res.status === 401) {
    localStorage.removeItem('bp_token')
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  // Dashboard
  dashboardStats: () => req<DashboardStats>('/api/dashboard/stats'),
  dashboardIssues: (filter: string) => req<Issue[]>(`/api/dashboard/issues?filter=${filter}`),

  // Properties
  getProperties: () => req<Property[]>('/api/properties'),
  getProperty: (id: number) => req<Property>(`/api/properties/${id}`),
  createProperty: (data: Partial<Property>) => req<Property>('/api/properties', { method: 'POST', body: JSON.stringify(data) }),
  updateProperty: (id: number, data: Partial<Property>) => req<Property>(`/api/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProperty: (id: number) => req<{ ok: boolean }>(`/api/properties/${id}`, { method: 'DELETE' }),

  // Issues
  getIssues: (params?: { property_id?: number; status?: string }) => {
    const q = new URLSearchParams()
    if (params?.property_id) q.set('property_id', String(params.property_id))
    if (params?.status) q.set('status', params.status)
    return req<Issue[]>(`/api/issues?${q}`)
  },
  getIssue: (id: number) => req<IssueDetail>(`/api/issues/${id}`),
  createIssue: (data: Partial<Issue>) => req<Issue>('/api/issues', { method: 'POST', body: JSON.stringify(data) }),
  updateIssue: (id: number, data: Partial<Issue> & { note?: string }) => req<Issue>(`/api/issues/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteIssue: (id: number) => req<{ ok: boolean }>(`/api/issues/${id}`, { method: 'DELETE' }),
  addNote: (id: number, note: string, action?: string) => req<{ ok: boolean }>(`/api/issues/${id}/notes`, { method: 'POST', body: JSON.stringify({ note, ...(action ? { action } : {}) }) }),

  // Suppliers
  getSuppliers: () => req<Supplier[]>('/api/suppliers'),
  createSupplier: (data: Partial<Supplier>) => req<Supplier>('/api/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: Partial<Supplier>) => req<Supplier>(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: number) => req<{ ok: boolean }>(`/api/suppliers/${id}`, { method: 'DELETE' }),

  // Quotes
  addQuote: (issueId: number, data: { amount?: string; file?: File; status?: string; supplier_id?: number }) => {
    const token = getToken()
    const form = new FormData()
    if (data.amount) form.append('amount', data.amount)
    if (data.file) form.append('file', data.file)
    if (data.status) form.append('status', data.status)
    if (data.supplier_id) form.append('supplier_id', String(data.supplier_id))
    return fetch(`/api/issues/${issueId}/quotes`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json() as Promise<Quote>)
  },
  updateQuote: (id: number, data: { status?: string; amount?: number }) => req<Quote>(`/api/quotes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteQuote: (id: number) => req<{ ok: boolean }>(`/api/quotes/${id}`, { method: 'DELETE' }),

  // Invoices
  addInvoice: (issueId: number, data: { amount?: string; file?: File; supplier_id?: number }) => {
    const token = getToken()
    const form = new FormData()
    if (data.amount) form.append('amount', data.amount)
    if (data.file) form.append('file', data.file)
    if (data.supplier_id) form.append('supplier_id', String(data.supplier_id))
    return fetch(`/api/issues/${issueId}/invoices`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json() as Promise<Invoice>)
  },
  updateInvoice: (id: number, data: { sent_to_owner_at?: string; amount?: number }) => req<Invoice>(`/api/invoices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteInvoice: (id: number) => req<{ ok: boolean }>(`/api/invoices/${id}`, { method: 'DELETE' }),

  // Attachments
  uploadAttachment: (issueId: number, file: File, type: string) => {
    const token = getToken()
    const form = new FormData()
    form.append('file', file)
    form.append('type', type)
    return fetch(`/api/issues/${issueId}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json() as Promise<Attachment>)
  },
  downloadAttachment: (id: number) => `/api/attachments/${id}/download`,
  deleteAttachment: (id: number) => req<{ ok: boolean }>(`/api/attachments/${id}`, { method: 'DELETE' }),
}

// ── Types ─────────────────────────────────────────────────────────────────────

export const AU_STATES = [
  'Queensland',
  'New South Wales',
  'Victoria',
  'South Australia',
  'Western Australia',
  'Tasmania',
  'Australian Capital Territory',
  'Northern Territory',
]

export type Property = {
  id: number
  ref?: string
  address: string
  suburb?: string
  state: string
  postcode?: string
  notes?: string
  owner_name?: string
  owner_email?: string
  tenant_name?: string
  tenant_email?: string
  tenant_phone?: string
  open_issues?: number
  created_at: string
  updated_at: string
}

export type Issue = {
  id: number
  property_id: number
  supplier_id?: number
  title: string
  category?: string
  urgency: string
  status: string
  description?: string
  next_action?: string
  next_due_date?: string
  property_address?: string
  property_suburb?: string
  property_ref?: string
  supplier_name?: string
  created_at: string
  updated_at: string
  closed_at?: string
  status_changed_at?: string
}

export type IssueLink = { label: string; url: string }

export type IssueDetail = Issue & {
  links?: IssueLink[]
  property_ref?: string
  property_state?: string
  property_postcode?: string
  property_notes?: string
  owner_name?: string
  owner_email?: string
  tenant_name?: string
  tenant_email?: string
  tenant_phone?: string
  supplier_phone?: string
  supplier_email?: string
  attachments: Attachment[]
  activity: ActivityLog[]
  quotes: Quote[]
  invoices: Invoice[]
}

export type Supplier = {
  id: number
  name: string
  trade?: string
  email?: string
  phone?: string
  website?: string
  created_at: string
  updated_at: string
}

export type Quote = {
  id: number
  issue_id: number
  supplier_id?: number
  supplier_name?: string
  amount?: number
  status: string
  file_url?: string
  filename?: string
  received_at: string
}

export type Invoice = {
  id: number
  issue_id: number
  supplier_id?: number
  supplier_name?: string
  amount?: number
  file_url?: string
  filename?: string
  received_at: string
  sent_to_owner_at?: string
}

export type Attachment = {
  id: number
  issue_id: number
  type: string
  filename: string
  r2_key: string
  uploaded_at: string
}

export type ActivityLog = {
  id: number
  issue_id: number
  action: string
  note?: string
  created_at: string
}

export type DashboardStats = {
  total: number
  byStatus: { status: string; count: number }[]
  overdue: number
  urgent: number
  stale: number
}

export const STATUSES = [
  'New',
  'Need Quote',
  'Waiting Quote',
  'Waiting Owner Approval',
  'Owner Approved',
  'Supplier Instructed',
  'Waiting Repair',
  'Waiting Invoice',
  'Owner Notified',
  'Closed',
]

export const CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Appliance',
  'Structural',
  'Pest Control',
  'Cleaning',
  'Garden',
  'Lock / Security',
  'HVAC',
  'Other',
]

export const URGENCIES = ['Urgent', 'High', 'Normal', 'Low']

export const NEXT_ACTIONS = [
  'Obtain quotes from supplier',
  'Send quote to owner for approval',
  'Schedule supplier to attend',
  'Issue work order to supplier',
  'Follow up with supplier',
  'Follow up with owner',
  'Request invoice from supplier',
  'Forward invoice to owner',
  'Confirm repair completion with tenant',
]

export const isImageFile = (filename: string) =>
  /\.(jpg|jpeg|png|gif|webp|heic|heif|avif|bmp)$/i.test(filename)

export const isPdfFile = (filename: string) => /\.pdf$/i.test(filename)

export const isVideoFile = (filename: string) =>
  /\.(mp4|mov|webm|avi|mkv|m4v|ogv)$/i.test(filename)

export const isMediaFile = (filename: string) =>
  isImageFile(filename) || isVideoFile(filename)
