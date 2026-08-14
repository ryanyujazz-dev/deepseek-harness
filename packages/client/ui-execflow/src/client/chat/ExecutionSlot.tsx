/**
 * ExecutionSlot: one contiguous tool run of a step rendered as a single
 * morphing slot (Claude-desktop form). Exactly one header is visible at any
 * moment — the latest DRAFTING block, else the latest RUNNING tool, else the
 * aggregate of ≥2 settled tools, else the single settled tool's own row.
 * Drafting and running are one "live" concept (the run's next member being
 * born vs. executing); a new live member replaces the header in place, and
 * the displaced members are always reachable by expanding the header.
 */
import { memo, useEffect, useMemo, useState, type ReactNode } from 'react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import { draftingEntry } from './DraftingToolRow.tsx'
import { DraftingToolRow } from './DraftingToolRow.tsx'
import css from './ExecutionSlot.module.css'

/** One run member: a landed tool node key + its live state facts. */
export interface SlotMember {
  readonly nodeKey: string
  readonly toolName: string
  /** Derived like toolRowModel: running until a settled result block lands. */
  readonly running: boolean
}

/** One drafting block from the streaming partial (not yet landed). */
export interface SlotDrafting {
  /** Wire name once the first tool-call delta carried it. */
  readonly name: string
  /** Block index in the partial, for chronological order. */
  readonly index: number
}

/** What the header currently is. */
type HeaderForm =
  | { kind: 'drafting'; drafting: SlotDrafting }
  | { kind: 'running'; member: SlotMember }
  | { kind: 'aggregate'; count: number; durationMs: number | null; names: string }
  | { kind: 'single' }
  | { kind: 'empty' }

/** Format a settled run's total duration. */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m${seconds.toString().padStart(2, '0')}s`
}

/** Compact tool-name summary for the aggregate header: `Edit×2 Read Bash`. */
function nameSummary(names: readonly string[]): string {
  const counts = new Map<string, number>()
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
  const pretty = (name: string): string => {
    switch (name) {
      case 'pwsh': return 'Pwsh'
      case 'bash': return 'Bash'
      case 'run_code': return 'Code'
      case 'todo_write': return 'Todo'
      default: return name.charAt(0).toUpperCase() + name.slice(1)
    }
  }
  return [...counts.entries()].map(([name, n]) => n > 1 ? `${pretty(name)}×${n}` : pretty(name)).join(' ')
}

/** Format like Claude Code: N 个操作 with Chinese copy matching the tab. */
function countLabel(count: number): string {
  return `${count} 个操作`
}

interface ExecutionSlotProps {
  /** Landed members in chronological order. */
  readonly members: readonly SlotMember[]
  /** Drafting blocks in the partial (chronological), if the run is streaming. */
  readonly drafting: readonly SlotDrafting[]
  /** Run duration: first member's start → last member's end (ms), when closed. */
  readonly durationMs: number | null
  /** Renders one member's full row (running or settled) inside the slot. */
  readonly renderMember: (nodeKey: string) => ReactNode
}

/** Derive the header form from members + drafting. */
function headerForm(members: readonly SlotMember[], drafting: readonly SlotDrafting[]): HeaderForm {
  // Latest drafting block wins: the run's newest member being born.
  const mapped = drafting.filter(d => draftingEntry(d.name) !== undefined)
  const latestDrafting = mapped[mapped.length - 1]
  if (latestDrafting !== undefined) return { kind: 'drafting', drafting: latestDrafting }
  const running = members.filter(m => m.running)
  const latestRunning = running[running.length - 1]
  if (latestRunning !== undefined) return { kind: 'running', member: latestRunning }
  if (members.length >= 2) return { kind: 'aggregate', count: 0, durationMs: null, names: '' }
  if (members.length === 1) return { kind: 'single' }
  return { kind: 'empty' }
}

/** The single-slot execution view. */
export const ExecutionSlot = memo(function ExecutionSlot({
  members, drafting, durationMs, renderMember,
}: ExecutionSlotProps) {
  const form = headerForm(members, drafting)
  const [expanded, setExpanded] = useState(false)

  // Members other than a running header are the expand body; the aggregate's
  // body is every member. A drafting header's body is earlier drafting blocks
  // plus landed members (chronological by position: drafting are newest, so
  // landed first, then earlier drafting blocks — the header is the latest).
  const bodyKeys: string[] = useMemo(() => {
    if (form.kind === 'aggregate') return members.map(m => m.nodeKey)
    if (form.kind === 'running') return members.filter(m => m !== form.member).map(m => m.nodeKey)
    return []
  }, [form, members])
  const earlierDrafting: SlotDrafting[] = form.kind === 'drafting'
    ? drafting.filter(d => d !== form.drafting && draftingEntry(d.name) !== undefined)
    : []
  const expandable = bodyKeys.length > 0 || earlierDrafting.length > 0 || form.kind === 'aggregate'

  // Keep expansion through header swaps (new member replaces the header, the
  // displaced one joins the body); only an empty slot resets.
  useEffect(() => {
    if (form.kind === 'empty') setExpanded(false)
  }, [form.kind])

  if (form.kind === 'empty') return null

  // Single settled member: its own ordinary row, native interactions — the
  // slot is transparent.
  const singleMember = members[0]
  if (form.kind === 'single' && singleMember !== undefined) {
    return <div className={css.slot}>{renderMember(singleMember.nodeKey)}</div>
  }

  if (form.kind === 'aggregate') {
    const label = `${countLabel(members.length)}${durationMs === null ? '' : ` · ${formatDuration(durationMs)}`}`
    return (
      <div className={css.slot}>
        <div
          className={css.aggregate}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onClick={() => { setExpanded(v => !v) }}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setExpanded(v => !v) }}
        >
          <span className={css.chevron} aria-hidden>
            <IconChevronDownOutline14 />
          </span>
          <span className={css.aggregateCount}>{label}</span>
          <span className={css.aggregateNames}>{nameSummary(members.map(m => m.toolName))}</span>
        </div>
        {expanded && (
          <div className={css.body}>
            {members.map(m => (
              <div key={m.nodeKey}>{renderMember(m.nodeKey)}</div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Live header (drafting or running): the header row itself, expandable to
  // the displaced members. Drafting headers show the drafting row; running
  // headers show the member's own row wrapped as the disclosure toggle.
  const entry = form.kind === 'drafting' ? draftingEntry(form.drafting.name) : undefined
  return (
    <div className={css.slot}>
      <div
        className={css.header}
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? expanded : undefined}
        onClick={() => { if (expandable) setExpanded(v => !v) }}
        onKeyDown={(event) => {
          if (expandable && (event.key === 'Enter' || event.key === ' ')) setExpanded(v => !v)
        }}
      >
        {form.kind === 'drafting' && entry !== undefined
          ? <DraftingToolRow label={entry.label} icon={entry.icon} />
          : form.kind === 'running' ? renderMember(form.member.nodeKey) : null}
      </div>
      {expanded && expandable && (
        <div className={css.body}>
          {bodyKeys.map(key => <div key={key}>{renderMember(key)}</div>)}
          {earlierDrafting.map((d) => {
            const e = draftingEntry(d.name)
            return e === undefined ? null : <DraftingToolRow key={`draft:${d.index}`} label={e.label} icon={e.icon} />
          })}
        </div>
      )}
    </div>
  )
})
