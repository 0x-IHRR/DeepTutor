'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type SlotName = 'meta' | 'actions'
type Slots = Record<SlotName, HTMLElement | null>

const PageChromeContext = createContext<{
  slots: Slots
  setSlot: (name: SlotName, node: HTMLElement | null) => void
} | null>(null)

/**
 * Lets a page hand parts of its header to the bar above it.
 *
 * The page bar owns the top of every section page: the page's name on the
 * left, its actions on the right. Pages keep declaring their header as they
 * always have; the parts the bar can show are rendered into it from there,
 * so they keep the page's own state and context.
 */
export function PageChromeProvider({ children }: { children: ReactNode }) {
  const [slots, setSlots] = useState<Slots>({ meta: null, actions: null })
  const setSlot = useCallback(
    (name: SlotName, node: HTMLElement | null) =>
      setSlots(current => (current[name] === node ? current : { ...current, [name]: node })),
    []
  )
  const value = useMemo(() => ({ slots, setSlot }), [slots, setSlot])
  return <PageChromeContext.Provider value={value}>{children}</PageChromeContext.Provider>
}

/** The bar's side: a ref for the element that receives `name`. */
export function usePageSlotRef(name: SlotName) {
  const setSlot = useContext(PageChromeContext)?.setSlot
  return useCallback((node: HTMLElement | null) => setSlot?.(name, node), [name, setSlot])
}

/**
 * The page's side: shows `children` in the bar when the bar offers `name`,
 * and in place otherwise — in layouts without the bar, on pages it does not
 * cover, and before the bar has mounted.
 */
export function PageBarSlot({
  name,
  className,
  children,
}: {
  name: SlotName
  /** Wrapper for the in-place rendering; none means no wrapper. */
  className?: string
  children: ReactNode
}) {
  const target = useContext(PageChromeContext)?.slots[name] ?? null
  if (target) return createPortal(children, target)
  if (!className) return <>{children}</>
  return (
    <div data-page-actions={name === 'actions' || undefined} className={className}>
      {children}
    </div>
  )
}
