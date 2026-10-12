'use client'

import {
  createContext,
  useContext,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
  type Ref,
  type UIEventHandler,
} from 'react'
import { createPortal } from 'react-dom'
import { PageToolbar } from './PageToolbar'

const PageChromeContext = createContext<{
  host: HTMLDivElement | null
  breadcrumb?: ReactNode
} | null>(null)

/** A stable toolbar slot outside the page's scrollport. A portal preserves the
 * page's state/providers while placing its real actions at the same screen edge.
 * The reserved height also prevents a layout jump while the slot mounts. */
export function PageFrame({
  children,
  breadcrumb,
}: {
  children: ReactNode
  breadcrumb?: ReactNode
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  return (
    <PageChromeContext.Provider value={{ host, breadcrumb }}>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <div ref={setHost} className="dt-page-toolbar-host" />
        {children}
      </div>
    </PageChromeContext.Provider>
  )
}

/** Feature page standard, based on Personalized Learning:
 * - Centered 1180px outer box; horizontal gutters 24px, 36px from 768px.
 * - Vertical padding 28px, 36px from 1024px; 24px from header to content.
 * - Compact 14px identity in the toolbar; standalone headings remain 27px / 30px.
 * - Sans description 12.5px, section label 13.5px; one h1 per page.
 * - Page actions align right; secondary section actions stay with their section.
 * - Grids share 520 / 800 / 1040px container breakpoints and a 12px gap.
 * - Page identity/actions use the fixed toolbar slot; descriptions stay in the body.
 * - Readers, editors and chats share PageToolbar and retain their working tools.
 * Use FeaturePage once per scrolling page, or PageContainer inside an
 * existing scroller. Child components must not add another page gutter.
 */
export function PageContainer({
  children,
  className = '',
  spacing = 'page',
  ...props
}: ComponentPropsWithRef<'div'> & { spacing?: 'page' | 'toolbar' }) {
  return (
    <div
      {...props}
      data-page-container
      className={`dt-page-container mx-auto w-full min-w-0 max-w-[1180px] px-6 md:px-9 ${spacing === 'page' ? 'py-7 lg:py-9' : 'py-3'} ${className}`}
    >
      {children}
    </div>
  )
}

export function FeaturePage({
  children,
  className = '',
  scrollRef,
  onScroll,
  breadcrumb,
}: {
  children: ReactNode
  className?: string
  scrollRef?: Ref<HTMLElement>
  onScroll?: UIEventHandler<HTMLElement>
  breadcrumb?: ReactNode
}) {
  return (
    <PageFrame breadcrumb={breadcrumb}>
      <section
        ref={scrollRef}
        onScroll={onScroll}
        data-feature-page
        className={`flex-1 min-h-0 w-full min-w-0 overflow-y-auto bg-[var(--background)] text-[var(--foreground)] [scrollbar-gutter:stable] ${className}`}
      >
        <PageContainer>{children}</PageContainer>
      </section>
    </PageFrame>
  )
}

export const PAGE_TITLE_CLASS =
  'dt-page-title min-w-0 break-words font-sans font-semibold leading-normal tracking-[-0.02em] text-[var(--foreground)]'
export const PAGE_DESCRIPTION_CLASS =
  'mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-[var(--muted-foreground)]'
export const PAGE_SECTION_TITLE_CLASS = 'text-[13.5px] font-semibold text-[var(--foreground)]'

/** No decorative title icon or divider. Icons belong to cards and actions.
 * Secondary sections use h2 so a feature page always has one main heading.
 */
export function PageHeader({
  title,
  description,
  action,
  meta,
  level = 1,
  titleId,
  headingTour,
  breadcrumb,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  meta?: ReactNode
  level?: 1 | 2
  titleId?: string
  headingTour?: string
  breadcrumb?: ReactNode
}) {
  const chrome = useContext(PageChromeContext)
  const Heading = level === 1 ? 'h1' : 'h2'
  if (level === 1 && chrome) {
    const trail = breadcrumb ?? chrome.breadcrumb
    return (
      <>
        {chrome.host &&
          createPortal(
            <PageToolbar>
              <div className="dt-toolbar-identity">
                {trail && (
                  <>
                    <div className="dt-toolbar-breadcrumb">{trail}</div>
                    <span aria-hidden className="dt-toolbar-separator">
                      /
                    </span>
                  </>
                )}
                <h1 id={titleId} data-tour={headingTour} className="dt-toolbar-title">
                  {title}
                </h1>
                {meta}
              </div>
              {action && (
                <div data-page-actions className="dt-toolbar-actions">
                  {action}
                </div>
              )}
            </PageToolbar>,
            chrome.host
          )}
        {description && <p className={`${PAGE_DESCRIPTION_CLASS} mb-6 !mt-0`}>{description}</p>}
      </>
    )
  }
  return (
    <header data-page-header className="dt-page-header mb-6 flex min-w-0 flex-col gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <Heading
            id={titleId}
            data-tour={headingTour}
            className={level === 1 ? PAGE_TITLE_CLASS : PAGE_SECTION_TITLE_CLASS}
          >
            {title}
          </Heading>
          {meta}
        </div>
        {description && <p className={PAGE_DESCRIPTION_CLASS}>{description}</p>}
      </div>
      {action && (
        <div
          data-page-actions
          className="flex max-w-full shrink-0 flex-wrap items-center gap-2 [&>div]:max-w-full [&>div]:flex-wrap"
        >
          {action}
        </div>
      )}
    </header>
  )
}

export function pageActionClass(variant: 'primary' | 'secondary' = 'primary') {
  return `dt-page-action inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-medium leading-[18px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60 ${
    variant === 'primary'
      ? 'bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90'
      : 'border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]'
  }`
}

/** Column limits describe the content, while one set of container breakpoints
 * controls every library. Works on divs and semantic lists alike.
 */
export function pageGridClass(columns: 2 | 3 | 4 | 5 | 'board' = 2) {
  return `dt-page-grid dt-page-grid-${columns}`
}
