'use client'

import { useState, type MouseEvent } from 'react'
import Link from 'next/link'
import { ChevronRight, FileText, Pin, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { NoteSummary } from '@/lib/notes-api'

export default function NotePageTree({ pages, currentId, busy, onNavigate, onClose, onCreate }: {
  pages: NoteSummary[]
  currentId: string
  busy: boolean
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, id: string) => void
  onClose: () => void
  onCreate: () => void
}) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const rows = (parent: string | null, ancestors = new Set<string>()): React.ReactNode => {
    const children = pages.filter(p => p.parent_id === parent && !ancestors.has(p.id))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned))
    if (!children.length) return null
    return <ul className={parent ? 'dt-note-tree-children' : 'dt-note-tree-roots'}>
      {children.map(page => {
        const title = page.title || t('Untitled page')
        const hasChildren = pages.some(p => p.parent_id === page.id)
        const expanded = !collapsed.has(page.id)
        return <li key={page.id}>
          <div className={`dt-note-tree-row ${page.id === currentId ? 'is-current' : ''}`}>
            {hasChildren ? <button
              className="dt-note-tree-toggle"
              aria-label={t(expanded ? 'Collapse {{page}}' : 'Expand {{page}}', { page: title })}
              aria-expanded={expanded}
              onClick={() => setCollapsed(previous => {
                const next = new Set(previous)
                if (expanded) next.add(page.id)
                else next.delete(page.id)
                return next
              })}
            ><ChevronRight size={14} className={expanded ? 'rotate-90' : ''} /></button>
              : <span className="dt-note-tree-toggle" />}
            <Link href={`/co-writer/${page.id}`} onClick={event => onNavigate(event, page.id)}
              title={title} aria-current={page.id === currentId ? 'page' : undefined}>
              <span className="dt-note-tree-icon" aria-hidden>{page.icon || <FileText size={15} />}</span>
              <span className="truncate">{title}</span>
              {page.pinned && <Pin size={11} className="shrink-0 opacity-60" aria-label={t('Pin')} />}
            </Link>
          </div>
          {expanded && rows(page.id, new Set([...ancestors, page.id]))}
        </li>
      })}
    </ul>
  }
  return <nav id="note-page-tree" className="dt-note-page-tree" aria-label={t('Page tree')}>
    <div className="dt-note-tree-heading"><span>{t('Notebook pages')}</span>
      <button className="dt-note-button" aria-label={t('Close page tree')} onClick={onClose}><X size={14} /></button>
    </div>
    <div className="dt-note-tree-scroll">{rows(null)}</div>
    <button className="dt-note-button dt-note-tree-create" disabled={busy} onClick={onCreate}>
      <Plus size={14} />{t('New subpage')}
    </button>
  </nav>
}
