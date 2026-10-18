'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMenuPopover } from '@/shared/ui/useMenuPopover'
import { useAuthStatus } from '@/hooks/useAuthStatus'
import { useDevice } from '@/hooks/useDevice'
import { useCapabilityFilter } from '@/features/capabilities/useCapabilityCatalog'
import { usePageSlotRef } from '@/components/layout/PageChrome'
import { locatePage, pageSections, type PageSection, type PageEntry } from './page-sections'

/** The page name; it opens onto the pages beside it in the same section. */
function PageCrumb({ section, page }: { section: PageSection; page: PageEntry }) {
  const [open, setOpen] = useState(false)
  const rootRef = useMenuPopover<HTMLDivElement>(open, setOpen)
  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className="dt-crumb"
      >
        <page.icon size={16} strokeWidth={1.6} className="shrink-0 opacity-75" />
        <span className="truncate">{page.label}</span>
      </button>
      {open && (
        <div role="menu" aria-label={section.label} className="dt-popover dt-crumb-panel">
          <div className="dt-menu-label">{section.label}</div>
          {section.pages.map(entry => (
            <Link
              key={entry.href}
              role="menuitem"
              href={entry.href}
              prefetch={false}
              aria-current={entry.href === page.href ? 'page' : undefined}
              onClick={() => setOpen(false)}
              className="dt-menu-item"
            >
              <entry.icon size={16} strokeWidth={1.6} />
              <span className="min-w-0 flex-1 truncate">{entry.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * The top of every section page and the detail views under it: the page's
 * name on the left (opening onto the pages beside it) and the page's own
 * actions on the right, handed up by its header (see `PageBarSlot`).
 * Rendered by the route layouts above the page, so pages need no wiring and
 * their own "back to section" links become redundant (modern.css hides
 * them). Which workspace this is shows only in the sidebar: every page here
 * belongs to the current one.
 */
export function PageBar() {
  const { t, i18n } = useTranslation()
  const pathname = usePathname() ?? ''
  const { learningPolicy } = useAuthStatus()
  const isAvailable = useCapabilityFilter()
  const { isMobile } = useDevice()
  const metaRef = usePageSlotRef('meta')
  const actionsRef = usePageSlotRef('actions')
  const located = locatePage(
    pathname,
    pageSections({
      t,
      zh: i18n.language.startsWith('zh'),
      allowedSurfaces: learningPolicy?.allowedSurfaces ?? null,
      isAvailable,
    })
  )
  // Phones have their own top row; without the bar, headers keep everything.
  if (!located || isMobile) return null
  // On the section page itself the bar is the header; under a detail page
  // it only locates it, and the page keeps its own title and meta.
  const exact = located.page.href === pathname
  return (
    <nav aria-label={t('navigation.location')} className="dt-page-bar" data-exact={exact || undefined}>
      <PageCrumb section={located.section} page={located.page} />
      {exact && <div ref={metaRef} className="dt-page-bar-meta" />}
      <div ref={actionsRef} className="dt-page-bar-actions" />
    </nav>
  )
}
