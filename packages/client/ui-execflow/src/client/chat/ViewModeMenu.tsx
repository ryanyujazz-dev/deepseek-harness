/**
 * ViewModeMenu: the execflow view's display-mode picker — a horizontal
 * ellipsis pinned at the view's top-LEFT, floating over the flow (does not
 * scroll with content).
 *
 * Normal = the execution-only form (think hidden, content-anchored
 * aggregation). Think = think content rendered in the flow, expanded by
 * default. Both ride the same persisted thinkMode as the running-turn
 * Thinking switch, so both entry points always agree.
 */
import { useEffect, useState } from 'react'
import { IconEllipsisOutline16, Menu, type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ThinkMode } from './ChatView.tsx'
import css from './ViewModeMenu.module.css'

interface ViewModeMenuProps {
  /** Active think display form. */
  thinkMode: ThinkMode
  /** Switch the form (persisted by the owner). */
  onSetMode: (mode: ThinkMode) => void
}

/** The execflow display-mode picker. */
export function ViewModeMenu({ thinkMode, onSetMode }: ViewModeMenuProps) {
  const [open, setOpen] = useState(false)

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
    { type: 'label', id: 'display', text: '显示方式' },
    { id: 'compact', label: 'Normal' },
    { id: 'inline', label: 'Think' },
  ]

  return (
    <div className={css.root}>
      <Menu
        open={open}
        anchor={(
          <button
            type="button"
            className={css.trigger}
            aria-label="执行流显示方式"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => { setOpen(v => !v) }}
          >
            <IconEllipsisOutline16 size={16} />
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
    </div>
  )
}
