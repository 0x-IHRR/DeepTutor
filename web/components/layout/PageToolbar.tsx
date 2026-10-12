import type { ComponentPropsWithoutRef } from 'react'

/** Shared page chrome; pane-specific editing tools belong below this bar. */
export function PageToolbar({
  children,
  className = '',
  ...props
}: ComponentPropsWithoutRef<'header'>) {
  return (
    <header {...props} data-page-toolbar className={`dt-page-toolbar ${className}`}>
      {children}
    </header>
  )
}
