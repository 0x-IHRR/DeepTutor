import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import NotebookConsole from '@/components/notebook/NotebookConsole'
import NoteFavoritesPicker from '@/features/notes/components/NoteFavoritesPicker'
import { favoriteRecordRoute } from '@/lib/resource-routes'

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  locate: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  collection: {
    id: 'inbox',
    name: 'Inbox',
    records: [
      {
        id: 'a',
        title: 'Alpha',
        output: '**Original**',
        summary: 'Saved source',
        type: 'chat',
        user_query: '',
      },
      { id: 'b', title: 'Beta', output: 'Other body', summary: '', type: 'chat', user_query: '' },
    ],
  },
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: translate }) }))
function translate(key: string) {
  return key
}
vi.mock('@/components/common/PickerShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
}))
vi.mock('next/navigation', () => ({ useRouter: () => mocks.router }))
vi.mock('@/components/notebook/NotebookRecordRow', () => ({
  default: ({
    record,
    expanded,
    onToggle,
  }: {
    record: { id: string; title: string }
    expanded: boolean
    onToggle: () => void
  }) => (
    <button aria-expanded={expanded} onClick={onToggle}>
      {record.title}
    </button>
  ),
}))
vi.mock('@/lib/notebook-api', () => ({
  locateFavoriteRecord: (...args: unknown[]) => mocks.locate(...args),
  listNotebooks: () => mocks.list(),
  getNotebook: (id: string) => mocks.get(id),
}))
vi.mock('@/components/notebook/useNotebookLibrary', () => ({
  useNotebookLibrary: () => ({
    selectedId: 'inbox',
    selected: mocks.collection,
    notebooks: [mocks.collection],
    loading: false,
    detailLoading: false,
    select: vi.fn(),
  }),
}))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  mocks.locate.mockResolvedValue(null)
  mocks.list.mockResolvedValue([mocks.collection])
  mocks.get.mockResolvedValue(mocks.collection)
})
it('encodes source identities without losing the target record', () => {
  expect(favoriteRecordRoute('folder / 一', 'r? 1')).toBe(
    '/notebooks/folder%20%2F%20%E4%B8%80?record=r%3F%201'
  )
})
it('opens the exact source and keeps it visible even with a previous filter', async () => {
  render(<NotebookConsole initialNotebookId="inbox" initialRecordId="b" />)
  expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-expanded', 'false')
  fireEvent.change(screen.getByPlaceholderText('Search records in this notebook'), {
    target: { value: 'unmatched' },
  })
  expect(screen.getByRole('button', { name: 'Beta' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Beta' }))
  expect(mocks.router.replace).toHaveBeenCalledWith('/notebooks/inbox')
  expect(mocks.locate).not.toHaveBeenCalled()
})
it('redirects an old source link after moving the favorite', async () => {
  mocks.locate.mockResolvedValue('archive')
  render(<NotebookConsole initialNotebookId="inbox" initialRecordId="moved" />)
  await waitFor(() =>
    expect(mocks.router.replace).toHaveBeenCalledWith('/notebooks/archive?record=moved')
  )
})
it('shows a missing-source notice instead of opening a different favorite', async () => {
  render(<NotebookConsole initialNotebookId="inbox" initialRecordId="deleted" />)
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This favorite is no longer available.'
  )
  expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-expanded', 'false')
})
it('inserts original text with its exact source link and closes the picker', async () => {
  const insert = vi.fn(),
    close = vi.fn()
  render(<NoteFavoritesPicker onInsert={insert} onClose={close} onSynthesize={vi.fn()} />)
  await screen.findByRole('option', { name: 'Inbox' })
  fireEvent.change(screen.getByLabelText('Favorites'), { target: { value: 'inbox' } })
  fireEvent.click(await screen.findByRole('checkbox', { name: /Alpha.*Saved source/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Insert' }))
  expect(insert).toHaveBeenCalledWith([
    {
      title: 'Alpha',
      markdown: '**Original**',
      sourceUrl: '/notebooks/inbox?record=a',
      sourceId: 'a',
      favorite: { type: 'chat', summary: 'Saved source', metadata: {} },
    },
  ])
  expect(close).toHaveBeenCalledOnce()
})
it('submits a filtered multi-selection as one batch in collection order', async () => {
  const insert = vi.fn()
  render(<NoteFavoritesPicker onInsert={insert} onClose={vi.fn()} onSynthesize={vi.fn()} />)
  await screen.findByRole('option', { name: 'Inbox' })
  fireEvent.change(screen.getByLabelText('Favorites'), { target: { value: 'inbox' } })
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Beta' }))
  fireEvent.change(screen.getByLabelText('Search favorites'), { target: { value: 'Alpha' } })
  fireEvent.click(screen.getByRole('checkbox', { name: /Alpha.*Saved source/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Insert' }))
  expect(insert).toHaveBeenCalledOnce()
  expect(insert.mock.calls[0][0].map((clip: { sourceId: string }) => clip.sourceId)).toEqual([
    'a',
    'b',
  ])
})
it('clears selection when switching collections and displays empty state', async () => {
  mocks.list.mockResolvedValue([mocks.collection, { id: 'empty', name: 'Empty' }])
  render(<NoteFavoritesPicker onInsert={vi.fn()} onClose={vi.fn()} onSynthesize={vi.fn()} />)
  await screen.findByRole('option', { name: 'Inbox' })
  fireEvent.change(screen.getByLabelText('Favorites'), { target: { value: 'inbox' } })
  fireEvent.click(await screen.findByRole('checkbox', { name: /Alpha.*Saved source/ }))
  mocks.get.mockResolvedValue({ records: [] })
  fireEvent.change(screen.getByLabelText('Favorites'), { target: { value: 'empty' } })
  await waitFor(() =>
    expect(screen.getByText('No favorites in this collection yet.')).toBeVisible()
  )
  expect(screen.getByRole('button', { name: 'Insert' })).toBeDisabled()
})
