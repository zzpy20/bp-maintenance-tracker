import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api, type IssueDetail as IssueDetailType, type IssueLink, type Attachment, type Quote, type Invoice, STATUSES, isImageFile, isMediaFile, isVideoFile, isPdfFile } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { UrgencyBadge } from '../components/UrgencyBadge'
import { Lightbox } from '../components/Lightbox'
import { RichTextEditor } from '../components/RichTextEditor'
import { EmailComposer } from '../components/EmailComposer'
import { fmtDate, fmtDateTime, fmtCurrency, isOverdue } from '../lib/utils'

async function fetchBlobUrl(id: number): Promise<string> {
  const token = localStorage.getItem('bp_token')
  const res = await fetch(`/api/attachments/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export function IssueDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [issue, setIssue] = useState<IssueDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [statusEdit, setStatusEdit] = useState(false)
  const [newStatus, setNewStatus] = useState('')
  // Email composer
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  // Links
  const [addingLink, setAddingLink] = useState(false)
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [newLinkUrl, setNewLinkUrl] = useState('')
  // Description inline edit
  const [descEdit, setDescEdit] = useState(false)
  const [newDescription, setNewDescription] = useState('')
  const [descSaveStatus, setDescSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  // Next action inline edit
  const [actionEdit, setActionEdit] = useState(false)
  const [newAction, setNewAction] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  // PDF viewer (used for both attachments and quote/invoice files)
  const [pdfViewer, setPdfViewer] = useState<{ filename: string; url: string } | null>(null)
  const [pdfLoading, setPdfLoading] = useState<number | null>(null)
  // Quote form
  const [addingQuote, setAddingQuote] = useState(false)
  const [newQuoteAmount, setNewQuoteAmount] = useState('')
  const [newQuoteFile, setNewQuoteFile] = useState<File | null>(null)
  const [savingQuote, setSavingQuote] = useState(false)
  // Invoice form
  const [addingInvoice, setAddingInvoice] = useState(false)
  const [newInvoiceAmount, setNewInvoiceAmount] = useState('')
  const [newInvoiceFile, setNewInvoiceFile] = useState<File | null>(null)
  const [savingInvoice, setSavingInvoice] = useState(false)
  // Thumbnail blob URLs
  const [thumbUrls, setThumbUrls] = useState<Record<number, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    api.getIssue(Number(id)).then(data => {
      setIssue(data)
      setNewStatus(data.status)
      setNewDescription(data.description ?? '')
      setNewAction(data.next_action ?? '')
      setNewDueDate(data.next_due_date ?? '')
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [id])

  // Load thumbnails for image attachments
  useEffect(() => {
    if (!issue) return
    for (const att of issue.attachments) {
      if (isImageFile(att.filename) && !thumbUrls[att.id]) {
        fetchBlobUrl(att.id).then(url => setThumbUrls(prev => ({ ...prev, [att.id]: url })))
      }
    }
  }, [issue?.attachments.length])

  useEffect(() => {
    if (!pdfViewer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        URL.revokeObjectURL(pdfViewer.url)
        setPdfViewer(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pdfViewer])

  // Close description modal on Escape (triggers save)
  useEffect(() => {
    if (!descEdit) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleDescSave() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [descEdit, newDescription])

  // Auto-save description 2s after last change
  useEffect(() => {
    if (!descEdit || !issue) return
    if (newDescription === (issue.description ?? '')) return
    setDescSaveStatus('idle')
    const timer = setTimeout(async () => {
      setDescSaveStatus('saving')
      await api.updateIssue(Number(id), { ...issue, description: newDescription })
      setIssue(prev => prev ? { ...prev, description: newDescription } : prev)
      setDescSaveStatus('saved')
      setTimeout(() => setDescSaveStatus('idle'), 2000)
    }, 2000)
    return () => clearTimeout(timer)
  }, [newDescription, descEdit])

  if (loading || !issue) {
    return <div className="p-6 text-gray-400 text-sm">Loading…</div>
  }

  const mediaAttachments = issue.attachments.filter(a => isMediaFile(a.filename))
  const pdfAttachments = issue.attachments.filter(a => isPdfFile(a.filename))
  const otherAttachments = issue.attachments.filter(a => !isMediaFile(a.filename) && !isPdfFile(a.filename))

  const handleAddNote = async () => {
    if (!note.trim()) return
    await api.addNote(Number(id), note.trim())
    setNote('')
    load()
  }

  const handleStatusChange = async () => {
    await api.updateIssue(Number(id), { ...issue, status: newStatus })
    setStatusEdit(false)
    load()
  }

  const handleDescSave = async () => {
    if (newDescription !== (issue.description ?? '')) {
      await api.updateIssue(Number(id), { ...issue, description: newDescription })
      setIssue(prev => prev ? { ...prev, description: newDescription } : prev)
    }
    setDescSaveStatus('idle')
    setDescEdit(false)
  }

  const handleActionSave = async () => {
    await api.updateIssue(Number(id), { ...issue, next_action: newAction, next_due_date: newDueDate })
    setActionEdit(false)
    load()
  }

  const handleAddLink = async () => {
    if (!newLinkUrl.trim()) return
    const url = newLinkUrl.trim().startsWith('http') ? newLinkUrl.trim() : `https://${newLinkUrl.trim()}`
    const links = [...(issue.links ?? []), { label: newLinkLabel.trim() || url, url }]
    await api.updateIssue(Number(id), { ...issue, links } as Parameters<typeof api.updateIssue>[1])
    setIssue(prev => prev ? { ...prev, links } : prev)
    setAddingLink(false)
    setNewLinkLabel('')
    setNewLinkUrl('')
  }

  const handleChase = async (who: 'owner' | 'supplier' | 'tenant') => {
    const label = `Chased ${who}`
    await api.addNote(Number(id), '', label)
    load()
  }

  const handleDeleteLink = async (idx: number) => {
    const links = (issue.links ?? []).filter((_, i) => i !== idx)
    await api.updateIssue(Number(id), { ...issue, links } as Parameters<typeof api.updateIssue>[1])
    setIssue(prev => prev ? { ...prev, links } : prev)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    for (const file of Array.from(files)) {
      await api.uploadAttachment(Number(id), file, 'General')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  const handleDeleteAttachment = async (attachId: number) => {
    if (!confirm('Delete this file?')) return
    await api.deleteAttachment(attachId)
    setThumbUrls(prev => { const n = { ...prev }; delete n[attachId]; return n })
    load()
  }

  const handleDownloadAll = async () => {
    if (!issue.attachments.length) return
    setDownloadingAll(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const token = localStorage.getItem('bp_token')
      await Promise.all(
        issue.attachments.map(async (att) => {
          const res = await fetch(`/api/attachments/${att.id}/download`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
          const blob = await res.blob()
          zip.file(att.filename, blob)
        })
      )
      const content = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(content)
      const a = document.createElement('a')
      a.href = url
      a.download = `issue-${id}-files.zip`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } finally {
      setDownloadingAll(false)
    }
  }

  const handleDownloadOther = async (att: Attachment) => {
    const url = await fetchBlobUrl(att.id)
    const a = document.createElement('a')
    a.href = url
    a.download = att.filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  const handleOpenPdf = async (att: Attachment) => {
    setPdfLoading(att.id)
    const url = await fetchBlobUrl(att.id)
    setPdfLoading(null)
    setPdfViewer({ filename: att.filename, url })
  }

  const handleClosePdf = () => {
    if (pdfViewer) URL.revokeObjectURL(pdfViewer.url)
    setPdfViewer(null)
  }

  const openFileBlob = async (downloadUrl: string, filename: string, loadingKey?: number) => {
    if (loadingKey !== undefined) setPdfLoading(loadingKey)
    const token = localStorage.getItem('bp_token')
    const res = await fetch(downloadUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    if (loadingKey !== undefined) setPdfLoading(null)
    if (isPdfFile(filename)) {
      setPdfViewer({ filename, url })
    } else if (isImageFile(filename)) {
      setPdfViewer({ filename, url })
    } else {
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    }
  }

  const handleAddQuote = async () => {
    setSavingQuote(true)
    await api.addQuote(Number(id), {
      amount: newQuoteAmount || undefined,
      file: newQuoteFile ?? undefined,
      supplier_id: issue?.supplier_id ?? undefined,
    })
    setAddingQuote(false); setNewQuoteAmount(''); setNewQuoteFile(null); setSavingQuote(false)
    load()
  }

  const handleApproveQuote = async (q: Quote) => {
    await api.updateQuote(q.id, { status: 'Approved' })
    load()
  }

  const handleDeleteQuote = async (quoteId: number) => {
    if (!confirm('Delete this quote?')) return
    await api.deleteQuote(quoteId)
    load()
  }

  const handleAddInvoice = async () => {
    setSavingInvoice(true)
    await api.addInvoice(Number(id), {
      amount: newInvoiceAmount || undefined,
      file: newInvoiceFile ?? undefined,
      supplier_id: issue?.supplier_id ?? undefined,
    })
    setAddingInvoice(false); setNewInvoiceAmount(''); setNewInvoiceFile(null); setSavingInvoice(false)
    load()
  }

  const handleMarkSentToOwner = async (invoiceId: number) => {
    await api.updateInvoice(invoiceId, { sent_to_owner_at: new Date().toISOString() })
    load()
  }

  const handleDeleteInvoice = async (invoiceId: number) => {
    if (!confirm('Delete this invoice?')) return
    await api.deleteInvoice(invoiceId)
    load()
  }

  const handleDelete = async () => {
    if (!confirm('Delete this issue? This cannot be undone.')) return
    await api.deleteIssue(Number(id))
    navigate('/issues')
  }

  return (
    <div className="p-6 max-w-4xl">
      {lightboxIndex !== null && (
        <Lightbox
          files={mediaAttachments}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {showEmailComposer && (
        <EmailComposer
          issue={issue}
          onClose={() => setShowEmailComposer(false)}
          onLog={action => api.addNote(Number(id), '', action).then(load)}
        />
      )}

      {/* Description editor modal */}
      {descEdit && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 cursor-pointer"
          onClick={handleDescSave}
        >
          <div
            className="bg-white rounded-xl w-full max-w-4xl h-[85vh] flex flex-col cursor-default shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Description</p>
                <p className="text-sm font-semibold text-gray-800 truncate max-w-lg">{issue.title}</p>
              </div>
              <div className="flex items-center gap-4">
                {descSaveStatus === 'saving' && <span className="text-xs text-gray-400">Saving…</span>}
                {descSaveStatus === 'saved' && <span className="text-xs text-green-600">Saved ✓</span>}
                <button
                  onClick={handleDescSave}
                  className="bg-gray-900 hover:bg-gray-700 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
            {/* Editor fills remaining height */}
            <div className="flex flex-col flex-1 min-h-0 p-4">
              <RichTextEditor content={newDescription} onChange={setNewDescription} grow />
            </div>
          </div>
        </div>
      )}

      {pdfViewer && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={handleClosePdf}
        >
          <div
            className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col cursor-default"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
              <span className="text-sm font-medium text-gray-700 truncate max-w-lg">{pdfViewer.filename}</span>
              <div className="flex items-center gap-4">
                <a
                  href={pdfViewer.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 whitespace-nowrap"
                >
                  Open in new tab ↗
                </a>
                <button onClick={handleClosePdf} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
              </div>
            </div>
            <iframe
              src={pdfViewer.url}
              className="flex-1 w-full rounded-b-xl"
              title={pdfViewer.filename}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <div className="flex gap-2">
          <Link to={`/issues/${id}/edit`} className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg transition-colors">Edit</Link>
          <button onClick={handleDelete} className="text-sm text-red-600 hover:text-red-800 border border-red-200 px-3 py-1.5 rounded-lg">Delete</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-4">

          {/* Title card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-gray-900">{issue.title}</h1>
                {issue.category && <p className="text-xs text-gray-400 mt-0.5">{issue.category}</p>}
              </div>
              <UrgencyBadge urgency={issue.urgency} />
            </div>
            <div className="flex items-center gap-2 mb-4">
              {statusEdit ? (
                <>
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-sm">
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={handleStatusChange} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Save</button>
                  <button onClick={() => setStatusEdit(false)} className="text-xs text-gray-500">Cancel</button>
                </>
              ) : (
                <>
                  <StatusBadge status={issue.status} size="lg" />
                  <button onClick={() => setStatusEdit(true)} className="text-xs text-gray-400 hover:text-gray-600">change</button>
                </>
              )}
            </div>
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Description</span>
                <button onClick={() => setDescEdit(true)} className="text-xs text-gray-400 hover:text-gray-600">edit</button>
              </div>
              {issue.description ? (
                <div
                  className="rich-text text-sm text-gray-700 cursor-text line-clamp-6"
                  onClick={() => setDescEdit(true)}
                  dangerouslySetInnerHTML={{ __html: issue.description }}
                />
              ) : (
                <p className="text-sm text-gray-400 italic cursor-text" onClick={() => setDescEdit(true)}>
                  No description — click to add
                </p>
              )}
            </div>
          </div>

          {/* Outlook email link */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outlook email link</h3>
              {!addingLink && (
                <button onClick={() => setAddingLink(true)} className="text-xs text-blue-600 hover:text-blue-800">+ Add link</button>
              )}
            </div>

            {(issue.links ?? []).length === 0 && !addingLink && (
              <p className="text-sm text-gray-400">No email links saved</p>
            )}

            <div className="space-y-2">
              {(issue.links ?? []).map((link: IssueLink, idx: number) => (
                <div key={idx} className="flex items-center justify-between gap-2 group">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate flex-1"
                    title={link.url}
                  >
                    {link.label}
                  </a>
                  <button
                    onClick={() => handleDeleteLink(idx)}
                    className="text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {addingLink && (
              <div className="mt-2 space-y-2">
                <input
                  value={newLinkUrl}
                  onChange={e => setNewLinkUrl(e.target.value)}
                  placeholder="Paste Outlook email URL here…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleAddLink()}
                />
                <input
                  value={newLinkLabel}
                  onChange={e => setNewLinkLabel(e.target.value)}
                  placeholder="Label (optional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleAddLink()}
                />
                <div className="flex gap-2">
                  <button onClick={handleAddLink} disabled={!newLinkUrl.trim()} className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg">Save</button>
                  <button onClick={() => { setAddingLink(false); setNewLinkLabel(''); setNewLinkUrl('') }} className="text-xs text-gray-500">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Next action */}
          <div className={`rounded-xl border-2 p-4 ${issue.next_action ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-xs font-semibold uppercase tracking-wide ${issue.next_action ? 'text-blue-600' : 'text-gray-500'}`}>Next Action</h3>
              {!actionEdit && (
                <button onClick={() => setActionEdit(true)} className="text-xs text-gray-400 hover:text-gray-600">edit</button>
              )}
            </div>
            {actionEdit ? (
              <div className="space-y-2">
                <input
                  value={newAction}
                  onChange={e => setNewAction(e.target.value)}
                  placeholder="Describe the next action…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Due:</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleActionSave} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">Save</button>
                  <button onClick={() => setActionEdit(false)} className="text-xs text-gray-500">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p className={`font-medium ${issue.next_action ? 'text-blue-900 text-base' : 'text-sm text-gray-400 italic'}`}>
                  {issue.next_action || 'No next action set — click edit to add one'}
                </p>
                {issue.next_due_date && (
                  <p className={`text-xs mt-1 ${isOverdue(issue.next_due_date) ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    Due {fmtDate(issue.next_due_date)}{isOverdue(issue.next_due_date) ? ' · OVERDUE' : ''}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Communication */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Communication</h3>
              <button
                onClick={() => setShowEmailComposer(true)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                ✉ Email templates
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {issue.owner_name && (
                <button onClick={() => handleChase('owner')} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
                  📞 Chased owner
                </button>
              )}
              <button onClick={() => handleChase('supplier')} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
                📞 Chased supplier
              </button>
              {issue.tenant_name && (
                <button onClick={() => handleChase('tenant')} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors">
                  📞 Chased tenant
                </button>
              )}
            </div>
          </div>

          {/* Quotes */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quotes</h3>
              {!addingQuote && (
                <button onClick={() => setAddingQuote(true)} className="text-xs text-blue-600 hover:text-blue-800">+ Add quote</button>
              )}
            </div>

            {issue.quotes.length === 0 && !addingQuote && (
              <p className="text-sm text-gray-400">No quotes yet</p>
            )}

            {issue.quotes.length > 0 && (
              <div className="space-y-2 mb-3">
                {issue.quotes.map((q: Quote) => (
                  <div key={q.id} className="flex items-start justify-between gap-2 text-sm py-2 border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{fmtCurrency(q.amount)}</span>
                        <QuoteStatusBadge status={q.status} />
                        {q.supplier_name && <span className="text-gray-500 text-xs">{q.supplier_name}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-gray-400">{fmtDate(q.received_at)}</span>
                        {q.filename && (
                          <button
                            onClick={() => openFileBlob(`/api/quotes/${q.id}/download`, q.filename!)}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            📄 {q.filename}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {q.status === 'Received' && (
                        <button
                          onClick={() => handleApproveQuote(q)}
                          className="text-xs text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-md transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      <button onClick={() => handleDeleteQuote(q.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {addingQuote && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      value={newQuoteAmount}
                      onChange={e => setNewQuoteAmount(e.target.value)}
                      placeholder="Amount"
                      className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <label className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                    📎 {newQuoteFile ? newQuoteFile.name : 'Attach file'}
                    <input type="file" className="hidden" onChange={e => setNewQuoteFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddQuote}
                    disabled={savingQuote}
                    className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
                  >
                    {savingQuote ? 'Saving…' : 'Save quote'}
                  </button>
                  <button onClick={() => { setAddingQuote(false); setNewQuoteAmount(''); setNewQuoteFile(null) }} className="text-xs text-gray-500">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Invoices */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Invoices</h3>
              {!addingInvoice && (
                <button onClick={() => setAddingInvoice(true)} className="text-xs text-blue-600 hover:text-blue-800">+ Add invoice</button>
              )}
            </div>

            {issue.invoices.length === 0 && !addingInvoice && (
              <p className="text-sm text-gray-400">No invoices yet</p>
            )}

            {issue.invoices.length > 0 && (
              <div className="space-y-2 mb-3">
                {issue.invoices.map((inv: Invoice) => (
                  <div key={inv.id} className="flex items-start justify-between gap-2 text-sm py-2 border-b border-gray-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{fmtCurrency(inv.amount)}</span>
                        {inv.sent_to_owner_at
                          ? <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Sent to owner</span>
                          : <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">Pending</span>
                        }
                        {inv.supplier_name && <span className="text-gray-500 text-xs">{inv.supplier_name}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-gray-400">{fmtDate(inv.received_at)}</span>
                        {inv.sent_to_owner_at && <span className="text-xs text-gray-400">Sent {fmtDate(inv.sent_to_owner_at)}</span>}
                        {inv.filename && (
                          <button
                            onClick={() => openFileBlob(`/api/invoices/${inv.id}/download`, inv.filename!)}
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            📄 {inv.filename}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!inv.sent_to_owner_at && (
                        <button
                          onClick={() => handleMarkSentToOwner(inv.id)}
                          className="text-xs text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors whitespace-nowrap"
                        >
                          Mark sent
                        </button>
                      )}
                      <button onClick={() => handleDeleteInvoice(inv.id)} className="text-gray-300 hover:text-red-500 text-xs">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {addingInvoice && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      value={newInvoiceAmount}
                      onChange={e => setNewInvoiceAmount(e.target.value)}
                      placeholder="Amount"
                      className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <label className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">
                    📎 {newInvoiceFile ? newInvoiceFile.name : 'Attach file'}
                    <input type="file" className="hidden" onChange={e => setNewInvoiceFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddInvoice}
                    disabled={savingInvoice}
                    className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
                  >
                    {savingInvoice ? 'Saving…' : 'Save invoice'}
                  </button>
                  <button onClick={() => { setAddingInvoice(false); setNewInvoiceAmount(''); setNewInvoiceFile(null) }} className="text-xs text-gray-500">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Files */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Files</h3>
              <div className="flex items-center gap-3">
                {issue.attachments.length > 0 && (
                  <button
                    onClick={handleDownloadAll}
                    disabled={downloadingAll}
                    className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                  >
                    {downloadingAll ? 'Zipping…' : '↓ Download all'}
                  </button>
                )}
                <label className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                  {uploading ? 'Uploading…' : '+ Upload'}
                  <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>

            {issue.attachments.length === 0 ? (
              <p className="text-sm text-gray-400">No files attached</p>
            ) : (
              <>
                {/* Media grid (images + videos) */}
                {mediaAttachments.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                    {mediaAttachments.map((att, idx) => (
                      <div key={att.id} className="relative group aspect-square">
                        <button
                          onClick={() => setLightboxIndex(idx)}
                          className="w-full h-full rounded-lg overflow-hidden border border-gray-200 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {isVideoFile(att.filename) ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-white gap-1">
                              <span className="text-2xl">▶</span>
                              <span className="text-xs text-gray-300 truncate px-1 max-w-full">{att.filename.split('.').pop()?.toUpperCase()}</span>
                            </div>
                          ) : thumbUrls[att.id] ? (
                            <img
                              src={thumbUrls[att.id]}
                              alt={att.filename}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">…</div>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-5 h-5 text-xs items-center justify-center hidden group-hover:flex"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* PDF files */}
                {pdfAttachments.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {pdfAttachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-red-500 text-base">📄</span>
                          <button
                            onClick={() => handleOpenPdf(att)}
                            disabled={pdfLoading === att.id}
                            className="text-blue-600 hover:underline truncate max-w-xs text-left disabled:opacity-50"
                          >
                            {pdfLoading === att.id ? 'Loading…' : att.filename}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{fmtDate(att.uploaded_at)}</span>
                          <button onClick={() => handleDeleteAttachment(att.id)} className="hover:text-red-500">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Non-image, non-PDF files */}
                {otherAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    {otherAttachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">📎</span>
                          <button
                            onClick={() => handleDownloadOther(att)}
                            className="text-blue-600 hover:underline truncate max-w-xs text-left"
                          >
                            {att.filename}
                          </button>
                          <span className="text-xs text-gray-400">{att.type}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>{fmtDate(att.uploaded_at)}</span>
                          <button onClick={() => handleDeleteAttachment(att.id)} className="hover:text-red-500">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Add note */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Add Note</h3>
            <div className="flex gap-2">
              <input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Log a note, call, or update…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleAddNote()}
              />
              <button onClick={handleAddNote} className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700">
                Add
              </button>
            </div>
          </div>

          {/* Activity log */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Activity</h3>
            {issue.activity.length === 0 ? (
              <p className="text-sm text-gray-400">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {issue.activity.map(log => {
                  const isNote = log.action === 'Note'
                  const isChase = log.action.startsWith('Chased ')
                  const isEmailCopy = log.action.startsWith('Email template')
                  return (
                    <div
                      key={log.id}
                      className={`flex gap-3 text-sm
                        ${isNote ? 'bg-amber-50 border-l-2 border-amber-400 pl-2 pr-1 py-1 rounded-r' : ''}
                        ${isChase ? 'bg-blue-50 border-l-2 border-blue-400 pl-2 pr-1 py-1 rounded-r' : ''}
                        ${isEmailCopy ? 'bg-gray-50 border-l-2 border-gray-300 pl-2 pr-1 py-1 rounded-r' : ''}
                      `}
                    >
                      <span className="text-gray-400 text-xs mt-0.5 shrink-0 w-32">{fmtDateTime(log.created_at)}</span>
                      {isNote ? (
                        <p className="text-amber-900 font-medium">{log.note}</p>
                      ) : isChase ? (
                        <p className="text-blue-800 font-medium">📞 {log.action}</p>
                      ) : (
                        <div>
                          <span className="font-medium text-gray-700">{log.action}</span>
                          {log.note && <span className="text-gray-500"> — {log.note}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <InfoCard title="Property">
            {issue.property_ref && <InfoRow label="ID" value={issue.property_ref} />}
            <InfoRow label="Address" value={issue.property_address} />
            {(issue.property_suburb || issue.property_postcode) && (
              <InfoRow label="Suburb" value={[issue.property_suburb, issue.property_postcode].filter(Boolean).join(' ')} />
            )}
            {issue.property_state && <InfoRow label="State" value={issue.property_state} />}
            {issue.property_notes && <InfoRow label="Notes" value={issue.property_notes} />}
          </InfoCard>

          <InfoCard title="Owner">
            <InfoRow label="Name" value={issue.owner_name} />
            <InfoRow label="Email" value={issue.owner_email} />
          </InfoCard>

          <InfoCard title="Tenant">
            <InfoRow label="Name" value={issue.tenant_name} />
            <InfoRow label="Phone" value={issue.tenant_phone} />
            <InfoRow label="Email" value={issue.tenant_email} />
          </InfoCard>

          {issue.supplier_name && (
            <InfoCard title="Supplier">
              <InfoRow label="Name" value={issue.supplier_name} />
              <InfoRow label="Phone" value={issue.supplier_phone} />
              <InfoRow label="Email" value={issue.supplier_email} />
            </InfoCard>
          )}

          <InfoCard title="Timeline">
            <InfoRow label="Created" value={fmtDate(issue.created_at)} />
            <InfoRow label="Updated" value={fmtDate(issue.updated_at)} />
            {issue.closed_at && <InfoRow label="Closed" value={fmtDate(issue.closed_at)} />}
          </InfoCard>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="text-sm">
      <span className="text-gray-400">{label}: </span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}

function QuoteStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Approved' ? 'bg-green-50 text-green-700 border-green-200' :
    status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
    'bg-gray-50 text-gray-600 border-gray-200'
  return <span className={`text-xs border px-2 py-0.5 rounded-full ${cls}`}>{status}</span>
}
