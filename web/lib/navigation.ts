/** Product grouping only. Existing URLs and persisted records remain authoritative. */
import type { SessionSummary } from '@/lib/session-api'
import { sessionRoute } from '@/lib/mastery-session'
export type NavigationCategory = 'home' | 'partners' | 'learning' | 'resources'
export function categoryForPath(pathname: string): NavigationCategory {
  if (pathname === '/partners' || pathname.startsWith('/partners/')) return 'partners'
  if (
    pathname === '/learning' ||
    pathname.startsWith('/learning/') ||
    pathname.startsWith('/courses')
  )
    return 'learning'
  if (
    ['/space', '/notebooks', '/knowledge-bases', '/memory'].some(
      root => pathname === root || pathname.startsWith(`${root}/`)
    )
  )
    return 'resources'
  return 'home'
}
export function isLearningSession(session: SessionSummary): boolean {
  return categoryForPath(sessionRoute(session).split('?')[0]) === 'learning'
}
export function partnerSessionHref(session: {
  kind: 'partner' | 'group'
  owner_id: string
  session_key: string
}): string {
  const root = session.kind === 'group' ? '/partners/groups' : '/partners'
  return `${root}/${encodeURIComponent(session.owner_id)}?${new URLSearchParams({ session: session.session_key })}`
}
