'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getNotebook,
  listNotebooks,
  type NotebookRecordItem,
  type NotebookSummary,
} from '@/lib/notebook-api'
import { favoriteSnapshot } from '@/lib/favorite-content'
import type { NoteClipInput } from '../model/clip-editing'
import { favoriteRecordRoute } from '@/lib/resource-routes'
import PickerShell from '@/components/common/PickerShell'
export default function NoteFavoritesPicker({
  onClose,
  onInsert,
  onSynthesize,
}: {
  onClose: () => void
  onSynthesize: (sources: string) => void
  onInsert: (clips: NoteClipInput[]) => void
}) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState<NotebookSummary[]>([])
  const [records, setRecords] = useState<NotebookRecordItem[]>([])
  const [group, setGroup] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  useEffect(() => {
    let cancelled = false
    void listNotebooks()
      .then(items => {
        if (!cancelled) setGroups(items.filter(item => !item.unreadable))
      })
      .catch(() => {
        if (!cancelled) setError(t('Could not load favorites.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])
  useEffect(() => {
    if (!group) return
    let cancelled = false
    void getNotebook(group)
      .then(n => {
        if (!cancelled) setRecords(n.records)
      })
      .catch(() => {
        if (!cancelled) setError(t('Could not load favorites.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [group, t])
  const visibleRecords = records.filter(r =>
    `${r.title} ${r.summary || ''} ${r.output}`.toLowerCase().includes(query.trim().toLowerCase())
  )
  return (
    <PickerShell open onClose={onClose} ariaLabel={t('Insert favorite')}>
      <div className="w-[min(520px,90vw)] rounded-xl bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-medium">{t('Insert favorite')}</h2>
        <select
          className="w-full rounded-lg border border-[var(--border)] bg-transparent p-2"
          aria-label={t('Favorites')}
          value={group}
          onChange={e => {
            setLoading(Boolean(e.target.value))
            setQuery('')
            setError('')
            setRecords([])
            setSelected(new Set())
            setGroup(e.target.value)
          }}
        >
          <option value="">{t('Choose a collection')}</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        {group && (
          <input
            className="mt-3 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('Search favorites')}
            aria-label={t('Search favorites')}
          />
        )}
        <div className="mt-2 max-h-80 overflow-y-auto" aria-busy={loading}>
          {loading ? (
            <p role="status" className="p-3 text-sm text-[var(--muted-foreground)]">
              {t('Loading...')}
            </p>
          ) : !visibleRecords.length && !error ? (
            <p className="p-3 text-sm text-[var(--muted-foreground)]">
              {t(
                !group
                  ? groups.length
                    ? 'Choose a collection to browse its favorites.'
                    : 'No notebooks yet.'
                  : records.length
                    ? 'No records match your search'
                    : 'No favorites in this collection yet.'
              )}
            </p>
          ) : null}
          {visibleRecords.map(r => (
            <label
              key={r.id}
              className="flex cursor-pointer gap-3 rounded-lg px-2 py-3 text-sm hover:bg-[var(--muted)]"
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={e =>
                  setSelected(prev => {
                    const next = new Set(prev)
                    if (e.target.checked) next.add(r.id)
                    else next.delete(r.id)
                    return next
                  })
                }
              />
              <span>
                {r.title}
                <span className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">
                  {r.summary}
                </span>
              </span>
            </label>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button className="dt-note-button" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button
            className="dt-note-button"
            disabled={loading || !selected.size}
            onClick={() => {
              onSynthesize(
                records
                  .filter(r => selected.has(r.id))
                  .map(
                    r =>
                      `## ${r.title}\n\n${r.output}\n\n[${r.title}](${favoriteRecordRoute(group, r.id)})`
                  )
                  .join('\n\n')
              )
              onClose()
            }}
          >
            {t('Organize into a note')}
          </button>
          <button
            className="dt-note-button"
            disabled={loading || !selected.size}
            onClick={() => {
              onInsert(
                records
                  .filter(r => selected.has(r.id))
                  .map(r => ({
                    title: r.title,
                    markdown: r.output,
                    sourceUrl: favoriteRecordRoute(group, r.id),
                    sourceId: r.id,
                    favorite: favoriteSnapshot(r),
                  }))
              )
              onClose()
            }}
          >
            {t('Insert')}
          </button>
        </div>
      </div>
    </PickerShell>
  )
}
