'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { apiFetch, apiUrl } from '@/lib/api'
import { scopedUrl } from '@/lib/workspace-scope'
import { subscribeSessionChanges } from '@/lib/session-events'
import type { LearningKind, LearningSources } from '@/lib/learning-dashboard'

const EMPTY: LearningSources = { books: [], mastery: [], reading: [], watching: [], practice: [] }
export function useLearningIndex(enabled = true) {
  const pathname = usePathname()
  const [sources, setSources] = useState<LearningSources>(EMPTY)
  const [failed, setFailed] = useState<LearningKind[]>([])
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const retry = useCallback(() => setRevision(value => value + 1), [])
  useEffect(() => {
    if (!enabled) return
    let alive = true
    let busy = false
    const controller = new AbortController()
    const refresh = async () => {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      try {
        const response = await apiFetch(apiUrl(scopedUrl('/api/dashboard/learning-index', '')), {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        })
        if (!response.ok) throw new Error('Learning index unavailable')
        const payload = (await response.json()) as {
          sources: LearningSources
          failed: LearningKind[]
        }
        if (alive) {
          // Keep readable collections during a transient partial outage.
          setSources(
            previous =>
              Object.fromEntries(
                Object.keys(EMPTY).map(key => {
                  const kind = key as LearningKind
                  const rows = payload.sources[kind] ?? []
                  return [
                    kind,
                    payload.failed.includes(kind) && !rows.length ? previous[kind] : rows,
                  ]
                })
              ) as unknown as LearningSources
          )
          setFailed(payload.failed)
        }
      } catch {
        if (alive) setFailed(Object.keys(EMPTY) as LearningKind[])
      } finally {
        if (alive) setLoading(false)
        busy = false
      }
    }
    void refresh()
    const unsubscribe = subscribeSessionChanges(() => void refresh())
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = window.setInterval(refresh, 30000)
    return () => {
      alive = false
      controller.abort()
      unsubscribe()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [enabled, pathname, revision])
  return { sources, failed, loading, retry }
}
