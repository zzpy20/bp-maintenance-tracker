import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { sign } from 'hono/jwt'
import type { Env, Variables } from './types'

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use('/api/*', cors({ origin: '*', credentials: true }))

// ── Auth ─────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (c) => {
  const { password } = await c.req.json<{ password: string }>()
  if (password !== c.env.AUTH_PASSWORD) {
    return c.json({ error: 'Invalid password' }, 401)
  }
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
  const token = await sign({ sub: 'admin', exp }, c.env.JWT_SECRET)
  return c.json({ token })
})

// All routes below require JWT
app.use('/api/*', (c, next) => jwt({ secret: c.env.JWT_SECRET, alg: 'HS256' })(c, next))

// ── Dashboard ─────────────────────────────────────────────────────────────────

app.get('/api/dashboard/stats', async (c) => {
  const db = c.env.DB
  const today = new Date().toISOString().split('T')[0]

  const [total, byStatus, overdue, urgent, stale] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM issues WHERE status != 'Closed'").first<{ count: number }>(),
    db.prepare("SELECT status, COUNT(*) as count FROM issues WHERE status != 'Closed' GROUP BY status").all(),
    db.prepare("SELECT COUNT(*) as count FROM issues WHERE next_due_date < ? AND status != 'Closed'").bind(today).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM issues WHERE urgency = 'Urgent' AND status != 'Closed'").first<{ count: number }>(),
    db.prepare(`SELECT COUNT(*) as count FROM issues WHERE status NOT IN ('Closed','New') AND julianday('now') - julianday(status_changed_at) >= CASE status WHEN 'Need Quote' THEN 3 WHEN 'Waiting Quote' THEN 3 WHEN 'Waiting Owner Approval' THEN 2 WHEN 'Owner Approved' THEN 2 WHEN 'Supplier Instructed' THEN 5 WHEN 'Waiting Repair' THEN 7 WHEN 'Waiting Invoice' THEN 5 WHEN 'Owner Notified' THEN 5 ELSE 7 END`).first<{ count: number }>(),
  ])

  return c.json({
    total: total?.count ?? 0,
    byStatus: byStatus.results,
    overdue: overdue?.count ?? 0,
    urgent: urgent?.count ?? 0,
    stale: stale?.count ?? 0,
  })
})

app.get('/api/dashboard/issues', async (c) => {
  const filter = c.req.query('filter') ?? 'action'
  const today = new Date().toISOString().split('T')[0]

  const baseSelect = `
    SELECT i.*, p.address as property_address, p.suburb as property_suburb, p.ref as property_ref,
           s.name as supplier_name
    FROM issues i
    LEFT JOIN properties p ON i.property_id = p.id
    LEFT JOIN suppliers s ON i.supplier_id = s.id
  `

  let query = ''
  if (filter === 'action') {
    query = `${baseSelect} WHERE i.next_due_date <= ? AND i.status != 'Closed' ORDER BY i.next_due_date ASC LIMIT 50`
    const result = await c.env.DB.prepare(query).bind(today).all()
    return c.json(result.results)
  } else if (filter === 'urgent') {
    query = `${baseSelect} WHERE i.urgency = 'Urgent' AND i.status != 'Closed' ORDER BY i.created_at DESC LIMIT 50`
  } else if (filter === 'owner') {
    query = `${baseSelect} WHERE i.status = 'Waiting Owner Approval' ORDER BY i.updated_at ASC LIMIT 50`
  } else if (filter === 'supplier') {
    query = `${baseSelect} WHERE i.status IN ('Waiting Quote','Supplier Instructed','Waiting Repair') ORDER BY i.updated_at ASC LIMIT 50`
  } else if (filter === 'invoice') {
    query = `${baseSelect} WHERE i.status = 'Waiting Invoice' ORDER BY i.updated_at ASC LIMIT 50`
  } else if (filter === 'stale') {
    query = `${baseSelect} WHERE i.status NOT IN ('Closed','New') AND julianday('now') - julianday(i.status_changed_at) >= CASE i.status WHEN 'Need Quote' THEN 3 WHEN 'Waiting Quote' THEN 3 WHEN 'Waiting Owner Approval' THEN 2 WHEN 'Owner Approved' THEN 2 WHEN 'Supplier Instructed' THEN 5 WHEN 'Waiting Repair' THEN 7 WHEN 'Waiting Invoice' THEN 5 WHEN 'Owner Notified' THEN 5 ELSE 7 END ORDER BY i.status_changed_at ASC LIMIT 100`
  } else if (filter === 'week') {
    const nextWeekStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    query = `${baseSelect} WHERE i.next_due_date > ? AND i.next_due_date <= ? AND i.status != 'Closed' ORDER BY i.next_due_date ASC LIMIT 50`
    const result = await c.env.DB.prepare(query).bind(today, nextWeekStr).all()
    return c.json(result.results)
  } else if (filter === 'all') {
    query = `${baseSelect} WHERE i.status != 'Closed' ORDER BY i.updated_at DESC LIMIT 100`
  } else {
    query = `${baseSelect} WHERE i.status != 'Closed' ORDER BY i.updated_at DESC LIMIT 50`
  }

  const result = await c.env.DB.prepare(query).all()
  return c.json(result.results)
})

