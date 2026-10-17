'use client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Pin, Download, PanelRight, FolderTree, X, Bookmark } from 'lucide-react'
import {
  getNote,
  saveNote,
  listNotes,
  createNote,
  getSuggestions,
  reviewSuggestion,
  noteRequest,
  type NoteBlock,
  type NotePage,
  type NoteSummary,
  type NoteSuggestion,
} from '@/lib/notes-api'
import { exportCoWriterDocx } from '@/lib/co-writer-api'
import { notifyCoWriterChanged } from '@/lib/co-writer-events'
import { browserStorage } from '@/shared/storage'
import { useAuthStatus } from '@/hooks/useAuthStatus'
import Tooltip from '@/shared/ui/Tooltip'
import { learningMode, type NoteAIRequest } from '../model/ai-request'
import { researchOutline } from '../model/research'
import type { NoteEditorHandle } from './NoteEditor'
import NotePageTree from './NotePageTree'
import { pageDescendants } from '../model/page-tree'
const Editor = dynamic(() => import('./NoteEditor'), {
  ssr: false,
  loading: () => <p className="p-10 text-sm">…</p>,
})
const Companion = dynamic(() => import('./NoteCompanion'), { ssr: false })
const SourcePicker = dynamic(() => import('./NoteSourcePicker'), { ssr: false })
const FavoritesPicker = dynamic(() => import('./NoteFavoritesPicker'), { ssr: false })

