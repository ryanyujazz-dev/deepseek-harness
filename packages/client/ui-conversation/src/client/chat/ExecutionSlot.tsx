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
import {
  IconApiOutline14, IconBrowseOutline16, IconChevronDownOutline14, IconCodeOutline16,
  IconEditOutline16, IconSearchOutline16, IconSparkle16,
} from '@deepseek-ai/dsh-client-ui-primitives'
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
  | { kind: 'aggregate' }
  | { kind: 'single' }
  | { kind: 'empty' }

/** Variant leading glyph for a wire tool name (mirrors GenericToolCard's table). */
function toolIcon(name: string): ReactNode {
  switch (name) {
    case 'bash': case 'pwsh': return <IconApiOutline14 size={14} />
    case 'read': case 'web_fetch': case 'read_image': case 'cordis_package_inspect':
    case 'cordis_runtime_inspect': return <IconBrowseOutline16 size={14} />
    case 'web_search': case 'grep': case 'glob': case 'session_search': case 'session_event_search':
      return <IconSearchOutline16 size={14} />
    case 'write': case 'edit': return <IconEditOutline16 size={14} />
    case 'run_code': return <IconCodeOutline16 size={14} />
    default: return <IconSparkle16 size={14} />
  }
}

/** Per-tool action phrase for the aggregate header: `Edit 1 file, Read 1 file`. */
function actionPhrase(name: string, count: number): string {
  const noun = (base: string): string => count > 1 ? `${base}s` : base
  switch (name) {
    case 'edit': return `Edit ${count} ${noun('file')}`
    case 'write': return `Create ${count} ${noun('file')}`
    case 'read': case 'read_image': return `Read ${count} ${noun('file')}`
    case 'web_fetch': return `Fetch ${count} ${noun('page')}`
    case 'web_search': return `Search ${count} ${noun('time')}`
    case 'grep': return `Search ${count} ${noun('pattern')}`
    case 'glob': return `List ${count} ${noun('path')}`
    case 'bash': case 'pwsh': return count > 1 ? `Run ${count} commands` : 'Run 1 command'
    case 'run_code': return `Run ${count} ${noun('program')}`
    case 'todo_write': return `Update ${count} ${noun('todo list')}`
    default: {
      const pretty = name.charAt(0).toUpperCase() + name.slice(1)
      return count > 1 ? `${pretty} ×${count}` : pretty
    }
  }
}

/** Aggregate text: chronological per-tool phrases joined: `read 1 file, edit 1 file`. */
function aggregateText(members: readonly SlotMember[]): string {
  const order: string[] = []
  const counts = new Map<string, number>()
  for (const member of members) {
    if (!counts.has(member.toolName)) order.push(member.toolName)
    counts.set(member.toolName, (counts.get(member.toolName) ?? 0) + 1)
  }
  return order.map(name => actionPhrase(name, counts.get(name) ?? 1)).join(', ')
}

interface ExecutionSlotProps {
  /** Landed members in chronological order. */
  readonly members: readonly SlotMember[]
  /** Drafting blocks in the partial (chronological), if the run is streaming. */
  readonly drafting: readonly SlotDrafting[]
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
  if (members.length >= 2) return { kind: 'aggregate' }
  if (members.length === 1) return { kind: 'single' }
  return { kind: 'empty' }
}

/** The single-slot execution view. */
export const ExecutionSlot = memo(function ExecutionSlot({
  members, drafting, renderMember,
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
    // The aggregate shows only when no member is live (a live member owns the
    // slot), so it always reads at the settled muted color.
    const lastMember = members[members.length - 1]
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
          <span className={css.leading} aria-hidden>
            <span className={css.leadingIcon}>{lastMember === undefined ? null : toolIcon(lastMember.toolName)}</span>
            <span className={css.leadingChevron}><IconChevronDownOutline14 /></span>
          </span>
          <span className={css.aggregateText}>{aggregateText(members)}</span>
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
