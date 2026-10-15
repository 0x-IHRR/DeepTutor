'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Tooltip from '@/shared/ui/Tooltip'
import { useMenuPopover } from '@/shared/ui/useMenuPopover'
import { useAuthStatus } from '@/hooks/useAuthStatus'
import { useCapabilityFilter } from '@/features/capabilities/useCapabilityCatalog'
import { scopedUrl } from '@/lib/workspace-scope'
import { useWorkspaceChoices } from '@/components/workspaces/useWorkspaceChoices'
import { WorkspaceChoiceList, WorkspaceGlyph } from './WorkspaceMenu'
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
              href={section.scoped ? scopedUrl(entry.href) : entry.href}
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

/** Whose content this is — the workspace — and the way to move to another. */
function ScopeChip() {
  const { t } = useTranslation()
  const { active, currentName } = useWorkspaceChoices()
  const [open, setOpen] = useState(false)
  const rootRef = useMenuPopover<HTMLDivElement>(open, setOpen)
  return (
    <div ref={rootRef} className="relative shrink-0">
      <Tooltip
        label={t('navigation.scopeHint', { workspace: currentName })}
        description={t('navigation.scopeAction')}
        suppressed={open}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
          className="dt-scope-chip"
        >
          <WorkspaceGlyph name={currentName} general={!active} size={16} />
          <span className="max-w-[16ch] truncate">{currentName}</span>
          <ChevronDown size={13} strokeWidth={1.8} className="shrink-0 opacity-60" />
        </button>
      </Tooltip>
      {open && (
        <div role="menu" aria-label={t('Manage workspaces')} className="dt-popover dt-crumb-panel">
          <WorkspaceChoiceList onChoose={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

/**
 * Notion-style location bar over every section index page: the page (opening
 * onto its siblings) and, for workspace content, the workspace it belongs to.
 * Rendered by the route layouts above the page, so pages need no wiring and
 * their own "back to section" links become redundant (modern.css hides them).
 */
export function PageBar() {
  const { t, i18n } = useTranslation()
  const pathname = usePathname() ?? ''
  const { learningPolicy } = useAuthStatus()
  const isAvailable = useCapabilityFilter()
  const located = locatePage(
    pathname,
    pageSections({
      t,
      zh: i18n.language.startsWith('zh'),
      allowedSurfaces: learningPolicy?.allowedSurfaces ?? null,
      isAvailable,
    })
  )
  if (!located) return null
  return (
    <nav aria-label={t('navigation.location')} className="dt-page-bar">
      <PageCrumb section={located.section} page={located.page} />
      {located.section.scoped && <ScopeChip />}
    </nav>
  )
}
