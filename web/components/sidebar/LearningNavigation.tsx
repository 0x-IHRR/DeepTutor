'use client'
import { useTranslation } from 'react-i18next'
import { NavigationRow, Section, Status, matches } from './NavigationPrimitives'
import { useState, type ReactNode } from 'react'
import { LayoutGrid, ChevronDown } from 'lucide-react'
import { LearningCreateMenu } from '@/components/learning/LearningCreateMenu'
import { learningSurface } from '@/components/learning/surfaces'
import { allLearningActivity } from '@/lib/learning-dashboard'
import { useLearningIndex } from '@/hooks/useLearningIndex'

export function LearningNavigation({ query, sessions }: { query: string; sessions: ReactNode }) {
  const { t } = useTranslation()
  const { sources, loading, failed, retry } = useLearningIndex()
  const [limit, setLimit] = useState(30)
  const rows = allLearningActivity(sources).filter(row =>
    matches(`${row.title} ${row.workspaceName ?? ''}`, query)
  )
  return (
    <>
      <Section title={t('navigation.learning')} action={<LearningCreateMenu compact />}>
        <NavigationRow href="/learning" label={t('navigation.allLearning')} icon={LayoutGrid} />
      </Section>
      <Section title={t('navigation.learningRecords')}>
        <Status loading={loading} error={failed.length > 0} retry={retry} />
        {rows.slice(0, limit).map(row => (
          <NavigationRow
            key={row.key}
            href={row.href}
            label={row.title}
            detail={row.workspaceName}
            icon={learningSurface(row.kind).icon}
          />
        ))}
        {!loading && !rows.length && !failed.length && (
          <p className="dt-navigation-empty">
            {t(query ? 'navigation.noResults' : 'navigation.noLearning')}
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
      </Section>
      {sessions}
    </>
  )
}
