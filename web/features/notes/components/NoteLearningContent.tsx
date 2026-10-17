'use client'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { upsertNotebookEntry } from '@/lib/notebook-api'
import NoteAudioOptions from './NoteAudioOptions'
import { noteConceptMap } from '../model/concept-map'
import { noteGenerationError } from '../model/generation-error'
import type { Block, QuizAttempt } from '@/lib/book-types'
const Geometry = dynamic(() => import('./NoteGeometry'), { ssr: false })
const Result = dynamic(() => import('./NoteResult'), { ssr: false })
const Timeline = dynamic(
  () => import('@/app/(workspace)/learning/books/components/blocks/TimelineBlock'),
  { ssr: false }
)
const Task = dynamic(() => import('./NoteTaskBlock'), { ssr: false })
const Markdown = dynamic(() => import('@/components/common/MarkdownRenderer'), { ssr: false })
const Quiz = dynamic(() => import('@/app/(workspace)/learning/books/components/blocks/QuizBlock'), {
  ssr: false,
})
const Flashcards = dynamic(
  () => import('@/app/(workspace)/learning/books/components/blocks/FlashCardsBlock'),
  { ssr: false }
)

export default function NoteLearningContent({
  id,
  kind,
  prompt,
  markdown,
  data,
  sourceUrl,
  onChange,
  readOnly = false,
}: {
  id: string
  readOnly?: boolean
  kind: string
  prompt: string
  markdown: string
  data: string
  sourceUrl: string
  onChange: (props: { prompt?: string; data?: string }) => void
}) {
  const { t } = useTranslation()
  const root = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{
    content: string
    pending: boolean
    error?: string
  } | null>(null)
  useEffect(() => {
    const update = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail.blockId === id) setPreview(detail)
    }
    window.addEventListener('note-generation-preview', update)
    return () => window.removeEventListener('note-generation-preview', update)
  }, [id])
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '400px' }
    )
    if (root.current) observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(data)
  } catch {
    /* Keep malformed generated content editable as Markdown. */
  }
  const generation = (payload.generation || {}) as Record<string, unknown>
  const block = {
    id,
    type: kind === 'flashcards' ? 'flash_cards' : 'quiz',
    status: 'ready',
    payload,
  } as Block
  return (
    <div ref={root} className="dt-note-learning" contentEditable={false}>
      {!readOnly && (
        <div className="dt-note-generation-form">
          <span>
            {t(
              (
                {
                  mermaid: 'Diagram',
                  quiz: 'Quiz me',
                  flashcards: 'Flash Cards',
                  timeline: 'Timeline',
                  research: 'Research',
                  task: 'Task',
                  animation: 'Animation',
                  concept_map: 'Concept map',
                  geogebra: 'Geometry',
                  image: 'Generate image',
                  audio: 'Podcast',
                  media: 'Media',
                  visualization: 'Visualization',
                  code: 'Code',
                } as Record<string, string>
              )[kind] || kind
            )}
          </span>
          <textarea
            rows={2}
            disabled={preview?.pending}
            aria-label={t('Generation instructions')}
            placeholder={t('What should this block teach?')}
            value={prompt}
            onChange={e => onChange({ prompt: e.target.value })}
          />
          <button
            className="dt-note-button"
            disabled={preview?.pending}
            onClick={() =>
              root.current?.dispatchEvent(
                new CustomEvent('note-generate', {
                  bubbles: true,
                  detail: {
                    blockId: id,
                    kind,
                    prompt,
                    ...(kind === 'audio'
                      ? {
                          config: {
                            target_minutes: Number(generation.target_minutes) || 1,
                            ...(generation.host_voice ? { host_voice: generation.host_voice } : {}),
                            ...(generation.expert_voice
                              ? { expert_voice: generation.expert_voice }
                              : {}),
                          },
                        }
                      : {}),
                  },
                })
              )
            }
          >
            {t(preview?.pending ? 'Generating…' : 'Generate')}
          </button>
        </div>
      )}
      {!readOnly && kind === 'audio' && (
        <NoteAudioOptions
          value={generation}
          disabled={preview?.pending}
          onChange={generation => onChange({ data: JSON.stringify({ ...payload, generation }) })}
        />
      )}
      {preview?.error && (
        <p role="alert" className="text-sm text-red-600">
          {t(noteGenerationError(preview.error))}
        </p>
      )}
      {preview && (preview.pending || preview.content) && (
        <div className="dt-note-generation-preview" aria-live="polite">
          <div className="dt-note-block-label">
            {t(preview.pending ? 'Generating…' : 'Ready for review')}
          </div>
          {preview.content ? (
            <Markdown content={preview.content} />
          ) : (
            <p>{t('Preparing learning material…')}</p>
          )}
        </div>
      )}
      {!preview?.pending &&
        visible &&
        (kind === 'task' ? (
          <Task data={data} prompt={prompt} onChange={onChange} />
        ) : kind === 'quiz' && Array.isArray(payload.questions) ? (
          <Quiz
            block={block}
            attempts={Array.isArray(payload.attempts) ? (payload.attempts as QuizAttempt[]) : []}
            onAttempt={(_, args) => {
              const questions = payload.questions as Array<Record<string, unknown>>
              const index = questions.findIndex(
                (q, i) => (q.question_id || `${id}:${i + 1}`) === args.questionId
              )
              const question = questions[index]
              if (!question) return
              if (!readOnly) {
                const attempts = (
                  Array.isArray(payload.attempts) ? payload.attempts : []
                ) as QuizAttempt[]
                onChange({
                  data: JSON.stringify({
                    ...payload,
                    attempts: [
                      ...attempts.filter(a => a.question_id !== args.questionId),
                      {
                        block_id: id,
                        page_id: window.location.pathname,
                        question_id: args.questionId,
                        user_answer: args.userAnswer || '',
                        is_correct: args.isCorrect ?? null,
                        timestamp: Date.now() / 1000,
                      },
                    ],
                  }),
                })
              }
              if (readOnly) return
              void upsertNotebookEntry({
                origin_type: 'document_analysis',
                origin_ref: window.location.pathname + '#' + id,
                question_id: args.questionId || `${id}:${index + 1}`,
                question: String(question.question || ''),
                options: question.options as Record<string, string>,
                correct_answer: String(question.correct_answer || ''),
                explanation: String(question.explanation || ''),
                user_answer: args.userAnswer,
                is_correct: args.isCorrect,
                material_title: document.title,
              }).catch(e => setError(String(e)))
            }}
          />
        ) : kind === 'flashcards' && Array.isArray(payload.cards) ? (
          <Flashcards block={block} />
        ) : ['visualization', 'animation', 'media', 'audio', 'image'].includes(kind) &&
          (payload.renderer || payload.artifacts || payload.workspace_items) ? (
          <Result payload={payload} />
        ) : kind === 'research' && payload.outline_preview && Array.isArray(payload.sub_topics) ? (
          <ol className="space-y-3">
            {(payload.sub_topics as Array<{ title: string; overview: string }>).map((topic, i) => (
              <li key={i}>
                <strong>
                  {i + 1}. {topic.title}
                </strong>
                <p className="text-sm text-[var(--muted-foreground)]">{topic.overview}</p>
              </li>
            ))}
          </ol>
        ) : kind === 'geogebra' && Array.isArray(payload.commands) ? (
          <>
            <Geometry data={data} />
            {markdown && <Markdown content={markdown} />}
          </>
        ) : kind === 'timeline' && Array.isArray(payload.events) ? (
          <Timeline block={block} />
        ) : kind === 'concept_map' && (Array.isArray(payload.nodes) || payload.graph) ? (
          <Markdown content={noteConceptMap(payload) || markdown} />
        ) : markdown ? (
          <Markdown content={markdown} />
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            {t('Ask Dito to generate this block.')}
          </p>
        ))}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {sourceUrl && (
        <a href={sourceUrl} className="text-xs text-[var(--primary)]">
          ↗ {t('Source')}
        </a>
      )}
    </div>
  )
}
