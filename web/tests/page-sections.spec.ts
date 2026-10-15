import { describe, expect, it } from 'vitest'
import { locatePage, pageSections } from '@/components/sidebar/page-sections'

const sections = (allowedSurfaces: string[] | null = null) =>
  pageSections({ t: key => key, zh: false, allowedSurfaces, isAvailable: () => false })

describe('page sections', () => {
  it('places each index page in the shelf the sidebar shows it under', () => {
    expect(locatePage('/space/journal', sections())?.section.id).toBe('resources')
    expect(locatePage('/learning', sections())?.section.id).toBe('learning')
    expect(locatePage('/kanban', sections())?.section.id).toBe('home')
    expect(locatePage('/partners', sections())?.section.scoped).toBe(false)
    expect(locatePage('/space', sections())?.section.scoped).toBe(true)
  })

  it('leaves detail views and the chat to their own headers', () => {
    expect(locatePage('/chat', sections())).toBeNull()
    expect(locatePage('/partners/frank', sections())).toBeNull()
    expect(locatePage('/notebooks/abc', sections())).toBeNull()
  })

  it('applies the same gates as the sidebar shelves', () => {
    const learning = sections(['books']).find(section => section.id === 'learning')!
    expect(learning.pages.map(page => page.label)).toEqual(['navigation.allLearning', 'Books'])
    // Capability-gated resources stay hidden until the backend registers them.
    const resources = sections().find(section => section.id === 'resources')!
    expect(resources.pages.some(page => page.href === '/whisper')).toBe(false)
  })
})
