import { useState, useEffect } from 'react'
import postcodeMap from '../lib/au-postcodes.json'

const DB = postcodeMap as Record<string, string[]>

type Props = {
  postcode: string
  suburb: string
  onPostcodeChange: (v: string) => void
  onSuburbChange: (v: string) => void
  inputCls: string
  size?: 'normal' | 'mini'
}

export function PostcodeSuburbInput({ postcode, suburb, onPostcodeChange, onSuburbChange, inputCls, size = 'normal' }: Props) {
  const [suburbs, setSuburbs] = useState<string[]>([])

  useEffect(() => {
    const trimmed = postcode.trim()
    if (trimmed.length === 4 && DB[trimmed]) {
      const list = DB[trimmed]
      setSuburbs(list)
      // Auto-select if only one option, or if current suburb not in new list
      if (list.length === 1) {
        onSuburbChange(list[0])
      } else if (suburb && !list.includes(suburb)) {
        onSuburbChange(list[0])
      }
    } else {
      setSuburbs([])
    }
  }, [postcode])

  const labelCls = size === 'mini'
    ? 'block text-xs text-gray-500 mb-0.5'
    : 'block text-xs font-medium text-gray-500 mb-1.5'

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelCls}>Postcode</label>
        <input
          value={postcode}
          onChange={e => onPostcodeChange(e.target.value)}
          placeholder="4000"
          maxLength={4}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>Suburb</label>
        {suburbs.length > 0 ? (
          <select value={suburb} onChange={e => onSuburbChange(e.target.value)} className={inputCls}>
            {suburbs.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input
            value={suburb}
            onChange={e => onSuburbChange(e.target.value)}
            placeholder={postcode.length === 4 ? 'Not found — type manually' : 'Enter postcode first'}
            className={inputCls}
          />
        )}
      </div>
    </div>
  )
}
