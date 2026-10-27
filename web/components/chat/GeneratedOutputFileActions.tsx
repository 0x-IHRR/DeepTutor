'use client'

import { useState } from 'react'
import { Copy, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { apiFetch } from '@/lib/api'

interface GeneratedOutputAttachment {
  generated?: boolean
  relative_path?: string
  url?: string
}

interface FileStorage {
  file_path: string
  file_bytes: number
  fingerprint: string
  can_reveal: boolean
}

export function supportsGeneratedOutputActions(attachment: GeneratedOutputAttachment): boolean {
  const parts = (attachment.relative_path || '').split('/')
  const directChatOutput =
    parts.length === 5 &&
    parts[0] === 'outputs' &&
    parts[1] === 'chat' &&
    parts[3].startsWith('turn_')
  return Boolean(
    attachment.generated &&
    /^\/files\/workspace-items\/ws_[0-9a-f]{32}\/wsi_[0-9a-f]{32}(?:\?[^#]*)?$/.test(
      attachment.url || ''
    ) &&
    (directChatOutput ||
      (parts.length >= 10 &&
        parts[0] === 'outputs' &&
        parts[1] === 'chat' &&
        parts[3].startsWith('turn_') &&
        parts[4] === 'exec' &&
        parts[5] === 'outputs' &&
        parts[6] === 'chat' &&
        parts[8].startsWith('turn_')))
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function GeneratedOutputFileActions({ url }: { url: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [storage, setStorage] = useState<FileStorage | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [removed, setRemoved] = useState(false)
  const [base, query = ''] = url.split('?', 2)

  async function request(action: string, init?: RequestInit) {
    const response = await apiFetch(`${base}/${action}${query ? `?${query}` : ''}`, init)
    const body = await response.json()
    if (!response.ok) throw new Error(body.detail || response.statusText)
    return body
  }

  async function load() {
    setBusy(true)
    setError('')
    try {
      setStorage(await request('file-storage'))
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t('Unable to load file details.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!storage) return
    setBusy(true)
    setError('')
    try {
      await request('remove-generated-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: storage.fingerprint }),
      })
      setRemoved(true)
      setMessage(t('Workspace file removed. The chat attachment is still available.'))
    } catch (cause) {
      setError(cause instanceof Error ? t(cause.message) : t('Unable to remove generated file.'))
    } finally {
      setConfirm(false)
      setBusy(false)
    }
  }

  const buttonClass =
    'rounded-md border border-[var(--border)] px-2 py-1 text-[12px] hover:bg-[var(--background)] disabled:opacity-40'
  return (
    <div className="mt-2 text-[12px]">
      <button
        type="button"
        aria-expanded={open}
        className={`${buttonClass} inline-flex items-center gap-1`}
        onClick={() => {
          setOpen(!open)
          if (!open && !storage) void load()
        }}
      >
        <FolderOpen size={14} />
        {t('Output files')}
      </button>
      {open ? (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--border)] p-3">
          {busy && !storage ? <p role="status">{t('Loading file storage…')}</p> : null}
          {error ? (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          ) : null}
          {message ? <p role="status">{message}</p> : null}
          {storage ? (
            <>
              <label className="block">
                {t('Saved file path')} · {formatBytes(storage.file_bytes)}
                <input
                  aria-label={t('Saved file path')}
                  readOnly
                  value={storage.file_path}
                  className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-[11px]"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${buttonClass} inline-flex items-center gap-1`}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(storage.file_path)
                      setMessage(t('File path copied.'))
                    } catch {
                      setError(t('Copy failed. Select and copy the path above.'))
                    }
                  }}
                >
                  <Copy size={12} />
                  {t('Copy file path')}
                </button>
                {storage.can_reveal && !removed ? (
                  <button
                    type="button"
                    disabled={busy}
                    className={buttonClass}
                    onClick={async () => {
                      setBusy(true)
                      setError('')
                      try {
                        await request('reveal-generated-output', { method: 'POST' })
                      } catch {
                        setError(t('Unable to reveal this file.'))
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    {t('Show in file manager')}
                  </button>
                ) : null}
                {!removed ? (
                  <button
                    type="button"
                    disabled={busy}
                    className={buttonClass}
                    onClick={() => setConfirm(true)}
                  >
                    {t('Remove workspace file')}
                  </button>
                ) : null}
              </div>
              <p className="text-[var(--muted-foreground)]">
                {t('Removing the workspace copy keeps the chat attachment available.')}
              </p>
            </>
          ) : !busy ? (
            <button type="button" className={buttonClass} onClick={() => void load()}>
              {t('Retry')}
            </button>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title={t('Remove generated file?')}
        confirmLabel={t('Remove workspace file')}
        tone="danger"
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void remove()}
      >
        <p>
          {t(
            'Remove the original generated file from the workspace? The chat attachment stays available.'
          )}
        </p>
      </ConfirmDialog>
    </div>
  )
}
