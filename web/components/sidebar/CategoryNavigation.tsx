'use client'

import { useId, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { m, useReducedMotion } from 'framer-motion'
import {
  BookOpen,
  Home,
  Library,
  MessageCircle,
  Search,
  Settings,
  Columns3,
  PenLine,
  Bot,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Tooltip from '@/shared/ui/Tooltip'
import { categoryForPath, type NavigationCategory } from '@/lib/navigation'
import { navVisibleUnderPolicy } from './nav-entries'
import { useAuthStatus } from '@/hooks/useAuthStatus'
import { navigateTask } from '@/lib/workspace-scope'
import { NavigationRow, Section, matches } from './NavigationPrimitives'

// Feature libraries load when their category opens, not in every workspace.
const LearningNavigation = dynamic(() =>
  import('./LearningNavigation').then(module => module.LearningNavigation)
)
const PartnerNavigation = dynamic(() =>
  import('./PartnerNavigation').then(module => module.PartnerNavigation)
)
const ResourcesNavigation = dynamic(() =>
  import('./ResourcesNavigation').then(module => module.ResourcesNavigation)
)

export const CATEGORIES = [
  { id: 'home', label: 'navigation.home', icon: Home, href: '/chat' },
  { id: 'partners', label: 'navigation.partners', icon: MessageCircle, href: '/partners' },
  { id: 'learning', label: 'navigation.learning', icon: BookOpen, href: '/learning' },
  { id: 'resources', label: 'navigation.resources', icon: Library, href: '/space' },
] as const

export function useCategoryNavigation() {
  const pathname = usePathname()
  const { learningPolicy } = useAuthStatus()
  const categories = CATEGORIES.filter(item =>
    navVisibleUnderPolicy(item.href, learningPolicy?.allowedSurfaces ?? null)
  )
  const [selection, setSelection] = useState<{
    pathname: string
    category: NavigationCategory
  } | null>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const desired = selection?.pathname === pathname ? selection.category : categoryForPath(pathname)
  const category = categories.find(item => item.id === desired)?.id ?? categories[0]?.id ?? 'home'
  return {
    category,
    categories,
    query,
    setQuery,
    searchOpen,
    setSearchOpen,
    select: (next: NavigationCategory) => {
      setSelection({ pathname, category: next })
      setQuery('')
    },
    allowedSurfaces: learningPolicy?.allowedSurfaces ?? null,
  }
}
type Navigation = ReturnType<typeof useCategoryNavigation>

export function CategoryTabs({ nav, collapsed }: { nav: Navigation; collapsed: boolean }) {
  const { t } = useTranslation()
  const router = useRouter()
  const id = useId()
  const reduced = useReducedMotion()
  const select = (category: (typeof CATEGORIES)[number]) => {
    nav.select(category.id)
    if (collapsed) navigateTask(category.href, router.push)
  }
  return (
    <div className={`dt-category-bar ${collapsed ? 'is-collapsed' : ''}`}>
      <div
        role="tablist"
        aria-label={t('navigation.categories')}
        aria-orientation={collapsed ? 'vertical' : 'horizontal'}
      >
        {nav.categories.map((item, index) => (
          <Tooltip key={item.id} label={t(item.label)} side={collapsed ? 'right' : 'bottom'}>
            <button
              id={`category-${item.id}`}
              type="button"
              role="tab"
              aria-controls="category-content"
              aria-label={t(item.label)}
              aria-selected={nav.category === item.id}
              tabIndex={nav.category === item.id ? 0 : -1}
              onKeyDown={event => {
                const delta = ['ArrowRight', 'ArrowDown'].includes(event.key)
                  ? 1
                  : ['ArrowLeft', 'ArrowUp'].includes(event.key)
                    ? -1
                    : 0
                if (!delta && !['Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? nav.categories.length - 1
                      : (index + delta + nav.categories.length) % nav.categories.length
                select(nav.categories[next])
                event.currentTarget
                  .closest('[role="tablist"]')
                  ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                  [next]?.focus()
              }}
              onClick={() => select(item)}
              className={nav.category === item.id ? 'is-active' : ''}
            >
              {nav.category === item.id && (
                <m.span
                  layoutId={`category-pill-${id}`}
                  className="dt-category-pill"
                  transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <item.icon size={20} strokeWidth={1.65} />
              <span>{t(item.label)}</span>
            </button>
          </Tooltip>
        ))}
      </div>
      <Tooltip label={t('navigation.search')} side={collapsed ? 'right' : 'bottom'}>
        <button
          type="button"
          className="dt-nav-icon"
          aria-label={t('navigation.search')}
          aria-expanded={nav.searchOpen}
          onClick={() => {
            if (collapsed) navigateTask('/space/chat-history', router.push)
            else nav.setSearchOpen(!nav.searchOpen)
          }}
        >
          <Search size={19} strokeWidth={1.65} />
        </button>
      </Tooltip>
      {!collapsed && nav.searchOpen && (
        <input
          autoFocus
          aria-label={t('navigation.search')}
          placeholder={t('navigation.search')}
          value={nav.query}
          onChange={event => nav.setQuery(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              nav.setQuery('')
              nav.setSearchOpen(false)
            }
          }}
          className="dt-nav-search"
        />
      )}
    </div>
  )
}

export function CategoryBody({
  nav,
  collapsed,
  sessions,
}: {
  nav: Navigation
  collapsed: boolean
  sessions: ReactNode
}) {
  const { t } = useTranslation()
  if (collapsed) return null
  return (
    <div
      id="category-content"
      role="tabpanel"
      aria-labelledby={`category-${nav.category}`}
      className="dt-category-content"
      key={nav.category}
    >
      {nav.category === 'home' && (
        <>
          <Section title={t('navigation.workspace')}>
            {[
              { href: '/chat', label: 'Dito', icon: MessageCircle },
              { href: '/kanban', label: 'Task Board', icon: Columns3 },
              { href: '/co-writer', label: 'Co-Writer', icon: PenLine },
              { href: '/agents', label: 'My Agents', icon: Bot },
            ]
              .filter(
                item =>
                  navVisibleUnderPolicy(item.href, nav.allowedSurfaces) &&
                  matches(t(item.label), nav.query)
              )
              .map(item => (
                <NavigationRow
                  key={item.href}
                  href={item.href}
                  label={t(item.label)}
                  icon={item.icon}
                />
              ))}
          </Section>
          {sessions}
        </>
      )}
      {nav.category === 'learning' && <LearningNavigation query={nav.query} sessions={sessions} />}
      {nav.category === 'partners' && <PartnerNavigation query={nav.query} />}
      {nav.category === 'resources' && <ResourcesNavigation query={nav.query} />}
      {nav.searchOpen && matches(t('Settings'), nav.query) && (
        <Section title={t('Settings')}>
          <NavigationRow href="/settings" label={t('Settings')} icon={Settings} />
        </Section>
      )}
    </div>
  )
}
