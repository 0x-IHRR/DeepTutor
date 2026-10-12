import { createContext, useContext, useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import { FeaturePage, PageHeader } from '@/components/layout/FeaturePage'

const DraftContext = createContext('')

function DraftActions() {
  const draft = useContext(DraftContext)
  const [saved, setSaved] = useState(false)
  return <button onClick={() => setSaved(true)}>{saved ? draft : 'Save draft'}</button>
}

it('keeps live page actions and their providers in the toolbar, outside the scrollport', () => {
  const view = render(
    <FeaturePage breadcrumb={<a href="/learning">Learning</a>}>
      <DraftContext.Provider value="Draft saved">
        <PageHeader title="My book" description="A learning project" action={<DraftActions />} />
        <PageHeader level={2} title="Chapters" action={<button>Add chapter</button>} />
      </DraftContext.Provider>
    </FeaturePage>
  )
  const toolbar = screen.getByRole('heading', { name: 'My book' }).closest('header')!
  expect(within(toolbar).getByRole('heading', { name: 'My book' })).toBeVisible()
  expect(within(toolbar).getByRole('link', { name: 'Learning' })).toHaveAttribute(
    'href',
    '/learning'
  )
  expect(toolbar.closest('[data-feature-page]')).toBeNull()
  expect(screen.getByText('A learning project').closest('[data-feature-page]')).not.toBeNull()
  expect(within(toolbar).queryByRole('button', { name: 'Add chapter' })).toBeNull()
  fireEvent.click(within(toolbar).getByRole('button', { name: 'Save draft' }))
  expect(screen.getAllByRole('button', { name: 'Draft saved' })).toHaveLength(1)

  // Changing pages removes the previous page's controls instead of leaving a
  // stale save/delete handler in a persistent shell.
  view.rerender(
    <FeaturePage>
      <PageHeader title="Library" action={<button>New book</button>} />
    </FeaturePage>
  )
  expect(screen.queryByRole('button', { name: 'Draft saved' })).toBeNull()
  expect(screen.getAllByRole('banner')).toHaveLength(1)
  expect(within(screen.getByRole('banner')).getByRole('button', { name: 'New book' })).toBeVisible()
})
