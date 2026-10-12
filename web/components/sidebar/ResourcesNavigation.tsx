'use client'
import { useTranslation } from 'react-i18next'
import { NavigationRow, Section, matches } from './NavigationPrimitives'
import { Library } from 'lucide-react'
import { DASHBOARD_GROUPS, visibleGroups } from '@/components/space/SpaceDashboard'
import { useCapabilityFilter } from '@/features/capabilities/useCapabilityCatalog'
import { scopedUrl } from '@/lib/workspace-scope'

export function ResourcesNavigation({ query }: { query: string }) {
  const { t, i18n } = useTranslation()
  const available = useCapabilityFilter()
  const zh = i18n.language.startsWith('zh')
  const groups = visibleGroups(DASHBOARD_GROUPS, available)
  return (
    <>
      <Section title={t('navigation.resources')}>
        <NavigationRow href="/space" label={t('navigation.allResources')} icon={Library} />
      </Section>
      {groups.map(group => (
        <Section key={group.label.en} title={zh ? group.label.zh : group.label.en}>
          {group.items
            .filter(row => matches(zh ? row.title.zh : row.title.en, query))
            .map(row => (
              <NavigationRow
                key={row.key}
                href={scopedUrl(row.href)}
                label={zh ? row.title.zh : row.title.en}
                icon={row.icon}
              />
            ))}
        </Section>
      ))}
    </>
  )
}
