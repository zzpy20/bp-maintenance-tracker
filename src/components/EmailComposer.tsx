import { useState, useEffect } from 'react'
import type { IssueDetail } from '../lib/api'
import { EMAIL_TEMPLATES } from '../lib/emailTemplates'

type Props = {
  issue: IssueDetail
  onClose: () => void
  onLog?: (action: string) => void
}

export function EmailComposer({ issue, onClose, onLog }: Props) {
  const [selectedKey, setSelectedKey] = useState(EMAIL_TEMPLATES[0].key)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null)

  useEffect(() => {
    const t = EMAIL_TEMPLATES.find(t => t.key === selectedKey)
    if (t) { setSubject(t.subject(issue)); setBody(t.body(issue)) }
  }, [selectedKey])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copy = async (text: string, field: 'subject' | 'body') => {
    await navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
    if (field === 'body') {
      const t = EMAIL_TEMPLATES.find(t => t.key === selectedKey)
      onLog?.(`Email template copied: ${t?.label ?? selectedKey}`)
    }
  }

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 cursor-pointer" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl flex flex-col shadow-2xl cursor-default" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <p className="text-sm font-semibold text-gray-800">Email Templates</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Template</label>
            <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)} className={inp}>
              {EMAIL_TEMPLATES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Subject</label>
              <button onClick={() => copy(subject, 'subject')} className="text-xs text-blue-600 hover:text-blue-800">
                {copied === 'subject' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <input value={subject} onChange={e => setSubject(e.target.value)} className={inp} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Body</label>
              <button onClick={() => copy(body, 'body')} className="text-xs text-blue-600 hover:text-blue-800">
                {copied === 'body' ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={11}
              className={`${inp} resize-none font-mono text-xs leading-relaxed`}
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
          <p className="text-xs text-gray-400">Edit before copying — changes are not saved</p>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Close</button>
        </div>
      </div>
    </div>
  )
}
