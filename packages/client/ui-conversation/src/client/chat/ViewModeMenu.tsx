/**
 * ViewModeMenu: the execflow view's display-mode picker — a horizontal
 * ellipsis floating at the CONVERSATION COLUMN's top-left, sticking there
 * while the transcript scrolls.
 *
 * Positioning: the transcript's real scrollport ([data-conversation-scroll])
 * may not be a positioned ancestor, so an absolute child anchors against the
 * window instead. The trigger is portaled into the scrollport and positioned
 * FIXED at the scrollport's live top-left viewport coordinates (measured at
 * mount and on window resize; the scrollport itself never scrolls, so fixed
 * coordinates stay valid). Unmounts with the view (execflow-tab-only).
 *
 * Normal = the execution-only form (think hidden, content-anchored
 * aggregation). Think = think content rendered in the flow, expanded by
 * default. Both ride the same persisted thinkMode as the running-turn
 * Thinking switch, so both entry points always agree.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconEllipsisOutline16, Menu, type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ThinkMode } from './ChatView.tsx'
import type { ChatViewSlotProps } from '../contract/slots.ts'

type Translate = ChatViewSlotProps['t']
import css from './ViewModeMenu.module.css'

interface ViewModeMenuProps {
  /** Active think display form. */
  thinkMode: ThinkMode
  /** Switch the form (persisted by the owner). */
  onSetMode: (mode: ThinkMode) => void
  /** The owning view's locale seat. */
  t: Translate
}

/** Viewport coordinates of the scrollport's top-left. */
interface AnchorPosition {
  readonly left: number
  readonly top: number
}

/** The execflow display-mode picker. */
export function ViewModeMenu({ thinkMode, onSetMode, t }: ViewModeMenuProps) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<AnchorPosition | null>(null)

  // Measure the scrollport's top-left in viewport coordinates. The layout
  // settles asynchronously (session open, sidebar animations), so measure on
  // mount, on window resize, and through a ResizeObserver on the scrollport
  // itself. If the scrollport is not in the DOM yet (late session open), a
  // short settle retry re-runs the whole setup once the anchor exists.
  useEffect(() => {
    let observer: ResizeObserver | undefined
    let retry: number | undefined
    const measure = (): void => {
      const scroller = document.querySelector('[data-conversation-scroll]')
      if (!(scroller instanceof HTMLElement)) {
        setAnchor(null)
        // Insurance: re-attempt the wiring once the layout settles.
        if (retry === undefined) {
          retry = window.setTimeout(() => { retry = undefined; measure() }, 200)
        }
        return
      }
      window.clearTimeout(retry)
      retry = undefined
      const rect = scroller.getBoundingClientRect()
      setAnchor(previous =>
        previous !== null && previous.left === rect.left && previous.top === rect.top
          ? previous
          : { left: rect.left, top: rect.top })
      observer?.disconnect()
      if (typeof ResizeObserver === 'function') {
        observer = new ResizeObserver(measure)
        observer.observe(scroller)
      }
    }
    window.addEventListener('resize', measure)
    measure()
    return () => {
      window.clearTimeout(retry)
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [])

  // Close on Escape while open (Menu's own outside-click handles the rest).
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [open])

  const items: MenuEntry[] = [
    { type: 'label', id: 'display', text: t('execflow.menu.display') },
    { id: 'compact', label: t('execflow.menu.normal') },
    { id: 'inline', label: t('execflow.menu.think') },
  ]

  if (anchor === null) return null

  return createPortal(
    <div className={css.root} style={{ left: anchor.left, top: anchor.top }}>
      <Menu
        open={open}
        anchor={(
          <button
            type="button"
            className={css.trigger}
            aria-label={t('execflow.menu.aria')}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => { setOpen(v => !v) }}
          >
            <IconEllipsisOutline16 />
          </button>
        )}
        items={items}
        selectedId={thinkMode}
        onSelect={(id) => {
          if (id === 'inline' || id === 'compact') onSetMode(id)
          setOpen(false)
        }}
        onClose={() => { setOpen(false) }}
        align="start"
      />
    </div>,
    document.body,
  )
}
