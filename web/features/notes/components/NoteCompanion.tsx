'use client'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Square, X, Paperclip } from 'lucide-react'
import { UnifiedTurnClient } from '@/features/chat/transport/UnifiedTurnClient'
import type { LLMSelection, StreamEvent } from '@/features/chat/model/protocol'
import { shouldAppendEventContent, isRetractionMarker, recomputeAnswerContent } from '@/lib/stream'
import { useLLMOptions } from '@/hooks/useLLMOptions'
import ModelSelector from '@/components/chat/home/ModelSelector'
import Tooltip from '@/shared/ui/Tooltip'
import { getSession } from '@/lib/session-api'
import { apiFetch, apiUrl } from '@/lib/api'
import { getNote, createNote, saveNote, noteRequest } from '@/lib/notes-api'
import { readFileAsDataUrl, extractBase64FromDataUrl } from '@/lib/file-attachments'
import { listKnowledgeBases } from '@/features/knowledge/api/catalog'
import { knowledgeBaseRef } from '@/lib/knowledge-helpers'
import { resultLearningBlock } from '../model/results'
import { noteGenerationError } from '../model/generation-error'
import { noteGenerationConfig } from '../model/research'
import { visibleNotePrompt, type NoteAIRequest } from '../model/ai-request'
import type { NoteBlock } from '@/lib/notes-api'
import { browserStorage } from '@/shared/storage'
import { activeWorkspaceId } from '@/lib/workspace-scope'
const Markdown = dynamic(() => import('@/components/common/MarkdownRenderer'), { ssr: false })
const Result = dynamic(() => import('./NoteLearningContent'), { ssr: false })
type Message = { role: 'user' | 'assistant'; content: string; block?: NoteBlock }
export default function NoteCompanion({
  pageId,
  scope,
  request,
  beforeSend,
  onSuggestions,
  onClose,
  onRequestConsumed,
}: {
  pageId: string
  scope: string
  request: NoteAIRequest | null
  beforeSend: () => Promise<void>
  onSuggestions: () => void
  onClose: () => void
  onRequestConsumed: (id: number) => void
}) {
  const { t, i18n } = useTranslation()
  const workspaceId = activeWorkspaceId()
  const models = useLLMOptions()
  const [model, setModel] = useState<LLMSelection | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('chat')
  const [knowledge, setKnowledge] = useState<Array<{ name: string; ref: string }>>([])
  const [selectedKbs, setSelectedKbs] = useState<string[]>([])
  const [attachments, setAttachments] = useState<
    Array<{ type: 'image'; filename: string; mime_type: string; base64: string }>
  >([])
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState('')
  const turnEvents = useRef<StreamEvent[]>([])
  const [savedPage, setSavedPage] = useState('')
  const [cost, setCost] = useState('')
  const client = useRef<UnifiedTurnClient | null>(null)
  const session = useRef<string | null>(null)
  const turn = useRef<string | null>(null)
  const busyRef = useRef(false)
  const alive = useRef(true)
  const processed = useRef(0)
  const generationTarget = useRef<string | undefined>(undefined)
  const generationInstructions = useRef('')
  const generationConfig = useRef<Record<string, unknown> | undefined>(undefined)
  const autoSent = useRef(0)
  const activeGeneration = useRef<{
    block: NoteBlock
    pageId: string
    mode: string
    turnId?: string
  } | null>(null)
  const preview = (content: string, pending: boolean, error = '') => {
    const target = activeGeneration.current
    if (target)
      window.dispatchEvent(
        new CustomEvent('note-generation-preview', {
          detail: { blockId: target.block.id, content, pending, error },
        })
      )
  }
  const onSuggestionsRef = useRef(onSuggestions)
  onSuggestionsRef.current = onSuggestions
  const key = `deeptutor.notes.chat:${scope}:${pageId}`
  useEffect(() => {
    void listKnowledgeBases()
      .then(items => setKnowledge(items.map(kb => ({ name: kb.name, ref: knowledgeBaseRef(kb) }))))
      .catch(() => {})
  }, [])
  useEffect(() => {
    alive.current = true
    const handler = (event: StreamEvent) => {
      if (event.turn_id) {
        if (activeGeneration.current && !activeGeneration.current.turnId) {
          activeGeneration.current.turnId = event.turn_id
          browserStorage.writeRaw(
            'local',
            key + ':generation',
            JSON.stringify(activeGeneration.current)
          )
        }
        if (turn.current !== event.turn_id) turnEvents.current = []
        turn.current = event.turn_id
        if (event.seq !== undefined && turnEvents.current.some(e => e.seq === event.seq)) return
        turnEvents.current.push(event)
      }
      if (isRetractionMarker(event))
        setMessages(prev =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.role === 'assistant'
              ? { ...m, content: recomputeAnswerContent(turnEvents.current) }
              : m
          )
        )
      if (event.type === 'session') {
        session.current = event.session_id || String(event.metadata.session_id || '')
        if (session.current) browserStorage.writeRaw('local', key, session.current)
      }
      if (shouldAppendEventContent(event))
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant')
            next[next.length - 1] = { ...last, content: last.content + event.content }
          else next.push({ role: 'assistant', content: event.content })
          return next
        })
      if (shouldAppendEventContent(event)) preview(recomputeAnswerContent(turnEvents.current), true)
      if (event.type === 'wait_for_input') {
        setWaiting(true)
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content:
              event.content ||
              ((event.metadata.questions || []) as { question?: string }[])
                .map(q => q.question || '')
                .join('\n\n'),
          },
        ])
      }
      if (event.type === 'result') {
        const result = event.metadata as Record<string, unknown>
        const response = String(result.response || result.report || event.content || '')
        const block = resultLearningBlock(result, response)
        const target = activeGeneration.current
        if (target && target.mode !== 'chat' && (block || response)) {
          preview('', false)
          activeGeneration.current = null
          void noteRequest(`/${target.pageId}/suggestions`, {
            operation: 'replace',
            block_id: target.block.id,
            source_turn_id: event.turn_id || target.turnId || '',
            expected_original: target.block,
            markdown: response,
            ...(block
              ? {
                  blocks: [
                    {
                      ...block,
                      id: target.block.id,
                      props: {
                        ...block.props,
                        kind: target.block.props.kind || block.props.kind,
                        prompt: target.block.props.prompt || '',
                        data: JSON.stringify({
                          ...JSON.parse(String(block.props.data || '{}')),
                          generation: JSON.parse(String(target.block.props.data || '{}'))
                            .generation,
                        }),
                      },
                    },
                  ],
                }
              : {}),
            explanation: t('Generated for this block. Review before replacing.'),
          })
            .then(() => {
              browserStorage.removeRaw('local', key + ':generation')
              onSuggestionsRef.current()
            })
            .catch(e => setError(String(e)))
        }
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.role === 'assistant')
            next[next.length - 1] = { ...last, content: response || last.content, block }
          else next.push({ role: 'assistant', content: response, block })
          return next
        })
        const nested = result.metadata as Record<string, unknown> | undefined
        const summary = (nested?.cost_summary || result.cost_summary) as
          Record<string, unknown> | undefined
        if (typeof summary?.total_cost_usd === 'number')
          setCost(`$${summary.total_cost_usd.toFixed(4)}`)
      }
      if (event.type === 'tool_result') onSuggestionsRef.current()
      if (event.type === 'error') {
        preview('', false, noteGenerationError(event.content))
        activeGeneration.current = null
        browserStorage.removeRaw('local', key + ':generation')
        setError(t(noteGenerationError(event.content)))
        busyRef.current = false
        setBusy(false)
      }
      if (event.type === 'done') {
        preview('', false)
        if (activeGeneration.current) browserStorage.removeRaw('local', key + ':generation')
        activeGeneration.current = null
        busyRef.current = false
        setBusy(false)
        setWaiting(false)
        onSuggestionsRef.current()
      }
    }
    const connection = new UnifiedTurnClient(handler, () => {
      if (alive.current) {
        busyRef.current = false
        setBusy(false)
      }
    })
    client.current = connection
    connection.connect()
    const saved = browserStorage.readRaw('local', key)
    if (saved)
      void getSession(saved)
        .then(result => {
          if (!alive.current || busyRef.current) return
          session.current = saved
          setMessages(
            (result.messages || [])
              .filter(m => m.role === 'user' || m.role === 'assistant')
              .map(m => ({
                role: m.role as Message['role'],
                content:
                  m.role === 'user'
                    ? visibleNotePrompt(String(m.content || ''))
                    : String(m.content || ''),
                block: resultLearningBlock(
                  ([...(m.events || [])].reverse().find(e => e.type === 'result')?.metadata ||
                    m.metadata ||
                    {}) as Record<string, unknown>,
                  String(m.content || '')
                ),
              }))
          )
          try {
            const savedTarget = browserStorage.readRaw('local', key + ':generation')
            if (savedTarget) activeGeneration.current = JSON.parse(savedTarget)
          } catch {
            /* Invalid recovery data cannot replace the page. */
          }
          if (!result.active_turn_id && activeGeneration.current) {
            const last = [...(result.messages || [])].reverse().find(m => m.role === 'assistant')
            const completed = [...(last?.events || [])].reverse().find(e => e.type === 'result')
            if (
              completed &&
              (!activeGeneration.current.turnId ||
                completed.turn_id === activeGeneration.current.turnId)
            ) {
              handler(completed as StreamEvent)
            } else {
              const failed = [...(last?.events || [])].reverse().find(e => e.type === 'error')
              if (failed) handler(failed as StreamEvent)
              browserStorage.removeRaw('local', key + ':generation')
              activeGeneration.current = null
            }
          }
          if (result.active_turn_id) {
            preview('', true)
            turn.current = result.active_turn_id
            busyRef.current = true
            setBusy(true)
            setMessages(prev => [
              ...prev.filter(m => m.content),
              { role: 'assistant', content: '' },
            ])
            connection.setResumeState(result.active_turn_id, 0)
            connection.send({
              type: 'subscribe_turn',
              turn_id: result.active_turn_id,
              after_seq: 0,
            })
          }
        })
        .catch(() => browserStorage.removeRaw('local', key))
    return () => {
      alive.current = false
      connection.disconnect()
    }
  }, [key, t])
  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || (busyRef.current && !waiting)) return
      setError('')
      if (waiting && turn.current) {
        client.current?.send({
          type: 'submit_user_reply',
          turn_id: turn.current,
          command_id: crypto.randomUUID(),
          text,
        })
        setWaiting(false)
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: text }])
        return
      }
      busyRef.current = true
      setBusy(true)
      try {
        await beforeSend()
        for (
          let attempt = 0;
          !client.current?.connected && attempt < 50 && alive.current;
          attempt++
        )
          await new Promise(resolve => setTimeout(resolve, 100))
        if (!alive.current) return
        if (!client.current?.connected) throw new Error(t('Connection failed. Please try again.'))
        setMessages(prev => [
          ...prev,
          { role: 'user', content: text },
          { role: 'assistant', content: '' },
        ])
        setInput('')
        turnEvents.current = []
        const sourcePage =
          generationTarget.current || mode !== 'chat' ? await getNote(pageId) : null
        const grounding = sourcePage?.content || ''
        if (sourcePage && generationTarget.current) {
          const find = (blocks: NoteBlock[]): NoteBlock | undefined => {
            for (const b of blocks) {
              if (b.id === generationTarget.current) return b
              const nested = find(b.children || [])
              if (nested) return nested
            }
          }
          const target = find(sourcePage.blocks || [])
          if (target) {
            activeGeneration.current = { block: target, pageId, mode }
            browserStorage.writeRaw(
              'local',
              key + ':generation',
              JSON.stringify(activeGeneration.current)
            )
            preview('', true)
          }
        }
        generationTarget.current = undefined
        const instruction = generationInstructions.current
        const config = generationConfig.current
        generationConfig.current = undefined
        generationInstructions.current = ''
        const requestText = `${text}${instruction ? `\n\n<note-generation-context>\n${instruction}\n</note-generation-context>` : ''}`
        const accepted = await client.current.sendAwaitingAck({
          type: 'start_turn',
          content: grounding
            ? `${requestText}\n\n<notebook-source>\n${grounding}\n</notebook-source>`
            : requestText,
          capability: mode,
          config: noteGenerationConfig(mode, config),
          capability_once: mode !== 'chat',
          knowledge_bases: selectedKbs,
          attachments,
          note_document_id: pageId,
          session_id: session.current || undefined,
          workspace_id: workspaceId || null,
          language: i18n.language,
          llm_selection: model,
          client_submission_id: crypto.randomUUID(),
        })
        if (accepted) setAttachments([])
        if (!accepted) throw new Error(t('Could not start the conversation'))
      } catch (err) {
        preview('', false, noteGenerationError(String(err instanceof Error ? err.message : err)))
        activeGeneration.current = null
        browserStorage.removeRaw('local', key + ':generation')
        setError(t(noteGenerationError(String(err instanceof Error ? err.message : err))))
        busyRef.current = false
        setBusy(false)
      }
    },
    [
      attachments,
      beforeSend,
      i18n.language,
      mode,
      model,
      pageId,
      key,
      selectedKbs,
      t,
      waiting,
      workspaceId,
    ]
  )
  useEffect(() => {
    if (request && request.id !== processed.current) {
      processed.current = request.id
      if (busyRef.current) {
        autoSent.current = request.id
        onRequestConsumed(request.id)
        if (request.blockId)
          window.dispatchEvent(
            new CustomEvent('note-generation-preview', {
              detail: {
                blockId: request.blockId,
                content: '',
                pending: false,
                error: t('Finish or stop the current generation first.'),
              },
            })
          )
        return
      }
      generationInstructions.current = request.instructions || ''
      generationConfig.current = request.config
      setInput(request.prompt)
      setMode(request.mode || 'chat')
      generationTarget.current = request.blockId
      if (request.knowledgeRef) setSelectedKbs([request.knowledgeRef])
    }
  }, [request, t, onRequestConsumed])
  useEffect(() => {
    if (
      request?.autoSend &&
      autoSent.current !== request.id &&
      mode === (request.mode || 'chat') &&
      !busyRef.current
    ) {
      autoSent.current = request.id
      onRequestConsumed(request.id)
      void send(request.prompt)
    }
  }, [request, mode, send, onRequestConsumed])
  const upload = async (file: File) => {
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error(t('The file exceeds 25 MB'))
      if (file.type.startsWith('audio/')) {
        const form = new FormData()
        form.append('file', file)
        form.append('language', i18n.language)
        setError('')
        const response = await apiFetch(apiUrl('/api/voice/stt'), { method: 'POST', body: form })
        if (!response.ok) throw new Error(t('Transcription failed'))
        const result = await response.json()
        setInput(
          `${t('Organize this transcript into notes and suggest review questions')}\n\n${result.text}`
        )
      } else if (file.type.startsWith('image/')) {
        setAttachments(prev => prev.slice(0, 3))
        const data = await readFileAsDataUrl(file)
        const base64 = extractBase64FromDataUrl(data)
        setAttachments(prev => [
          ...prev,
          { type: 'image', filename: file.name, mime_type: file.type, base64 },
        ])
        setInput(prev => prev || t('Turn this image into structured notes, including any formulas'))
      }
    } catch (err) {
      setError(String(err))
    }
  }
  const saveAnswer = async (content: string, block?: NoteBlock) => {
    try {
      const doc = await createNote(t('Research notes'), pageId, content)
      setError('')
      if (block) await saveNote(doc.id, { blocks: [block], expected_revision: doc.revision })
      setSavedPage(doc.id)
    } catch (err) {
      setError(String(err))
    }
  }
  return (
    <aside className="flex h-full min-h-0 flex-col bg-[var(--card)]">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium">{t('Dito')}</span>
        <Tooltip label={t('Close')}>
          <button className="dt-note-button" aria-label={t('Close')} onClick={onClose}>
            <X size={16} />
          </button>
        </Tooltip>
      </header>
      <div className="flex-1 overflow-y-auto px-4 text-sm" aria-live="polite">
        {!messages.length && (
          <p className="mt-8 text-[var(--muted-foreground)]">
            {t('Write together, ask for feedback, or turn this page into a lesson.')}
          </p>
        )}
        {messages.map((message, i) => (
          <div
            key={i}
            className={`my-4 ${message.role === 'user' ? 'rounded-lg bg-[var(--secondary)] px-3 py-2' : ''}`}
          >
            <Markdown content={message.content || (busy ? '…' : '')} />
            {message.block && (
              <Result
                id={message.block.id}
                kind={String(message.block.props?.kind || '')}
                prompt=""
                markdown=""
                data={String(message.block.props?.data || '{}')}
                sourceUrl=""
                onChange={() => {}}
                readOnly
              />
            )}
            {message.role === 'assistant' && message.content && !busy && (
              <div className="flex gap-2 text-xs text-[var(--muted-foreground)]">
                <button
                  className="dt-note-button"
                  onClick={() =>
                    void noteRequest(`/${pageId}/suggestions`, {
                      operation: 'insert',
                      markdown: message.content,
                      blocks: message.block ? [message.block] : undefined,
                      explanation: t('Dito'),
                    })
                      .then(onSuggestions)
                      .catch(e => setError(String(e)))
                  }
                >
                  {t('Add to a note')}
                </button>
                <button
                  className="dt-note-button"
                  onClick={() => void saveAnswer(message.content, message.block)}
                >
                  {t('Save as subpage')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {savedPage && (
        <a
          className="px-4 py-2 text-xs text-[var(--primary)] underline"
          href={`/co-writer/${savedPage}`}
        >
          {t('Open saved subpage')}
        </a>
      )}
      {error && (
        <p role="alert" className="px-4 text-sm text-red-600">
          {error}
        </p>
      )}
      {waiting && (
        <p className="px-4 text-xs text-[var(--primary)]">{t('Dito is waiting for your answer')}</p>
      )}
      <div className="flex flex-wrap gap-1 px-3 text-xs">
        <select
          aria-label={t('Generation mode')}
          value={mode}
          onChange={e => setMode(e.target.value)}
          className="bg-transparent p-1"
        >
          {[
            ['chat', 'Write together'],
            ['deep_research', 'Research'],
            ['deep_question', 'Quiz me'],
            ['visualize', 'Diagram'],
            ['math_animator', 'Animation'],
            ['audio_overview', 'Podcast'],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Knowledge base')}
          className="max-w-44 bg-transparent p-1"
          value={selectedKbs[0] || ''}
          onChange={e => setSelectedKbs(e.target.value ? [e.target.value] : [])}
        >
          <option value="">{t('No knowledge base')}</option>
          {knowledge.map(kb => (
            <option key={kb.ref} value={kb.ref}>
              {kb.name}
            </option>
          ))}
        </select>
      </div>
      <form
        className="m-3 rounded-xl border border-[var(--border)] p-2"
        onSubmit={e => {
          e.preventDefault()
          void send(input)
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/*,audio/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void upload(file)
          }}
        />
        <div className="flex gap-2 text-xs">
          {attachments.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setAttachments(prev => prev.filter((_, index) => index !== i))}
            >
              {a.filename} ×
            </button>
          ))}
        </div>
        <textarea
          aria-label={t('Ask Dito')}
          className="w-full resize-none bg-transparent px-1 py-2 text-sm outline-none"
          rows={3}
          value={input}
          placeholder={t('Ask Dito about this page…')}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void send(input)
            }
          }}
        />
        <div className="flex items-center justify-between">
          <Tooltip label={t('Add image or recording')}>
            <button
              type="button"
              className="dt-note-button"
              aria-label={t('Add image or recording')}
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip size={15} />
            </button>
          </Tooltip>
          <ModelSelector
            options={models.options}
            activeDefault={models.activeDefault}
            value={model}
            onChange={setModel}
            loading={models.loading}
            error={models.error}
            allowSystemDefault
          />
          <span className="text-xs text-[var(--muted-foreground)]">{cost}</span>
          {busy && !waiting ? (
            <Tooltip label={t('Stop')}>
              <button
                type="button"
                className="dt-note-button"
                aria-label={t('Stop')}
                onClick={() => {
                  if (turn.current)
                    client.current?.send({
                      type: 'cancel_turn',
                      turn_id: turn.current,
                      command_id: crypto.randomUUID(),
                    })
                }}
              >
                <Square size={15} />
              </button>
            </Tooltip>
          ) : (
            <Tooltip label={t('Send')}>
              <button
                className="dt-note-button"
                type="submit"
                aria-label={t('Send')}
                disabled={!input.trim()}
              >
                <Send size={16} />
              </button>
            </Tooltip>
          )}
        </div>
      </form>
    </aside>
  )
}
