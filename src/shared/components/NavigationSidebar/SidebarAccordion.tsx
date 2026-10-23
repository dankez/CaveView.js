import { useId, useState, type ReactNode } from 'react';

export function SidebarAccordion({
  heading,
  detailsLabel,
  children,
  primary,
  enabled = true,
  navTarget,
}: {
  heading: ReactNode
  detailsLabel: string
  children: ReactNode
  primary?: ReactNode
  enabled?: boolean
  navTarget?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const id = useId()
  const open = enabled && expanded

  return (
    <section className="cad-card nav-accordion" data-nav-target={navTarget}>
      <div id={`${id}-heading`} className="nav-accordion-heading">{heading}</div>
      {primary}
      {enabled && (
        <button
          type="button"
          className="nav-details-toggle"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          aria-labelledby={`${id}-heading ${id}-label`}
          onClick={() => setExpanded(value => !value)}
        >
          <span id={`${id}-label`}>{detailsLabel}</span>
          <span aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
      )}
      <div id={`${id}-body`} hidden={!open} className="nav-accordion-body">{children}</div>
    </section>
  )
}
