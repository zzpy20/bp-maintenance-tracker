export type ParsedEmail = {
  subject: string
  from: string
  htmlBody: string
  attachments: ParsedAttachment[]
}

export type ParsedAttachment = {
  filename: string
  mimeType: string
  blob: Blob
}

export async function parseEml(file: File): Promise<ParsedEmail> {
  const text = await file.text()
  const result: ParsedEmail = { subject: '', from: '', htmlBody: '', attachments: [] }

  const splitIdx = text.search(/\r?\n\r?\n/)
  const headerStr = splitIdx >= 0 ? text.slice(0, splitIdx) : text
  const bodyStr = splitIdx >= 0 ? text.slice(splitIdx).replace(/^\r?\n/, '') : ''

  const headers = parseHeaders(headerStr)
  result.subject = decodeWords(headers['subject'] ?? '').trim()
  result.from = decodeWords(headers['from'] ?? '').trim()

  const textParts: string[] = []
  processContent(headers, bodyStr, result, textParts)

  if (!result.htmlBody && textParts.length > 0) {
    result.htmlBody = textParts
      .join('\n')
      .split(/\r?\n/)
      .map(l => l ? `<p>${escHtml(l)}</p>` : '<p><br></p>')
      .join('')
  }

  return result
}

function parseHeaders(raw: string): Record<string, string> {
  const unfolded = raw.replace(/\r?\n[ \t]+/g, ' ')
  const headers: Record<string, string> = {}
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) {
      const key = line.slice(0, i).toLowerCase().trim()
      if (!headers[key]) headers[key] = line.slice(i + 1).trim()
    }
  }
  return headers
}

function decodeWords(s: string): string {
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, enc, encoded) => {
    try {
      if (enc.toUpperCase() === 'B') {
        const bytes = Uint8Array.from(atob(encoded.replace(/\s/g, '')), c => c.charCodeAt(0))
        return new TextDecoder(charset).decode(bytes)
      } else {
        return encoded.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_: string, h: string) => String.fromCharCode(parseInt(h, 16)))
      }
    } catch { return encoded }
  })
}

function getBoundary(ct: string): string | null {
  const m = ct.match(/boundary\s*=\s*"?([^";\s]+)"?/i)
  return m ? m[1].replace(/"/g, '') : null
}

function getCharset(ct: string): string {
  const m = ct.match(/charset\s*=\s*"?([^";\s]+)"?/i)
  return m ? m[1] : 'utf-8'
}

function getFilename(disp: string, ct: string): string {
  for (const header of [disp, ct]) {
    const m = header.match(/(?:filename|name)\*?\s*=\s*(?:[^']*'')?([^";\r\n]+)/i)
    if (m) {
      try { return decodeURIComponent(m[1].replace(/"/g, '').trim()) } catch { return m[1].replace(/"/g, '').trim() }
    }
  }
  return ''
}

function decodeTextContent(body: string, enc: string, charset: string): string {
  const e = (enc || '7bit').toLowerCase().replace(/\s/g, '')
  if (e === 'base64') {
    try {
      const bytes = Uint8Array.from(atob(body.replace(/\s/g, '')), c => c.charCodeAt(0))
      return new TextDecoder(charset).decode(bytes)
    } catch { return body }
  }
  if (e === 'quoted-printable') {
    const bytes: number[] = []
    const lines = body.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const soft = line.endsWith('=')
      const src = soft ? line.slice(0, -1) : line
      let j = 0
      while (j < src.length) {
        if (src[j] === '=' && j + 2 < src.length) {
          bytes.push(parseInt(src.slice(j + 1, j + 3), 16))
          j += 3
        } else {
          bytes.push(src.charCodeAt(j))
          j++
        }
      }
      if (!soft && i < lines.length - 1) bytes.push(10)
    }
    try { return new TextDecoder(charset).decode(new Uint8Array(bytes)) } catch { return body }
  }
  return body
}

function decodeBinary(body: string, enc: string): Uint8Array {
  const e = (enc || '7bit').toLowerCase().replace(/\s/g, '')
  if (e === 'base64') {
    try { return Uint8Array.from(atob(body.replace(/\s/g, '')), c => c.charCodeAt(0)) } catch { /**/ }
  }
  return new TextEncoder().encode(body)
}

function splitParts(body: string, boundary: string): string[] {
  const parts: string[] = []
  const lines = body.split(/\r?\n/)
  const delim = '--' + boundary
  const close = '--' + boundary + '--'
  let current: string[] = []
  let inside = false
  for (const line of lines) {
    const t = line.trimEnd()
    if (t === close) { if (inside) parts.push(current.join('\n')); break }
    else if (t === delim) { if (inside) parts.push(current.join('\n')); current = []; inside = true }
    else if (inside) current.push(line)
  }
  if (inside && current.length) parts.push(current.join('\n'))
  return parts
}

function processContent(headers: Record<string, string>, body: string, result: ParsedEmail, textFallback: string[]) {
  const ct = headers['content-type'] ?? 'text/plain'
  const ctLower = ct.toLowerCase()
  const enc = headers['content-transfer-encoding'] ?? '7bit'
  const disp = (headers['content-disposition'] ?? '').toLowerCase()
  const isAttachment = disp.startsWith('attachment')

  if (ctLower.startsWith('multipart/')) {
    const boundary = getBoundary(ct)
    if (!boundary) return
    for (const part of splitParts(body, boundary)) {
      const si = part.search(/\r?\n\r?\n/)
      const ph = si >= 0 ? parseHeaders(part.slice(0, si)) : {}
      const pb = si >= 0 ? part.slice(si).replace(/^\r?\n/, '') : part
      processContent(ph, pb, result, textFallback)
    }
  } else if (ctLower.startsWith('text/html') && !isAttachment) {
    if (!result.htmlBody) {
      result.htmlBody = decodeTextContent(body.trim(), enc, getCharset(ct))
    }
  } else if (ctLower.startsWith('text/plain') && !isAttachment) {
    if (textFallback.length === 0) {
      textFallback.push(decodeTextContent(body.trim(), enc, getCharset(ct)))
    }
  } else if (isAttachment || (!ctLower.startsWith('text/') && !ctLower.startsWith('multipart/'))) {
    const filename = getFilename(headers['content-disposition'] ?? '', ct)
    if (filename) {
      const mimeType = ct.split(';')[0].trim()
      const bytes = decodeBinary(body.trim(), enc)
      result.attachments.push({ filename, mimeType, blob: new Blob([bytes as unknown as BlobPart], { type: mimeType }) })
    }
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
