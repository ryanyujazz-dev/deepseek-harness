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
  IconApiOutline14, IconBrowseOutline16, IconChevronDownOutline14, IconChevronRightOutline14, IconCodeOutline16,
  IconEditOutline16, IconSearchOutline16, IconSparkle16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatViewSlotProps } from '../contract/slots.ts'

type Translate = ChatViewSlotProps['t']
type ConversationKey = Parameters<Translate>[0]
import { draftingEntry } from './DraftingToolRow.tsx'
import { useHeaderTransition, type HeaderForm } from './header-transition.ts'
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
/** One aggregate phrase: locale key + count params (the `.one` keys carry no
 * params). Unknown tools fall back to the wire name itself (a name, not copy). */
function actionPhrase(name: string, count: number, t: Translate): string {
  const pair = (one: ConversationKey, many: ConversationKey): string =>
    count === 1 ? t(one) : t(many, { count })
  switch (name) {
    case 'edit': return pair('execflow.agg.edit.one', 'execflow.agg.edit')
    case 'write': return pair('execflow.agg.create.one', 'execflow.agg.create')
    case 'read': case 'read_image': return pair('execflow.agg.read.one', 'execflow.agg.read')
    case 'web_fetch': return pair('execflow.agg.fetch.one', 'execflow.agg.fetch')
    case 'web_search': return pair('execflow.agg.searchTime.one', 'execflow.agg.searchTime')
    case 'grep': return pair('execflow.agg.searchPattern.one', 'execflow.agg.searchPattern')
    case 'glob': return pair('execflow.agg.list.one', 'execflow.agg.list')
    case 'bash': case 'pwsh': return pair('execflow.agg.run.one', 'execflow.agg.run')
    case 'run_code': return pair('execflow.agg.program.one', 'execflow.agg.program')
    case 'todo_write': return pair('execflow.agg.todo.one', 'execflow.agg.todo')
    default: {
      const pretty = name.charAt(0).toUpperCase() + name.slice(1)
      return count > 1 ? `${pretty} ×${count}` : pretty
    }
  }
}

/** Aggregate text: chronological per-tool phrases joined: `Read 1 file, Edit 2 files`. */
function aggregateText(members: readonly SlotMember[], t: Translate): string {
  const order: string[] = []
  const counts = new Map<string, number>()
  for (const member of members) {
    if (!counts.has(member.toolName)) order.push(member.toolName)
    counts.set(member.toolName, (counts.get(member.toolName) ?? 0) + 1)
  }
  return order.map(name => actionPhrase(name, counts.get(name) ?? 1, t)).join(', ')
}

interface ExecutionSlotProps {
  /** Landed members in chronological order. */
  readonly members: readonly SlotMember[]
  /** Drafting blocks in the partial (chronological), if the run is streaming. */
  readonly drafting: readonly SlotDrafting[]
  /** Renders one member's full row (running or settled) inside the slot. */
  readonly renderMember: (nodeKey: string) => ReactNode
  /** The owning view's locale seat. */
  readonly t: ChatViewSlotProps['t']
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
  members, drafting, renderMember, t,
}: ExecutionSlotProps) {
  const form = headerForm(members, drafting)
  const { shown, outgoing, gen } = useHeaderTransition(form)
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

  /** One form's header chrome (the stage layers render this for shown/outgoing). */
  const renderHeaderContent = (f: HeaderForm): ReactNode => {
    // The aggregate shows only when no member is live (a live member owns
    // the slot), so it always reads at the settled muted color.
    if (f.kind === 'aggregate') {
      const lastMember = members[members.length - 1]
      return (
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
            <span className={css.leadingChevron}>
              {expanded ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />}
            </span>
          </span>
          <span className={css.aggregateText}>{aggregateText(members, t)}</span>
        </div>
      )
    }
    // Single settled member: its own ordinary row, native interactions
    // through the SAME header wrapper the live forms use, so the row's
    // position in the React tree stays stable across the running to settled
    // transition (an instant-swap class) and never remounts.
    if (f.kind === 'single') {
      const singleMember = members[0]
      return <div className={css.header}>{singleMember === undefined ? null : renderMember(singleMember.nodeKey)}</div>
    }
    // Live header (drafting or running). The member's own row renders as the
    // header content and KEEPS its native interactions (click expands the
    // row's own disclosure); the slot's expand rides a separate handle, so
    // one click can never toggle both and no control nests another.
    const entry = f.kind === 'drafting' ? draftingEntry(f.drafting.name) : undefined
    return (
      <div className={css.header}>
        {expandable && (
          <button
            type="button"
            className={css.handle}
            aria-expanded={expanded}
            aria-label={f.kind === 'running'
              ? t('execflow.slot.toggle', { name: f.member.toolName })
              : t('execflow.slot.toggleDrafting', { label: entry === undefined ? '' : t(entry.key) })}
            onClick={() => { setExpanded(v => !v) }}
          >
            {expanded
              ? <IconChevronDownOutline14 />
              : <IconChevronRightOutline14 />}
          </button>
        )}
        {f.kind === 'drafting' && entry !== undefined
          ? <DraftingToolRow label={t(entry.key)} icon={entry.icon} />
          : f.kind === 'running' ? renderMember(f.member.nodeKey) : null}
      </div>
    )
  }

  return (
    <div className={css.slot}>
      <div className={css.stage}>
        {outgoing !== null && (
          <div
            key={`out-${gen}`}
            className={css.layerOutWindow}
            aria-hidden
            {...({ inert: '' } as Record<string, string>)}
          >
            <div className={css.layerOut}>{renderHeaderContent(outgoing)}</div>
          </div>
        )}
        <div key={`in-${gen}`} className={outgoing !== null ? css.layerInWindow : undefined}>
          <div className={outgoing !== null ? css.layerIn : undefined}>{renderHeaderContent(shown)}</div>
        </div>
      </div>
      {expanded && expandable && (
        <div className={css.body}>
          {bodyKeys.map(key => <div key={key}>{renderMember(key)}</div>)}
          {earlierDrafting.map((d) => {
            const e = draftingEntry(d.name)
            return e === undefined ? null : <DraftingToolRow key={`draft:${d.index}`} label={t(e.key)} icon={e.icon} />
          })}
        </div>
      )}
    </div>
  )
})
