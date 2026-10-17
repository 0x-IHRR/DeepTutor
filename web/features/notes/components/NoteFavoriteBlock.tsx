'use client'
import { useTranslation } from 'react-i18next'
import {
  Bookmark,
  ChevronRight,
  MessageSquare,
  Search,
  BookOpen,
  Video,
  FileQuestion,
  Calculator,
  FileText,
  Bot,
} from 'lucide-react'
import FavoriteContent from '@/components/notebook/NotebookFavoriteContent'
import { FAVORITE_LABELS, favoriteKind } from '@/lib/favorite-content'

export default function NoteFavoriteBlock({
  title,
  markdown,
  sourceUrl,
  type,
  summary,
  metadata,
  expanded,
  onExpanded,
  onActivate,
}: {
  title: string
  markdown: string
  sourceUrl: string
  type: string
  summary: string
  metadata: string
  expanded: boolean
  onExpanded: (open: boolean) => void
  onActivate?: () => void
}) {
  const { t } = useTranslation()
  let meta: Record<string, unknown> = {}
  try {
    const value = JSON.parse(metadata)
    if (value && typeof value === 'object' && !Array.isArray(value)) meta = value
  } catch {
    /* Legacy clips have no structured metadata. */
  }
  const kind = favoriteKind(type, meta)
  const Icon =
    (
      {
        chat: MessageSquare,
        tutorbot: Bot,
        research: Search,
        reading: BookOpen,
        video_learning: Video,
        question: FileQuestion,
        solve: Calculator,
        co_writer: FileText,
      } as Record<string, typeof Bookmark>
    )[kind] || Bookmark
  return (
    <div
      className="dt-note-favorite"
      contentEditable={false}
      onFocusCapture={onActivate}
      onMouseDownCapture={event => {
        onActivate?.()
        event.stopPropagation()
      }}
      onClick={event => event.stopPropagation()}
    >
      <button
        type="button"
        className="dt-note-favorite-toggle"
        aria-expanded={expanded}
        onClick={() => onExpanded(!expanded)}
      >
        <span className="dt-note-favorite-icon">
          <Icon size={20} strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="dt-note-favorite-kind">
            {t(FAVORITE_LABELS[kind] || 'Favorite content')} · {t('Saved original')}
          </span>
          <strong className="block truncate">{title || t('Favorite content')}</strong>
          {summary && (
            <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--muted-foreground)]">
              {summary}
            </span>
          )}
        </span>
        <ChevronRight size={16} className={expanded ? 'rotate-90' : ''} />
      </button>
      {expanded && (
        <div className="dt-note-favorite-body">
          <FavoriteContent type={type} markdown={markdown} metadata={meta} />
        </div>
      )}
      <div className="dt-note-favorite-footer">
        <button type="button" onClick={() => onExpanded(!expanded)}>
          {t(expanded ? 'Hide original content' : 'Show original content')}
        </button>
        {sourceUrl && (
          <a data-note-source href={sourceUrl}>
            {t('Return to source')}
          </a>
        )}
      </div>
    </div>
  )
}
