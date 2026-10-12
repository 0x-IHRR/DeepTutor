'use client'
import Link from 'next/link'
import { Columns3, PenLine, Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStatus } from '@/hooks/useAuthStatus'
import { navVisibleUnderPolicy } from '@/components/sidebar/nav-entries'
export function HomeShortcuts() {
  const { t } = useTranslation()
  const { learningPolicy } = useAuthStatus()
  return (
    <nav
      aria-label={t('navigation.workspace')}
      className="mt-6 flex flex-wrap justify-center gap-2"
    >
      {[
        { href: '/kanban', title: 'Task Board', icon: Columns3 },
        { href: '/co-writer', title: 'Co-Writer', icon: PenLine },
        { href: '/agents', title: 'My Agents', icon: Bot },
      ]
        .filter(item => navVisibleUnderPolicy(item.href, learningPolicy?.allowedSurfaces ?? null))
        .map(item => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <item.icon size={15} strokeWidth={1.6} />
            {t(item.title)}
          </Link>
        ))}
    </nav>
  )
}