export default function NoteWorkspace({
  docId,
  embedded = false,
}: {
  docId: string
  embedded?: boolean
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const auth = useAuthStatus()
  const owner =
    auth.statusAvailable && !auth.loading ? (auth.enabled ? auth.userId : 'local') : null
  const [mutating, setMutating] = useState(false)
  const [page, setPage] = useState<NotePage | null>(null)
  const [pages, setPages] = useState<NoteSummary[]>([])
  const [error, setError] = useState('')
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState('Saved')
  const [companion, setCompanion] = useState(false)
  const [tree, setTreeOpen] = useState(false)
  const setTree = (open: boolean) => {
    setTreeOpen(open)
    if (owner) browserStorage.writeRaw('local', `deeptutor.notes.tree:${owner}`, String(open))
  }
  const [sources, setSources] = useState(false)
  const [favorites, setFavorites] = useState(false)
  const [suggestions, setSuggestions] = useState<NoteSuggestion[]>([])
  const [request, setRequest] = useState<NoteAIRequest | null>(null)
  const [backlinks, setBacklinks] = useState<NoteSummary[]>([])
  const [recovery, setRecovery] = useState<{ title: string; blocks: NoteBlock[] } | null>(null)
  const editor = useRef<NoteEditorHandle | null>(null)
  const latest = useRef<NotePage | null>(null)
  const version = useRef(0)
  const savedVersion = useRef(0)
  const inflight = useRef<Promise<void> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const draftKey = owner ? `deeptutor.notes.draft:${owner}:${docId}` : null
  const refreshSuggestions = useCallback(() => {
    void getSuggestions(docId)
      .then(r => {
        const pending = r.suggestions.filter(s => s.status === 'pending')
        setSuggestions(previous =>
          JSON.stringify(previous) === JSON.stringify(pending) ? previous : pending
        )
      })
      .catch(e => setError(String(e)))
  }, [docId])
  const refreshPages = useCallback(() => {
    void listNotes()
      .then(r => setPages(r.documents))
      .catch(e => setError(String(e)))
  }, [])
  const persistDraft = useCallback(() => {
    if (draftKey && latest.current)
      browserStorage.writeRaw(
        'local',
        draftKey,
        JSON.stringify({
          title: latest.current.title,
          blocks: latest.current.blocks,
          revision: latest.current.revision,
        })
      )
  }, [draftKey])
  const flush = useCallback(async () => {
    if (inflight.current) await inflight.current
    if (savedVersion.current === version.current || !latest.current) return
    const save = async () => {
      while (savedVersion.current !== version.current && latest.current) {
        const snapshot = latest.current
        const at = version.current
        setStatus('Saving…')
        const result = await saveNote(docId, {
          title: snapshot.title,
          blocks: snapshot.blocks,
          expected_revision: snapshot.revision,
        })
        latest.current = { ...latest.current, revision: result.revision, content: result.content }
        savedVersion.current = at
        if (version.current === at) {
          if (draftKey) browserStorage.removeRaw('local', draftKey)
          setStatus('Saved')
        } else persistDraft()
        setPage(current =>
          current ? { ...current, revision: result.revision, content: result.content } : current
        )
        setPages(current =>
          current.map(p =>
            p.id === docId ? { ...p, title: snapshot.title, revision: result.revision } : p
          )
        )
        notifyCoWriterChanged()
      }
    }
    inflight.current = save()
    try {
      await inflight.current
      setError('')
    } catch (err) {
      persistDraft()
      setStatus('Save failed')
      setError(err instanceof Error ? err.message : String(err))
      throw err
    } finally {
      inflight.current = null
    }
  }, [docId, draftKey, persistDraft])
  const changed = useCallback(
    (patch: Partial<NotePage>) => {
      if (!latest.current) return
      if (patch.blocks && JSON.stringify(patch.blocks) === JSON.stringify(latest.current.blocks))
        return
      latest.current = { ...latest.current, ...patch }
      // Keep the editor's remount snapshot current too. Updating only the ref
      // leaves initialContent stale after a lazy component reload/remount.
      setPage(current => (current ? { ...current, ...patch } : current))
      version.current++
      persistDraft()
      setStatus('Unsaved changes')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void flush().catch(() => {})
      }, 900)
    },
    [flush, persistDraft]
  )
  useEffect(() => {
    if (!draftKey) return
    let cancelled = false
    void getNote(docId)
      .then(doc => {
        if (cancelled) return
        const raw = browserStorage.readRaw('local', draftKey)
        if (raw) {
          try {
            const draft = JSON.parse(raw)
            if (Array.isArray(draft.blocks)) {
              if (draft.revision === doc.revision) {
                doc = { ...doc, title: draft.title, blocks: draft.blocks }
                version.current++
              } else setRecovery(draft)
            }
          } catch {
            /* Ignore invalid recovery data, never overwrite the server page. */
          }
        }
        latest.current = doc
        setPage(doc)
        setTreeOpen(browserStorage.readRaw('local', `deeptutor.notes.tree:${owner}`) === 'true')
        if (browserStorage.readRaw('local', `deeptutor.notes.chat:${owner}:${docId}:generation`))
          setCompanion(true)
        refreshPages()
        refreshSuggestions()
        void noteRequest<{ pages: NoteSummary[] }>(`/${docId}/backlinks`).then(r => {
          if (!cancelled) setBacklinks(r.pages)
        })
      })
      .catch(err => setError(String(err)))
    return () => {
      cancelled = true
      if (timer.current) clearTimeout(timer.current)
    }
  }, [docId, draftKey, owner, refreshPages, refreshSuggestions])
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (version.current !== savedVersion.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])
  useEffect(() => {
    const el = root.current
    const showSources = () => setSources(true)
    const showFavorites = () => setFavorites(true)
    el?.addEventListener('note-sources', showSources)
    el?.addEventListener('note-favorites', showFavorites)
    const saveBeforeSwitch = (e: Event) => {
      ;(e as CustomEvent<Promise<void>[]>).detail.push(flush())
    }
    window.addEventListener('deeptutor:before-workspace-switch', saveBeforeSwitch)
    return () => {
      el?.removeEventListener('note-sources', showSources)
      el?.removeEventListener('note-favorites', showFavorites)
      window.removeEventListener('deeptutor:before-workspace-switch', saveBeforeSwitch)
    }
  }, [flush])
  const ask = useCallback((prompt: string, blockId?: string) => {
    setCompanion(true)
    setRequest({
      id: Date.now(),
      prompt,
      instructions: blockId ? `Target block: ${blockId}` : undefined,
    })
  }, [])
  useEffect(() => {
    const el = root.current
    const generate = (event: Event) => {
      const { kind, prompt, blockId, config } = (event as CustomEvent).detail
      setCompanion(true)
      setRequest({
        id: Date.now(),
        mode: learningMode(kind),
        blockId,
        autoSend: true,
        config,
        prompt: prompt?.trim() || t('Generate this learning block from the page'),
        instructions: `Learning block kind: ${kind}. In your visible reply, describe only the learning material; do not mention block IDs, JSON fields, tool names or implementation details.${learningMode(kind) === 'chat' ? ` Use note_read then note_suggest to replace block ${blockId}. Preserve the rest of the page. Keep its id, kind and prompt. Use the interactive learning schema for flashcards, timeline and concept_map.` : ''}`,
      })
    }
    el?.addEventListener('note-generate', generate)
    return () => el?.removeEventListener('note-generate', generate)
  }, [ask, t, page])
  const applySuggestion = async (suggestion: NoteSuggestion, accept: boolean) => {
    setMutating(true)
    setReviewErrors(previous => ({ ...previous, [suggestion.id]: '' }))
    editor.current?.setEditable(false)
    try {
      await flush()
      const replacement =
        accept && suggestion.operation !== 'comment' && suggestion.operation !== 'delete'
          ? suggestion.blocks || editor.current?.parse(suggestion.markdown)
          : undefined
      const result = await reviewSuggestion(docId, suggestion.id, accept, replacement)
      latest.current = result
      setPage(result)
      if (accept && suggestion.operation !== 'comment' && result.blocks)
        editor.current?.replace(result.blocks)
      refreshSuggestions()
      setError('')
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err)
      setReviewErrors(previous => ({
        ...previous,
        [suggestion.id]: message.includes('The suggested block changed')
          ? t(
              'This block has changed. Your edits are safe. Discuss a new suggestion or dismiss this one.'
            )
          : message,
      }))
    } finally {
      setMutating(false)
      editor.current?.setEditable(true)
    }
  }
  const continueResearch = async (suggestion: NoteSuggestion) => {
    const outline = researchOutline(suggestion)
    if (!outline) return
    try {
      await flush()
      await reviewSuggestion(docId, suggestion.id, false)
      refreshSuggestions()
      root.current?.dispatchEvent(
        new CustomEvent('note-generate', {
          bubbles: true,
          detail: {
            kind: 'research',
            blockId: suggestion.block_id,
            prompt: outline.topic,
            config: { ...outline.research_config, confirmed_outline: outline.sub_topics },
          },
        })
      )
    } catch (err) {
      setError(String(err))
    }
  }
  const metadata = async (patch: Partial<NotePage>) => {
    setMutating(true)
    editor.current?.setEditable(false)
    try {
      await flush()
      const result = await saveNote(docId, {
        ...patch,
        expected_revision: latest.current!.revision,
      })
      latest.current = result
      setPage(result)
      refreshPages()
      notifyCoWriterChanged()
    } catch (err) {
      setError(String(err))
    } finally {
      setMutating(false)
      editor.current?.setEditable(true)
    }
  }
  const exportFile = async (format: 'md' | 'docx') => {
    try {
      await flush()
      const doc = latest.current!
      const blob =
        format === 'docx'
          ? await exportCoWriterDocx({ title: doc.title, content: doc.content })
          : new Blob([doc.content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${doc.title || 'Note'}.${format}`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(String(err))
    }
  }
  const invalidParents = pageDescendants(pages, docId)
  return (
    <div
      ref={root}
      className="relative flex h-full min-h-0 flex-col bg-[var(--secondary)]"
      onClickCapture={event => {
        const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-note-source]')
        if (
          !link ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return
        // Editor link handling otherwise consumes the click as a selection.
        // Flush pending text/title changes before leaving the page.
        event.preventDefault()
        event.stopPropagation()
        const url = new URL(link.href, window.location.href)
        void flush()
          .then(() => {
            if (url.origin === window.location.origin)
              router.push(`${url.pathname}${url.search}${url.hash}`)
            else window.location.assign(url.href)
          })
          .catch(() => {
            /* Save error stays visible; keep the current page. */
          })
      }}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-1 px-3 py-2 text-[var(--muted-foreground)]">
        {!embedded && (
          <Link href="/co-writer" className="dt-note-button" aria-label={t('Learning notebook')}>
            <ChevronLeft size={16} />
            {t('Learning notebook')}
          </Link>
        )}
        <Tooltip label={t('Page tree')} suppressed={tree}>
          <button
            className="dt-note-button"
            aria-label={t('Page tree')}
            aria-expanded={tree}
            aria-controls="note-page-tree"
            onClick={() => setTree(!tree)}
          >
            <FolderTree size={16} />
          </button>
        </Tooltip>
        <span className="ml-auto text-xs">{t(status)}</span>
        <Tooltip label={t('Pin')}>
          <button
            className={`dt-note-button ${page?.pinned ? 'text-[var(--primary)]' : ''}`}
            aria-label={t('Pin')}
            onClick={() => void metadata({ pinned: !page?.pinned })}
          >
            <Pin size={15} />
          </button>
        </Tooltip>
        <Tooltip label={t('Insert favorite')}>
          <button
            className="dt-note-button"
            aria-label={t('Insert favorite')}
            onClick={() => setFavorites(true)}
          >
            <Bookmark size={15} />
          </button>
        </Tooltip>
        <Tooltip label={t('Export Markdown')}>
          <button
            className="dt-note-button"
            aria-label={t('Export Markdown')}
            onClick={() => void exportFile('md')}
          >
            <Download size={15} />
          </button>
        </Tooltip>
        <Tooltip
          label={t(
            'Word export includes text and source links; interactive blocks become static content.'
          )}
        >
          <button className="dt-note-button" onClick={() => void exportFile('docx')}>
            {t('Word')}
          </button>
        </Tooltip>
        <Tooltip label={t('Ask Dito')}>
          <button
            className="dt-note-button"
            aria-label={t('Ask Dito')}
            onClick={() => setCompanion(!companion)}
          >
            <PanelRight size={16} />
          </button>
        </Tooltip>
      </header>
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm text-red-600"
        >
          {error}
          <button className="dt-note-button" onClick={() => void flush().catch(() => {})}>
            {t('Retry')}
          </button>
          <button
            className="dt-note-button"
            onClick={() => {
              if (latest.current?.blocks)
                setRecovery({ title: latest.current.title, blocks: latest.current.blocks })
              void getNote(docId).then(result => {
                latest.current = result
                setPage(result)
                editor.current?.replace(result.blocks || editor.current.parse(result.content))
                savedVersion.current = version.current
                setError('')
              })
            }}
          >
            {t('Reload page')}
          </button>
        </div>
      )}
      {recovery && (
        <div className="px-4 py-2 text-sm">
          {t('A local draft differs from this page.')}
          <button
            className="dt-note-button"
            onClick={async () => {
              const doc = await createNote(`${recovery.title} (${t('Recovered draft')})`)
              await saveNote(doc.id, { blocks: recovery.blocks, expected_revision: doc.revision })
              if (draftKey) browserStorage.removeRaw('local', draftKey)
              setRecovery(null)
              refreshPages()
              router.push(`/co-writer/${doc.id}`)
            }}
          >
            {t('Save draft as a new page')}
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2">
        {tree && (
          <NotePageTree
            pages={pages}
            currentId={docId}
            busy={mutating}
            onClose={() => setTree(false)}
            onNavigate={async (event, id) => {
              if (id === docId || version.current !== savedVersion.current) {
                event.preventDefault()
                if (id === docId) return
                try {
                  await flush()
                  router.push(`/co-writer/${id}`)
                } catch {
                  /* Keep the unsaved page visible. */
                }
              }
            }}
            onCreate={async () => {
              setMutating(true)
              try {
                await flush()
                const doc = await createNote(t('Untitled page'), docId)
                refreshPages()
                router.push(`/co-writer/${doc.id}`)
              } catch (err) {
                setError(String(err))
              } finally {
                setMutating(false)
              }
            }}
          />
        )}
        <main className="min-w-0 flex-1 overflow-y-auto rounded-md bg-[var(--card)]">
          {page && (
            <div className="mx-auto max-w-4xl py-6 sm:py-10">
              {page.cover && (
                <div className="mx-4 mb-4 h-28 rounded-lg" style={{ background: page.cover }} />
              )}
              <div className="px-8 sm:px-12">
                <div className="flex items-center gap-2">
                  <input
                    aria-label={t('Page icon')}
                    className="w-10 bg-transparent text-2xl outline-none"
                    value={page.icon}
                    placeholder="▤"
                    maxLength={10}
                    onChange={e => setPage({ ...page, icon: e.target.value })}
                    onBlur={() => void metadata({ icon: page.icon })}
                  />
                  <select
                    aria-label={t('Move page')}
                    disabled={mutating}
                    className="max-w-48 bg-transparent text-xs text-[var(--muted-foreground)]"
                    value={page.parent_id || ''}
                    onChange={e => void metadata({ parent_id: e.target.value || null })}
                  >
                    <option value="">{t('Top level')}</option>
                    {pages
                      .filter(p => !invalidParents.has(p.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex gap-1 py-2" aria-label={t('Page cover')}>
                  {['', '#e6e4dc', '#dce5dd', '#dce3eb', '#eee0d6', '#e6deeb'].map(color => (
                    <button
                      key={color}
                      className="h-4 w-4 rounded-full border border-[var(--border)]"
                      disabled={mutating}
                      aria-label={color ? t('Set cover color', { color }) : t('Remove cover')}
                      style={{ background: color || 'var(--card)' }}
                      onClick={() => void metadata({ cover: color })}
                    />
                  ))}
                </div>
                <textarea
                  rows={1}
                  disabled={mutating}
                  aria-label={t('Page title')}
                  className="dt-note-page-title mt-3 w-full bg-transparent font-serif text-3xl font-semibold outline-none sm:text-4xl"
                  value={page.title}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      e.currentTarget.blur()
                    }
                  }}
                  onChange={e => {
                    setPage({ ...page, title: e.target.value })
                    changed({ title: e.target.value })
                  }}
                />
                <div className="mt-3 flex flex-wrap gap-1 text-[var(--muted-foreground)]">
                  {['Review my notes', 'Quiz me', 'Check the facts'].map(label => (
                    <button key={label} className="dt-note-button" onClick={() => ask(t(label))}>
                      {t(label)}
                    </button>
                  ))}
                </div>
              </div>
              <Editor
                key={docId}
                page={page}
                suggestions={suggestions}
                reviewBusy={mutating}
                reviewErrors={reviewErrors}
                onContinueResearch={suggestion => void continueResearch(suggestion)}
                onReview={(suggestion, accept) => void applySuggestion(suggestion, accept)}
                onDiscuss={suggestion =>
                  ask(
                    `${t('Discuss this feedback')}: ${suggestion.explanation}`,
                    suggestion.block_id
                  )
                }
                onChange={blocks => changed({ blocks })}
                onReady={handle => {
                  editor.current = handle
                  if (version.current !== savedVersion.current) void flush().catch(() => {})
                }}
                onAI={ask}
              />
              {!!backlinks.length && (
                <div className="mx-12 border-t border-[var(--border)] pt-4 text-sm">
                  <p>{t('Linked from')}</p>
                  {backlinks.map(p => (
                    <Link key={p.id} href={`/co-writer/${p.id}`} className="dt-note-button">
                      ↗ {p.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
        {companion && owner && (
          <div className="w-[360px] min-w-0 shrink-0 max-md:absolute max-md:inset-2 max-md:z-40 max-md:w-auto">
            <Companion
              pageId={docId}
              scope={owner}
              request={request}
              beforeSend={flush}
              onSuggestions={refreshSuggestions}
              onRequestConsumed={id =>
                setRequest(current =>
                  current?.id === id ? { ...current, autoSend: false } : current
                )
              }
              onClose={() => setCompanion(false)}
            />
          </div>
        )}
      </div>
      {sources && (
        <SourcePicker
          onClose={() => setSources(false)}
          onInsert={(title, markdown, url, id) =>
            editor.current?.insertClip(title, markdown, url, id)
          }
          onKnowledge={name => {
            setCompanion(true)
            setRequest({
              id: Date.now(),
              prompt: `${t('Find source passages in this knowledge base and suggest cited notes')}: ${name}`,
              knowledgeRef: name,
            })
          }}
        />
      )}
      {favorites && (
        <FavoritesPicker
          onSynthesize={sources =>
            ask(
              `${t('Organize these favorites into a coherent note. Cite the source of each section.')}\n\n${sources}`
            )
          }
          onClose={() => setFavorites(false)}
          onInsert={clips => {
            editor.current?.insertClips(clips)
            setFavorites(false)
          }}
        />
      )}
    </div>
  )
}