// ── Properties ────────────────────────────────────────────────────────────────

app.get('/api/properties', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT *, (SELECT COUNT(*) FROM issues WHERE property_id = properties.id AND status != \'Closed\') as open_issues FROM properties ORDER BY address'
  ).all()
  return c.json(result.results)
})

app.post('/api/properties', async (c) => {
  const body = await c.req.json<{
    address: string; ref?: string; suburb?: string; state?: string; postcode?: string
    owner_name?: string; owner_email?: string; tenant_name?: string; tenant_email?: string; tenant_phone?: string; notes?: string
  }>()
  const result = await c.env.DB.prepare(
    'INSERT INTO properties (ref, address, suburb, state, postcode, owner_name, owner_email, tenant_name, tenant_email, tenant_phone, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *'
  ).bind(body.ref || null, body.address, body.suburb ?? null, body.state ?? 'Queensland', body.postcode ?? null, body.owner_name ?? null, body.owner_email ?? null, body.tenant_name ?? null, body.tenant_email ?? null, body.tenant_phone ?? null, body.notes ?? null).first()
  return c.json(result, 201)
})

app.get('/api/properties/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(c.req.param('id')).first()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(row)
})

app.put('/api/properties/:id', async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const result = await c.env.DB.prepare(
    'UPDATE properties SET ref=?,address=?,suburb=?,state=?,postcode=?,owner_name=?,owner_email=?,tenant_name=?,tenant_email=?,tenant_phone=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *'
  ).bind(body.ref || null, body.address, body.suburb ?? null, body.state ?? 'Queensland', body.postcode ?? null, body.owner_name ?? null, body.owner_email ?? null, body.tenant_name ?? null, body.tenant_email ?? null, body.tenant_phone ?? null, body.notes ?? null, c.req.param('id')).first()
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

app.delete('/api/properties/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM properties WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ── Issues ────────────────────────────────────────────────────────────────────

app.get('/api/issues', async (c) => {
  const propertyId = c.req.query('property_id')
  const status = c.req.query('status')
  let query = `SELECT i.*, p.address as property_address, p.suburb as property_suburb, p.ref as property_ref, s.name as supplier_name
    FROM issues i
    LEFT JOIN properties p ON i.property_id = p.id
    LEFT JOIN suppliers s ON i.supplier_id = s.id WHERE 1=1`
  const params: (string | number)[] = []
  if (propertyId) { query += ' AND i.property_id = ?'; params.push(propertyId) }
  if (status && status !== 'all') { query += " AND i.status = ?"; params.push(status) }
  else if (!status) { query += " AND i.status != 'Closed'" }
  query += ' ORDER BY i.updated_at DESC LIMIT 200'
  const result = await c.env.DB.prepare(query).bind(...params).all()
  return c.json(result.results)
})

app.post('/api/issues', async (c) => {
  const body = await c.req.json<{
    property_id: number; title: string; category?: string; urgency?: string
    description?: string; next_action?: string; next_due_date?: string; supplier_id?: number
  }>()
  const result = await c.env.DB.prepare(
    'INSERT INTO issues (property_id, title, category, urgency, description, next_action, next_due_date, supplier_id) VALUES (?,?,?,?,?,?,?,?) RETURNING *'
  ).bind(body.property_id, body.title, body.category ?? null, body.urgency ?? 'Normal', body.description ?? null, body.next_action ?? null, body.next_due_date ?? null, body.supplier_id ?? null).first()

  await c.env.DB.prepare('INSERT INTO activity_log (issue_id, action, note) VALUES (?,?,?)').bind((result as { id: number }).id, 'Created', body.title).run()
  return c.json(result, 201)
})

app.get('/api/issues/:id', async (c) => {
  const [issue, attachments, activityLog, quotes, invoices] = await Promise.all([
    c.env.DB.prepare(`SELECT i.*, p.address as property_address, p.suburb as property_suburb, p.ref as property_ref, p.state as property_state, p.postcode as property_postcode, p.notes as property_notes, p.owner_name, p.owner_email, p.tenant_name, p.tenant_email, p.tenant_phone, s.name as supplier_name, s.phone as supplier_phone, s.email as supplier_email
      FROM issues i LEFT JOIN properties p ON i.property_id = p.id LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.id = ?`).bind(c.req.param('id')).first(),
    c.env.DB.prepare('SELECT * FROM attachments WHERE issue_id = ? ORDER BY uploaded_at DESC').bind(c.req.param('id')).all(),
    c.env.DB.prepare('SELECT * FROM activity_log WHERE issue_id = ? ORDER BY created_at DESC').bind(c.req.param('id')).all(),
    c.env.DB.prepare('SELECT q.*, s.name as supplier_name FROM quotes q LEFT JOIN suppliers s ON q.supplier_id = s.id WHERE q.issue_id = ? ORDER BY q.received_at DESC').bind(c.req.param('id')).all(),
    c.env.DB.prepare('SELECT inv.*, s.name as supplier_name FROM invoices inv LEFT JOIN suppliers s ON inv.supplier_id = s.id WHERE inv.issue_id = ? ORDER BY inv.received_at DESC').bind(c.req.param('id')).all(),
  ])
  if (!issue) return c.json({ error: 'Not found' }, 404)
  const iss = issue as Record<string, unknown>
  return c.json({
    ...iss,
    links: iss.links ? JSON.parse(iss.links as string) : [],
    attachments: attachments.results,
    activity: activityLog.results,
    quotes: quotes.results,
    invoices: invoices.results,
  })
})

app.put('/api/issues/:id', async (c) => {
  const body = await c.req.json<Record<string, string | number | null>>()
  const existing = await c.env.DB.prepare('SELECT status FROM issues WHERE id = ?').bind(c.req.param('id')).first<{ status: string }>()
  const result = await c.env.DB.prepare(
    'UPDATE issues SET title=?,category=?,urgency=?,status=?,description=?,next_action=?,next_due_date=?,supplier_id=?,links=?,updated_at=CURRENT_TIMESTAMP,status_changed_at=CASE WHEN status!=? THEN CURRENT_TIMESTAMP ELSE status_changed_at END,closed_at=CASE WHEN ?=\'Closed\' AND closed_at IS NULL THEN CURRENT_TIMESTAMP ELSE closed_at END WHERE id=? RETURNING *'
  ).bind(body.title, body.category ?? null, body.urgency, body.status, body.description ?? null, body.next_action ?? null, body.next_due_date ?? null, body.supplier_id ?? null, body.links ? JSON.stringify(body.links) : null, body.status, body.status, c.req.param('id')).first()
  if (!result) return c.json({ error: 'Not found' }, 404)

  if (existing && existing.status !== body.status) {
    await c.env.DB.prepare('INSERT INTO activity_log (issue_id, action, note) VALUES (?,?,?)').bind(c.req.param('id'), 'Status changed', `${existing.status} → ${body.status}`).run()
  }
  if (body.note) {
    await c.env.DB.prepare('INSERT INTO activity_log (issue_id, action, note) VALUES (?,?,?)').bind(c.req.param('id'), 'Note', body.note).run()
  }
  return c.json(result)
})

app.delete('/api/issues/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM issues WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

app.post('/api/issues/:id/notes', async (c) => {
  const body = await c.req.json<{ note?: string; action?: string }>()
  const action = body.action ?? 'Note'
  const note = body.note ?? null
  await c.env.DB.prepare('INSERT INTO activity_log (issue_id, action, note) VALUES (?,?,?)').bind(c.req.param('id'), action, note).run()
  return c.json({ ok: true })
})

// ── Suppliers ─────────────────────────────────────────────────────────────────

app.get('/api/suppliers', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM suppliers ORDER BY name').all()
  return c.json(result.results)
})

app.post('/api/suppliers', async (c) => {
  const body = await c.req.json<{ name: string; trade?: string; email?: string; phone?: string; website?: string }>()
  const result = await c.env.DB.prepare(
    'INSERT INTO suppliers (name, trade, email, phone, website) VALUES (?,?,?,?,?) RETURNING *'
  ).bind(body.name, body.trade ?? null, body.email ?? null, body.phone ?? null, body.website ?? null).first()
  return c.json(result, 201)
})

app.put('/api/suppliers/:id', async (c) => {
  const body = await c.req.json<Record<string, string>>()
  const result = await c.env.DB.prepare(
    'UPDATE suppliers SET name=?,trade=?,email=?,phone=?,website=?,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *'
  ).bind(body.name, body.trade ?? null, body.email ?? null, body.phone ?? null, body.website ?? null, c.req.param('id')).first()
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

app.delete('/api/suppliers/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM suppliers WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

// ── Quotes ────────────────────────────────────────────────────────────────────

app.post('/api/issues/:id/quotes', async (c) => {
  const fd = await c.req.formData()
  const amount = fd.get('amount') ? Number(fd.get('amount')) : null
  const supplierId = fd.get('supplier_id') ? Number(fd.get('supplier_id')) : null
  const status = (fd.get('status') as string | null) ?? 'Received'
  const file = fd.get('file') as File | null

  let r2Key: string | null = null
  let filename: string | null = null
  if (file && file.size > 0) {
    const ext = file.name.split('.').pop() ?? 'bin'
    r2Key = `quotes/${c.req.param('id')}/${Date.now()}-${crypto.randomUUID()}.${ext}`
    await c.env.FILES.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } })
    filename = file.name
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO quotes (issue_id, supplier_id, amount, status, file_url, filename) VALUES (?,?,?,?,?,?) RETURNING *'
  ).bind(c.req.param('id'), supplierId, amount, status, r2Key, filename).first()
  await c.env.DB.prepare('INSERT INTO activity_log (issue_id, action, note) VALUES (?,?,?)')
    .bind(c.req.param('id'), 'Quote added', amount != null ? `$${amount.toFixed(2)}` : 'TBD').run()
  return c.json(result, 201)
})

app.put('/api/quotes/:id', async (c) => {
  const body = await c.req.json<{ status?: string; amount?: number }>()
  const result = await c.env.DB.prepare(
    'UPDATE quotes SET status=COALESCE(?,status), amount=COALESCE(?,amount) WHERE id=? RETURNING *'
  ).bind(body.status ?? null, body.amount ?? null, c.req.param('id')).first()
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

app.delete('/api/quotes/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(c.req.param('id')).first<{ file_url: string | null; issue_id: number }>()
  if (!row) return c.json({ error: 'Not found' }, 404)
  if (row.file_url) await c.env.FILES.delete(row.file_url)
  await c.env.DB.prepare('DELETE FROM quotes WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

app.get('/api/quotes/:id/download', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM quotes WHERE id = ?').bind(c.req.param('id')).first<{ file_url: string | null; filename: string | null }>()
  if (!row || !row.file_url) return c.json({ error: 'Not found' }, 404)
  const obj = await c.env.FILES.get(row.file_url)
  if (!obj) return c.json({ error: 'File not found in storage' }, 404)
  const headers = new Headers()
  headers.set('Content-Disposition', `attachment; filename="${row.filename ?? 'quote'}"`)
  obj.writeHttpMetadata(headers)
  return new Response(obj.body, { headers })
})

// ── Invoices ──────────────────────────────────────────────────────────────────

app.post('/api/issues/:id/invoices', async (c) => {
  const fd = await c.req.formData()
  const amount = fd.get('amount') ? Number(fd.get('amount')) : null
  const supplierId = fd.get('supplier_id') ? Number(fd.get('supplier_id')) : null
  const file = fd.get('file') as File | null

  let r2Key: string | null = null
  let filename: string | null = null
  if (file && file.size > 0) {
    const ext = file.name.split('.').pop() ?? 'bin'
    r2Key = `invoices/${c.req.param('id')}/${Date.now()}-${crypto.randomUUID()}.${ext}`
    await c.env.FILES.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } })
    filename = file.name
  }

  const result = await c.env.DB.prepare(
    'INSERT INTO invoices (issue_id, supplier_id, amount, file_url, filename) VALUES (?,?,?,?,?) RETURNING *'
  ).bind(c.req.param('id'), supplierId, amount, r2Key, filename).first()
  await c.env.DB.prepare('INSERT INTO activity_log (issue_id, action, note) VALUES (?,?,?)')
    .bind(c.req.param('id'), 'Invoice added', amount != null ? `$${amount.toFixed(2)}` : 'TBD').run()
  return c.json(result, 201)
})

app.put('/api/invoices/:id', async (c) => {
  const body = await c.req.json<{ sent_to_owner_at?: string; amount?: number }>()
  const result = await c.env.DB.prepare(
    'UPDATE invoices SET sent_to_owner_at=COALESCE(?,sent_to_owner_at), amount=COALESCE(?,amount) WHERE id=? RETURNING *'
  ).bind(body.sent_to_owner_at ?? null, body.amount ?? null, c.req.param('id')).first()
  if (!result) return c.json({ error: 'Not found' }, 404)
  return c.json(result)
})

app.delete('/api/invoices/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(c.req.param('id')).first<{ file_url: string | null; issue_id: number }>()
  if (!row) return c.json({ error: 'Not found' }, 404)
  if (row.file_url) await c.env.FILES.delete(row.file_url)
  await c.env.DB.prepare('DELETE FROM invoices WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ ok: true })
})

app.get('/api/invoices/:id/download', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(c.req.param('id')).first<{ file_url: string | null; filename: string | null }>()
  if (!row || !row.file_url) return c.json({ error: 'Not found' }, 404)
  const obj = await c.env.FILES.get(row.file_url)
  if (!obj) return c.json({ error: 'File not found in storage' }, 404)
  const headers = new Headers()
  headers.set('Content-Disposition', `attachment; filename="${row.filename ?? 'invoice'}"`)
  obj.writeHttpMetadata(headers)
  return new Response(obj.body, { headers })
})

// ── File Uploads ──────────────────────────────────────────────────────────────

app.post('/api/issues/:id/attachments', async (c) => {
  const issueId = c.req.param('id')
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const type = (formData.get('type') as string) ?? 'General'

  if (!file) return c.json({ error: 'No file provided' }, 400)

  const ext = file.name.split('.').pop() ?? 'bin'
  const r2Key = `issues/${issueId}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  await c.env.FILES.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } })

  const result = await c.env.DB.prepare(
    'INSERT INTO attachments (issue_id, type, filename, r2_key) VALUES (?,?,?,?) RETURNING *'
  ).bind(issueId, type, file.name, r2Key).first()

  await c.env.DB.prepare('INSERT INTO activity_log (issue_id, action, note) VALUES (?,?,?)').bind(issueId, 'File uploaded', file.name).run()
  return c.json(result, 201)
})

app.get('/api/attachments/:id/download', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM attachments WHERE id = ?').bind(c.req.param('id')).first<{ r2_key: string; filename: string }>()
  if (!row) return c.json({ error: 'Not found' }, 404)

  const obj = await c.env.FILES.get(row.r2_key)
  if (!obj) return c.json({ error: 'File not found in storage' }, 404)

  const headers = new Headers()
  headers.set('Content-Disposition', `attachment; filename="${row.filename}"`)
  obj.writeHttpMetadata(headers)
  return new Response(obj.body, { headers })
})

app.delete('/api/attachments/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM attachments WHERE id = ?').bind(c.req.param('id')).first<{ r2_key: string }>()
  if (!row) return c.json({ error: 'Not found' }, 404)
  await Promise.all([
    c.env.FILES.delete(row.r2_key),
    c.env.DB.prepare('DELETE FROM attachments WHERE id = ?').bind(c.req.param('id')).run(),
  ])
  return c.json({ ok: true })
})

// Serve static assets; fall back to index.html for SPA routes
app.all('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (res.status === 404) {
    return c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url).toString()))
  }
  return res
})

export default app
