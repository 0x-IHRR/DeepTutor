'use client'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  favoriteAnswer,
  favoriteHeadings,
  favoriteKind,
  favoriteMedia,
  favoriteTranscript,
} from '@/lib/favorite-content'

const Markdown = dynamic(() => import('@/components/common/MarkdownRenderer'), { ssr: false })

/** Read-only source content. Opening a favorite never starts an AI run or changes the archive. */
export default function NotebookFavoriteContent({
  type,
  markdown,
  metadata = {},
}: {
  type: string
  markdown: string
  metadata?: Record<string, unknown>
}) {
  const { t } = useTranslation()
  const root = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLVideoElement>(null)
  const kind = favoriteKind(type, metadata)
  const transcript = ['chat', 'tutorbot'].includes(kind) ? favoriteTranscript(markdown) : []
  const answer = ['question', 'solve'].includes(kind) ? favoriteAnswer(markdown) : null
  const media = favoriteMedia(metadata)
  const chapters =
    kind === 'video_learning'
      ? [...markdown.matchAll(/^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/gm)]
      : []
  const article = ['research', 'reading', 'co_writer', 'guided_learning'].includes(kind)
  const headingLines = article ? favoriteHeadings(markdown) : []
  return (
    <div ref={root} className={`dt-favorite-content dt-favorite-content-${kind}`}>
      {media?.kind === 'video' && (
        <video
          ref={mediaRef}
          controls
          preload="metadata"
          src={media.url}
          className="w-full rounded-lg"
        />
      )}
      {media?.kind === 'audio' && (
        <audio controls preload="metadata" src={media.url} className="w-full" />
      )}
      {media?.kind === 'image' && (
        <Image
          unoptimized
          src={media.url}
          width={960}
          height={640}
          alt={String(metadata.caption || '')}
          className="h-auto max-w-full rounded-lg"
        />
      )}
      {chapters.length > 0 && media?.kind === 'video' && (
        <div className="mb-4 flex flex-wrap gap-2" aria-label={t('Video chapters')}>
          {chapters.map((chapter, index) => (
            <button
              key={index}
              type="button"
              className="rounded border border-[var(--border)] px-2 py-1 text-xs"
              onClick={() => {
                if (mediaRef.current)
                  mediaRef.current.currentTime = chapter[1]
                    .split(':')
                    .reduce((time, part) => time * 60 + Number(part), 0)
              }}
            >
              {chapter[1]} · {chapter[2]}
            </button>
          ))}
        </div>
      )}
      {headingLines.length > 2 && (
        <details className="mb-4 rounded-lg bg-[var(--muted)]/40 px-3 py-2">
          <summary className="cursor-pointer text-xs text-[var(--muted-foreground)]">
            {t('Contents')}
          </summary>
          <nav className="mt-2 grid gap-1" aria-label={t('Contents')}>
            {headingLines.map((line, i) => (
              <button
                key={i}
                className="text-left text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                onClick={() => {
                  root.current
                    ?.querySelectorAll(
                      '[data-favorite-document] h1, [data-favorite-document] h2, [data-favorite-document] h3'
                    )
                    [i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                }}
              >
                {line}
              </button>
            ))}
          </nav>
        </details>
      )}
      <div data-favorite-document>
        {transcript.length ? (
          <div className="grid gap-4">
            {transcript.map((turn, i) => (
              <section key={i} className="rounded-lg border border-[var(--border)] px-4 py-3">
                {turn.role && (
                  <div className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">
                    {t(
                      (
                        {
                          user: 'User',
                          assistant: 'Assistant',
                          system: 'System',
                          用户: 'User',
                          助手: 'Assistant',
                          系统: 'System',
                        } as Record<string, string>
                      )[turn.role.toLowerCase()] || turn.role
                    )}
                  </div>
                )}
                <Markdown content={turn.content} />
              </section>
            ))}
          </div>
        ) : answer ? (
          <>
            <Markdown content={answer.question} />
            <details className="mt-4 rounded-lg border border-[var(--border)] px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">
                {t('Show answer and explanation')}
              </summary>
              <div className="mt-3">
                <Markdown content={answer.answer} />
              </div>
            </details>
          </>
        ) : (
          <Markdown content={markdown} />
        )}
      </div>
    </div>
  )
}
