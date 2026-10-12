import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LearningNavigation } from '@/components/sidebar/LearningNavigation'

vi.mock('next/navigation', () => ({ usePathname: () => '/learning', useSearchParams: () => new URLSearchParams() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }))
vi.mock('@/components/learning/LearningCreateMenu', () => ({ LearningCreateMenu: () => <button>Create learning</button> }))
vi.mock('@/components/layout/AppShell', () => ({ useSidebarDrawer: () => null }))
vi.mock('@/hooks/useLearningIndex', () => ({ useLearningIndex: () => ({
  loading: false, failed: [], retry: vi.fn(), sources: {
    books: [], mastery: [], reading: [], watching: [], practice: [
      { id: 1, question: 'Older material, recently studied', created_at: 100, updated_at: 900, content_workspace_id: 'physics' },
      { id: 2, question: 'Newly created material', created_at: 800, updated_at: 800, content_workspace_id: '' },
    ],
  },
}) }))
beforeEach(() => localStorage.clear())

it('sorts by creation independently of activity and retains the preference', () => {
  const view = render(<LearningNavigation query="" sessions={null} />)
  const records = () => within(screen.getByRole('region', { name: 'navigation.learningRecords' })).getAllByRole('link')
  expect(records()[0]).toHaveTextContent('Older material')
  fireEvent.change(screen.getByRole('combobox', { name: 'navigation.sortLearning' }), { target: { value: 'createdAt' } })
  expect(records()[0]).toHaveTextContent('Newly created material')
  expect(records()[1]).toHaveAttribute('href', '/learning/practice?question=1&dt_workspace=physics')
  view.unmount()
  render(<LearningNavigation query="" sessions={null} />)
  expect(records()[0]).toHaveTextContent('Newly created material')
})

it('searches records without discarding the rest of the library', () => {
  render(<LearningNavigation query="" sessions={null} />)
  fireEvent.click(screen.getByRole('button', { name: 'navigation.searchLearning' }))
  const input = screen.getByRole('textbox', { name: 'navigation.searchLearning' })
  fireEvent.change(input, { target: { value: 'recently' } })
  const list = within(screen.getByRole('region', { name: 'navigation.learningRecords' }))
  expect(list.getAllByRole('link')).toHaveLength(1)
  expect(list.getByRole('link')).toHaveTextContent('Older material')
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(list.getAllByRole('link')).toHaveLength(2)
})
