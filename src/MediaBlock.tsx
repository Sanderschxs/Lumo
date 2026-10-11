import { useEffect, useRef, useState, type DragEvent } from 'react'
import { deleteMedia, formatBytes, getMedia, saveMedia } from './mediaStore'
import './mediaBlock.css'

export type MediaKind = 'image' | 'video' | 'audio' | 'file'

export type MediaValue = {
  mediaId?: string
  mediaName?: string
  mediaType?: string
  mediaSize?: number
  externalUrl?: string
}

type Props = {
  kind: MediaKind
  value: MediaValue
  onChange: (patch: MediaValue) => void
}

const ACCEPT: Record<MediaKind, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  file: '*/*',
}

const LABELS: Record<MediaKind, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio file',
  file: 'file',
}

function safeHttpUrl(value?: string) {
  if (!value) return ''
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

export default function MediaBlock({ kind, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [objectUrl, setObjectUrl] = useState('')
  const [loading, setLoading] = useState(Boolean(value.mediaId))
  const [dragging, setDragging] = useState(false)
  const [linkMode, setLinkMode] = useState(Boolean(value.externalUrl) && !value.mediaId)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    let nextUrl = ''

    async function load() {
      if (!value.mediaId) {
        setObjectUrl('')
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const record = await getMedia(value.mediaId)
        if (!alive) return
        if (!record) {
          setError('The local file could not be found. You can upload it again.')
          setObjectUrl('')
          return
        }
        nextUrl = URL.createObjectURL(record.blob)
        setObjectUrl(nextUrl)
      } catch {
        if (alive) setError('Could not open this local file.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    void load()
    return () => {
      alive = false
      if (nextUrl) URL.revokeObjectURL(nextUrl)
    }
  }, [value.mediaId])

  async function chooseFile(file?: File) {
    if (!file) return
    setError('')
    try {
      const oldId = value.mediaId
      const record = await saveMedia(file)
      onChange({
        mediaId: record.id,
        mediaName: record.name,
        mediaType: record.type,
        mediaSize: record.size,
        externalUrl: '',
      })
      setLinkMode(false)
      if (oldId && oldId !== record.id) void deleteMedia(oldId).catch(() => undefined)
    } catch {
      setError('Upload failed. Your browser may have blocked local storage for this file.')
    }
  }

  async function removeMedia() {
    const id = value.mediaId
    onChange({ mediaId: undefined, mediaName: undefined, mediaType: undefined, mediaSize: undefined, externalUrl: '' })
    if (id) void deleteMedia(id).catch(() => undefined)
    setLinkMode(false)
    setError('')
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void chooseFile(file)
  }

  const externalUrl = safeHttpUrl(value.externalUrl)
  const source = objectUrl || externalUrl
  const hasMedia = Boolean(source)

  return (
    <div className="media-block-shell">
      <input
        ref={inputRef}
        className="media-file-input"
        type="file"
        accept={ACCEPT[kind]}
        onChange={(event) => {
          void chooseFile(event.target.files?.[0])
          event.currentTarget.value = ''
        }}
      />

      {!hasMedia && !loading && (
        <div
          className={`media-upload-card ${dragging ? 'media-upload-card--dragging' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
          onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="media-upload-icon">{kind === 'image' ? '▧' : kind === 'video' ? '▶' : kind === 'audio' ? '♫' : '↥'}</div>
          <div className="media-upload-copy">
            <strong>Upload {LABELS[kind]}</strong>
            <span>Choose a file or drag it here. It stays stored locally in this browser.</span>
          </div>
          <div className="media-upload-actions">
            <button type="button" className="media-primary" onClick={() => inputRef.current?.click()}>Choose file</button>
            <button type="button" onClick={() => setLinkMode((open) => !open)}>Embed link</button>
          </div>
          {linkMode && (
            <input
              className="media-link-input"
              value={value.externalUrl || ''}
              onChange={(event) => onChange({ externalUrl: event.target.value, mediaId: undefined, mediaName: undefined, mediaType: undefined, mediaSize: undefined })}
              placeholder="https://…"
              autoFocus
            />
          )}
        </div>
      )}

      {loading && <div className="media-loading">Loading local file…</div>}

      {hasMedia && (
        <div className="media-preview-card">
          {kind === 'image' && <img className="media-preview-image" src={source} alt={value.mediaName || 'Uploaded image'} />}
          {kind === 'video' && <video className="media-preview-video" src={source} controls />}
          {kind === 'audio' && <audio className="media-preview-audio" src={source} controls />}
          {kind === 'file' && (
            <a className="media-file-card" href={source} download={value.mediaName || undefined} target={externalUrl ? '_blank' : undefined} rel={externalUrl ? 'noreferrer' : undefined}>
              <span className="media-file-icon">▤</span>
              <span><strong>{value.mediaName || externalUrl || 'File'}</strong><small>{value.mediaSize ? formatBytes(value.mediaSize) : value.mediaType || 'External file'}</small></span>
              <b>{externalUrl ? 'Open ↗' : 'Download'}</b>
            </a>
          )}

          <div className="media-preview-toolbar">
            <div>
              <strong>{value.mediaName || (externalUrl ? 'Embedded link' : LABELS[kind])}</strong>
              {value.mediaSize ? <span>{formatBytes(value.mediaSize)}</span> : externalUrl ? <span>External URL</span> : null}
            </div>
            <button type="button" onClick={() => inputRef.current?.click()}>Replace</button>
            <button type="button" onClick={() => setLinkMode((open) => !open)}>Link</button>
            <button type="button" className="media-remove" onClick={() => void removeMedia()}>Remove</button>
          </div>
          {linkMode && (
            <input
              className="media-link-input media-link-input--preview"
              value={value.externalUrl || ''}
              onChange={(event) => onChange({ externalUrl: event.target.value })}
              placeholder="https://…"
            />
          )}
        </div>
      )}

      {error && <div className="media-error">{error}</div>}
    </div>
  )
}
