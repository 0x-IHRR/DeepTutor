'use client'
import { useTranslation } from 'react-i18next'
import { NavigationRow, Section, Status, matches } from './NavigationPrimitives'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Plus, ChevronDown, Users, MessageCircle } from 'lucide-react'
import Tooltip from '@/shared/ui/Tooltip'
import PartnerAvatar from '@/components/partners/PartnerAvatar'
import { usePartnerNavigation } from '@/hooks/usePartnerNavigation'
import { partnerSessionHref } from '@/lib/navigation'

export function PartnerNavigation({ query }: { query: string }) {
  const { t } = useTranslation()
  const search = useSearchParams()
  const pathname = usePathname()
  const { data, loading, error, retry } = usePartnerNavigation(true)
  const [limit, setLimit] = useState(30)
  const sessions = data.sessions.filter(row => matches(`${row.title} ${row.owner_name}`, query))
  return (
    <>
      <Section
        title={t('navigation.partners')}
        action={
          <Link
            prefetch={false}
            href="/partners/new"
            aria-label={t('New partner')}
            className="dt-nav-icon"
          >
            <Plus size={16} />
          </Link>
        }
      >
        <div className="dt-partner-roster">
          {data.partners
            .filter(row => matches(row.name, query))
            .map(partner => (
              <Tooltip key={partner.partner_id} label={partner.name} side="right">
                <Link
                  href={`/partners/${encodeURIComponent(partner.partner_id)}`}
                  prefetch={false}
                  className="dt-partner-roster-item"
                >
                  <PartnerAvatar
                    name={partner.name}
                    emoji={partner.emoji}
                    image={partner.avatar}
                    color={partner.color}
                    size={42}
                  />
                  <span>{partner.name}</span>
                </Link>
              </Tooltip>
            ))}
          <Link prefetch={false} href="/partners/new" className="dt-partner-roster-item">
            <span className="dt-partner-add">
              <Plus size={22} strokeWidth={1.5} />
            </span>
            <span>{t('New partner')}</span>
          </Link>
        </div>
        <NavigationRow href="/partners" label={t('navigation.allPartners')} icon={Users} />
      </Section>
      <Status loading={loading} error={error || data.unavailable.length > 0} retry={retry} />
      <Section
        title={t('Groups')}
        action={
          data.partners.length >= 2 ? (
            <Link
              prefetch={false}
              className="dt-nav-icon"
              href="/partners/groups/new"
              aria-label={t('New group')}
            >
              <Plus size={16} />
            </Link>
          ) : null
        }
      >
        {data.groups
          .filter(row => matches(row.name, query))
          .map(group => (
            <NavigationRow
              key={group.group_id}
              href={`/partners/groups/${encodeURIComponent(group.group_id)}`}
              label={group.name}
              icon={Users}
            />
          ))}
        {!loading && !data.groups.length && (
          <p className="dt-navigation-empty">{t('navigation.noGroups')}</p>
        )}
      </Section>
      <Section title={t('navigation.partnerSessions')}>
        {sessions.slice(0, limit).map(row => {
          const href = partnerSessionHref(row)
          return (
            <NavigationRow
              key={`${row.kind}:${row.owner_id}:${row.session_key}`}
              href={href}
              label={row.title || t('New conversation')}
              detail={row.owner_name}
              icon={MessageCircle}
              active={pathname === href.split('?')[0] && search.get('session') === row.session_key}
            />
          )
        })}
        {!loading && !sessions.length && !error && (
          <p className="dt-navigation-empty">
            {t(query ? 'navigation.noResults' : 'navigation.noSessions')}
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
      </Section>
    </>
  )
}
