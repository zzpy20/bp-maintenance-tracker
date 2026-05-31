import { useState, useEffect, useCallback } from 'react'
import type { Attachment } from '../lib/api'
import { isVideoFile } from '../lib/api'

type Props = {
  files: Attachment[]   // image + video attachments
  initialIndex: number
  onClose: () => void
}

async function fetchBlobUrl(id: number): Promise<string> {
  const token = localStorage.getItem('bp_token')
  const res = await fetch(`/api/attachments/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export function Lightbox({ files, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const [blobUrls, setBlobUrls] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)

  const current = files[index]
  const isVideo = current ? isVideoFile(current.filename) : false

  const loadFile = useCallback(async (idx: number) => {
    const file = files[idx]
    if (!file || blobUrls[file.id]) return
    setLoading(true)
    const url = await fetchBlobUrl(file.id)
    setBlobUrls(prev => ({ ...prev, [file.id]: url }))
    setLoading(false)
  }, [files, blobUrls])

  useEffect(() => {
    setLoading(!blobUrls[current?.id])
    loadFile(index)
    if (index + 1 < files.length) loadFile(index + 1)
    if (index - 1 >= 0) loadFile(index - 1)
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, files.length - 1))
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [files.length, onClose])

  useEffect(() => {
    return () => { Object.values(blobUrls).forEach(URL.revokeObjectURL) }
  }, [])

  const src = current ? blobUrls[current.id] : undefined

  const prev = () => setIndex(i => Math.max(i - 1, 0))
  const next = () => setIndex(i => Math.min(i + 1, files.length - 1))

  return (
    // Overlay — clicking anywhere on the dark background closes
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center cursor-pointer"
      onClick={onClose}
    >
      {/* Top bar — stop propagation so clicks here don't close */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 cursor-default"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-white/60 text-sm truncate max-w-sm">{current?.filename}</span>
        <div className="flex items-center gap-4">
          {files.length > 1 && (
            <span className="text-white/50 text-sm">{index + 1} / {files.length}</span>
          )}
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">✕</button>
        </div>
      </div>

      {/* Media — stop propagation so clicking the image/video itself doesn't close */}
      <div className="flex items-center justify-center px-16 cursor-default" onClick={e => e.stopPropagation()}>
        {loading && !src ? (
          <div className="text-white/40 text-sm">Loading…</div>
        ) : src && !isVideo ? (
          <img
            src={src}
            alt={current?.filename}
            className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl"
          />
        ) : src && isVideo ? (
          <video
            src={src}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded shadow-2xl"
          />
        ) : null}
      </div>

      {/* Prev / Next — stop propagation */}
      {files.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); prev() }}
            disabled={index === 0}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white disabled:opacity-20 text-4xl px-2 py-4 cursor-default"
          >
            ‹
          </button>
          <button
            onClick={e => { e.stopPropagation(); next() }}
            disabled={index === files.length - 1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white disabled:opacity-20 text-4xl px-2 py-4 cursor-default"
          >
            ›
          </button>
        </>
      )}

      {/* Download */}
      {src && (
        <div className="absolute bottom-4 cursor-default" onClick={e => e.stopPropagation()}>
          <a
            href={src}
            download={current?.filename}
            className="text-white/50 hover:text-white text-xs border border-white/20 px-3 py-1.5 rounded-full"
          >
            Download
          </a>
        </div>
      )}
    </div>
  )
}
