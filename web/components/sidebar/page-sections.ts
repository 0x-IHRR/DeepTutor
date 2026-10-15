import { BookOpen, Bot, Columns3, Home, LayoutGrid, Library, MessageCircle, PenLine, type LucideIcon } from 'lucide-react'
import { DASHBOARD_GROUPS, visibleGroups } from '@/components/space/dashboard-groups'
import { LEARNING_SURFACES } from '@/components/learning/surfaces'
import { navVisibleUnderPolicy } from './nav-entries'

export interface PageEntry {
  href: string
  label: string
  icon: LucideIcon
}

export interface PageSection {
  id: 'home' | 'partners' | 'learning' | 'resources'
  label: string
  icon: LucideIcon
  /** Content here belongs to the URL's workspace, so its scope is shown. */
  scoped: boolean
  pages: PageEntry[]
}

/**
 * The sidebar's four shelves as one page tree — the same entries, policy and
 * capability gates the shelves apply — so the page bar and the sidebar can
 * never disagree about where a page lives or what sits beside it.
 */
export function pageSections({
  t,
  zh,
  allowedSurfaces,
  isAvailable,
}: {
  t: (key: string) => string
  zh: boolean
  allowedSurfaces: readonly string[] | null
  isAvailable: ((name: string) => boolean) | null
}): PageSection[] {
  const surfaceAllowed = (kind: string) =>
    !allowedSurfaces || allowedSurfaces.includes(kind === 'mastery' || kind === 'practice' ? 'chat' : kind)
  return [
    {
      id: 'home',
      label: t('navigation.home'),
      icon: Home,
      scoped: false,
      pages: [
        { href: '/kanban', label: t('Task Board'), icon: Columns3 },
        { href: '/co-writer', label: t('Co-Writer'), icon: PenLine },
        { href: '/agents', label: t('My Agents'), icon: Bot },
      ].filter(page => navVisibleUnderPolicy(page.href, allowedSurfaces)),
    },
    {
      id: 'partners',
      label: t('navigation.partners'),
      icon: MessageCircle,
      scoped: false,
      pages: [{ href: '/partners', label: t('Partners'), icon: MessageCircle }],
    },
    {
      id: 'learning',
      label: t('navigation.learning'),
      icon: BookOpen,
      scoped: true,
      pages: [
        { href: '/learning', label: t('navigation.allLearning'), icon: LayoutGrid },
        ...LEARNING_SURFACES.filter(surface => surfaceAllowed(surface.kind)).map(surface => ({
          href: surface.href,
          label: t(surface.title),
          icon: surface.icon,
        })),
      ],
    },
    {
      id: 'resources',
      label: t('navigation.resources'),
      icon: Library,
      scoped: true,
      pages: [
        { href: '/space', label: t('navigation.allResources'), icon: Library },
        ...visibleGroups(DASHBOARD_GROUPS, isAvailable).flatMap(group =>
          group.items.map(item => ({ href: item.href, label: zh ? item.title.zh : item.title.en, icon: item.icon }))
        ),
      ],
    },
  ]
}

/**
 * The section and page a pathname is the index page of. Only index pages get
 * the bar: detail views (a conversation, a book, a partner) bring their own.
 */
export function locatePage(pathname: string, sections: PageSection[]) {
  for (const section of sections) {
    const page = section.pages.find(entry => entry.href === pathname)
    if (page) return { section, page }
  }
  return null
}
