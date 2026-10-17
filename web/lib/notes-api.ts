import { apiFetch, apiUrl } from '@/lib/api'
import type { CoWriterDocument, CoWriterDocumentSummary } from '@/lib/co-writer-api'

export interface NoteBlock {
  id: string
  type: string
  props: Record<string, unknown>
  content?: unknown
  children?: NoteBlock[]
}
export interface NotePage extends CoWriterDocument {
  blocks: NoteBlock[] | null
  revision: number
  parent_id: string | null
  icon: string
  cover: string
  pinned: boolean
}
export interface NoteSummary extends CoWriterDocumentSummary {
  parent_id: string | null
  icon: string
  pinned: boolean
  revision: number
}
export interface NoteSuggestion {
  id: string
  operation: 'insert' | 'replace' | 'delete' | 'comment'
  block_id: string
  markdown: string
  explanation: string
  original: NoteBlock | null
  anchors?: { id: string; side: 'before' | 'after' }[]
  preserve_children?: boolean
  blocks: NoteBlock[] | null
  status: 'pending' | 'accepted' | 'dismissed'
}
export async function noteRequest<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await apiFetch(
    apiUrl(`/api/documents${path}`),
    body === undefined
      ? { cache: 'no-store' }
      : {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
  )
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.detail || `Request failed (${response.status})`)
  }
  return response.json()
}
export const getNote = (id: string) => noteRequest<NotePage>(`/${id}`)
export const listNotes = () => noteRequest<{ documents: NoteSummary[] }>('')
export const saveNote = (id: string, patch: Partial<NotePage> & { expected_revision: number }) =>
  noteRequest<NotePage>(`/${id}`, patch, 'PUT')
export const createNote = (title = '', parent_id: string | null = null, content = '') =>
  noteRequest<NotePage>('', { title, parent_id, content, ...(content ? {} : { blocks: [] }) })
export const getSuggestions = (id: string) =>
  noteRequest<{ suggestions: NoteSuggestion[] }>(`/${id}/suggestions`)
export const reviewSuggestion = (
  id: string,
  suggestionId: string,
  accept: boolean,
  blocks?: NoteBlock[]
) => noteRequest<NotePage>(`/${id}/suggestions/${suggestionId}`, { accept, blocks })
