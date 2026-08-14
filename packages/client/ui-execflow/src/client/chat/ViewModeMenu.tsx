/**
 * ViewModeMenu: the execflow tab's display-mode picker (vertical ellipsis at
 * the view's top-right). Normal = think rows inline in the flow (form A);
 * Think = compact form (think hidden, content-anchored aggregation). The
 * choice rides the same persisted thinkMode as the running-turn Thinking
 * switch, so both entry points always agree.
 */
import { useEffect, useRef, useState } from 'react'
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
  const rootRef = useRef<HTMLDivElement | null>(null)

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
    { id: 'inline', label: 'Normal', icon: undefined },
    { id: 'compact', label: 'Think' },
  ]

  return (
    <div className={css.root} ref={rootRef}>
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
        align="end"
      />
    </div>
  )
}
