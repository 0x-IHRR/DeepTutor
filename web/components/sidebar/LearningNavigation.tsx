'use client'
import { useTranslation } from 'react-i18next'
import { NavigationRow, Status, matches } from './NavigationPrimitives'
import { useLayoutEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutGrid, ChevronDown, Search } from 'lucide-react'
import { LearningCreateMenu } from '@/components/learning/LearningCreateMenu'
import { learningSurface } from '@/components/learning/surfaces'
import { allLearningActivity } from '@/lib/learning-dashboard'
import { useLearningIndex } from '@/hooks/useLearningIndex'
import { formatRelativeTime, getDayGroupKey, type DayGroupKey } from '@/lib/relative-time'
import { browserStorage } from '@/shared/storage'
import { useSidebarDrawer } from '@/components/layout/AppShell'

const SORT_KEY = 'deeptutor.navigation.learning.sort'
const GROUP_LABELS: Record<DayGroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_7_days: 'Last 7 days',
  earlier: 'Earlier',
}
export function LearningNavigation({
  query,
  sessions,
  active = true,
}: {
  query: string
  sessions: ReactNode
  active?: boolean
}) {
  const { t, i18n } = useTranslation()
  const pathname = usePathname()
  const drawer = useSidebarDrawer()
  const { sources, loading, failed, retry } = useLearningIndex(active)
  const [limit, setLimit] = useState(30)
  const [sort, setSort] = useState<'updatedAt' | 'createdAt'>('updatedAt')
  const [searchOpen, setSearchOpen] = useState(false)
  const [localQuery, setLocalQuery] = useState('')
  useLayoutEffect(() => {
    if (browserStorage.readRaw('local', SORT_KEY) === 'createdAt') {
      // Restore the view preference before paint, without changing any record.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSort('createdAt')
    }
  }, [])
  const rows = allLearningActivity(sources)
    .filter(row => {
      const label = `${row.title} ${row.workspaceName ?? ''} ${t(learningSurface(row.kind).title)}`
      return matches(label, query) && matches(label, localQuery)
    })
    .sort((a, b) => b[sort] - a[sort] || a.key.localeCompare(b.key))
  const grouped = Map.groupBy(rows.slice(0, limit), row => getDayGroupKey(row[sort]))
  return (
    <div className="dt-learning-navigation">
      <div className={`dt-learning-overview ${pathname === '/learning' ? 'is-active' : ''}`}>
        <Link
          href="/learning"
          prefetch={false}
          aria-current={pathname === '/learning' ? 'page' : undefined}
          onClick={event => {
            if (!event.metaKey && !event.ctrlKey && !event.shiftKey) drawer?.close()
          }}
        >
          <LayoutGrid size={18} strokeWidth={1.6} />
          <span>{t('navigation.allLearning')}</span>
        </Link>
        <LearningCreateMenu compact />
      </div>
      <div className="dt-learning-record-toolbar">
        <select
          aria-label={t('navigation.sortLearning')}
          value={sort}
          onChange={event => {
            const value = event.target.value as 'updatedAt' | 'createdAt'
            setSort(value)
            setLimit(30)
            browserStorage.writeRaw('local', SORT_KEY, value)
          }}
        >
          <option value="updatedAt">{t('navigation.lastActive')}</option>
          <option value="createdAt">{t('navigation.createdTime')}</option>
        </select>
        <button
          type="button"
          className="dt-nav-icon"
          aria-label={t('navigation.searchLearning')}
          aria-expanded={searchOpen}
          onClick={() => {
            setSearchOpen(!searchOpen)
            if (searchOpen) setLocalQuery('')
          }}
        >
          <Search size={16} strokeWidth={1.6} />
        </button>
      </div>
      {searchOpen && (
        <input
          autoFocus
          className="dt-nav-search dt-learning-search"
          aria-label={t('navigation.searchLearning')}
          placeholder={t('navigation.searchLearning')}
          value={localQuery}
          onChange={event => {
            setLocalQuery(event.target.value)
            setLimit(30)
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setLocalQuery('')
              setSearchOpen(false)
            }
          }}
        />
      )}
      <div
        className="dt-learning-record-list"
        role="region"
        aria-label={t('navigation.learningRecords')}
        tabIndex={0}
      >
        <Status loading={loading} error={failed.length > 0} retry={retry} />
        {[...grouped].map(([group, items]) => (
          <section className="dt-learning-time-group" key={group}>
            <h2>{t(GROUP_LABELS[group])}</h2>
            {items.map(row => (
              <NavigationRow
                key={row.key}
                href={row.href}
                label={row.title}
                detail={row.workspaceName}
                icon={learningSurface(row.kind).icon}
                trailing={
                  <time
                    className="dt-record-time"
                    dateTime={new Date(row[sort] * 1000).toISOString()}
                    title={new Date(row[sort] * 1000).toLocaleString(i18n.language)}
                  >
                    {formatRelativeTime(row[sort], i18n.language)}
                  </time>
                }
              />
            ))}
          </section>
        ))}
        {!loading && !rows.length && !failed.length && (
          <p className="dt-navigation-empty">
            {t(query || localQuery ? 'navigation.noResults' : 'navigation.noLearning')}
          </p>
        )}
        {rows.length > limit && (
          <button
            className="dt-navigation-row w-full"
            onClick={() => setLimit(value => value + 30)}
          >
            <ChevronDown size={15} />
            {t('Show more')}
          </button>
        )}
        {sessions}
      </div>
    </div>
  )
}
