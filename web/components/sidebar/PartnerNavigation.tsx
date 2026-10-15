'use client'
import { useTranslation } from 'react-i18next'
import { NavigationRow, Status } from './NavigationPrimitives'
import { PartnerRoster } from './PartnerRoster'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Plus, ChevronDown, ChevronRight, Users } from 'lucide-react'
import { usePartnerNavigation } from '@/hooks/usePartnerNavigation'
import { partnerSessionHref } from '@/lib/navigation'

export function PartnerNavigation({ active = true }: { active?: boolean }) {
  const { t } = useTranslation()
  const search = useSearchParams()
  const pathname = usePathname()
  const { data, loading, error, retry } = usePartnerNavigation(active)
  const [limit, setLimit] = useState(30)
  const { partners, groups, sessions } = data
  return (
    <div className="dt-partner-navigation">
      <section className="dt-partner-preview" aria-labelledby="partner-preview-title">
        <div className="dt-navigation-heading">
          <h2 id="partner-preview-title">
            {t('navigation.partners')}{' '}
            <span className="dt-navigation-count">{partners.length}</span>
          </h2>
          <div className="dt-navigation-actions">
            <Link
              prefetch={false}
              href="/partners#partners"
              aria-label={t('navigation.allPartners')}
              className="dt-navigation-view-all"
            >
              {t('navigation.viewAll')}
              <ChevronRight size={12} />
            </Link>
            <Link
              prefetch={false}
              href="/partners/new"
              aria-label={t('New partner')}
              className="dt-nav-icon"
            >
              <Plus size={15} strokeWidth={1.7} />
            </Link>
          </div>
        </div>
        <PartnerRoster partners={partners} activeHref={pathname} />
        {!loading && !partners.length && (
          <p className="dt-navigation-empty">
            {t('No partners yet')}
          </p>
        )}
      </section>
      <section className="dt-partner-preview" aria-labelledby="group-preview-title">
        <div className="dt-navigation-heading">
          <h2 id="group-preview-title">
            {t('Groups')} <span className="dt-navigation-count">{groups.length}</span>
          </h2>
          <div className="dt-navigation-actions">
            <Link
              prefetch={false}
              href="/partners#groups"
              aria-label={t('navigation.allGroups')}
              className="dt-navigation-view-all"
            >
              {t('navigation.viewAll')}
              <ChevronRight size={12} />
            </Link>
            {data.partners.length >= 2 && (
              <Link
                prefetch={false}
                className="dt-nav-icon"
                href="/partners/groups/new"
                aria-label={t('New group')}
              >
                <Plus size={15} strokeWidth={1.7} />
              </Link>
            )}
          </div>
        </div>
        {groups.slice(0, 2).map(group => (
          <NavigationRow
            key={group.group_id}
            href={`/partners/groups/${encodeURIComponent(group.group_id)}`}
            label={group.name}
            icon={Users}
          />
        ))}
        {!loading && !groups.length && (
          <p className="dt-navigation-empty">
            {t('navigation.noGroups')}
          </p>
        )}
      </section>
      <section className="dt-partner-sessions" aria-labelledby="partner-sessions-title">
        <div className="dt-navigation-heading">
          <h2 id="partner-sessions-title">
            {t('navigation.partnerSessions')}{' '}
            <span className="dt-navigation-count">{sessions.length}</span>
          </h2>
        </div>
        <div
          className="dt-partner-session-list"
          tabIndex={0}
          role="region"
          aria-label={t('navigation.partnerSessions')}
        >
          <Status loading={loading} error={error || data.unavailable.length > 0} retry={retry} />
          {sessions.slice(0, limit).map(row => {
            const href = partnerSessionHref(row)
            return (
              <NavigationRow
                key={`${row.kind}:${row.owner_id}:${row.session_key}`}
                href={href}
                label={row.title || t('New conversation')}
                detail={row.owner_name}
                active={
                  pathname === href.split('?')[0] && search.get('session') === row.session_key
                }
              />
            )
          })}
          {!loading && !sessions.length && !error && (
            <p className="dt-navigation-empty">
              {t('navigation.noSessions')}
            </p>
          )}
          {sessions.length > limit && (
            <button
              className="dt-navigation-row w-full"
              onClick={() => setLimit(value => value + 30)}
            >
              <ChevronDown size={15} />
              {t('Show more')}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
