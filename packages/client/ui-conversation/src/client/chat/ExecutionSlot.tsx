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
    default:
      // Unmapped tools (job_output, subagent, workflow, …) degrade to the
      // generic tool phrase; the sparkle leading icon stays.
      return pair('execflow.agg.tools.one', 'execflow.agg.tools')
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

  // The aggregate body is EVERY member in every multi-member form: a running
  // or drafting header only reports the live member, so the body carries all
  // of them (chronological — the live tool naturally reads last, which is the
  // design). Earlier drafting blocks join the drafting header's body.
  const bodyKeys: string[] = useMemo(() => {
    if (form.kind === 'single' || form.kind === 'empty') return []
    return members.map(m => m.nodeKey)
  }, [form, members])
  const earlierDrafting: SlotDrafting[] = form.kind === 'drafting'
    ? drafting.filter(d => d !== form.drafting && draftingEntry(d.name) !== undefined)
    : []
  // Expandable once aggregated content exists: ≥2 members for the settled and
  // live forms; a drafting header ALSO opens when earlier drafting blocks
  // exist with no landed member yet.
  const expandable = form.kind === 'aggregate'
    || (form.kind === 'running' && members.length >= 2)
    || (form.kind === 'drafting' && (members.length >= 1 || earlierDrafting.length > 0))

  // Keep expansion through header swaps (new member replaces the header, the
  // displaced one joins the body); only an empty slot resets.
  useEffect(() => {
    if (form.kind === 'empty') setExpanded(false)
  }, [form.kind])

  if (form.kind === 'empty') return null

  /** One form's header chrome (the stage layers render this for shown/outgoing).
   *  ONE structural wrapper for every form — the member row's position in the
   *  React tree is identical across single/running transitions (stable mount;
   *  the chat-view retention spec is the regression sentinel).
   *
   *  Toggle semantics (aggregated slots): once expandable, the WHOLE header is
   *  the aggregate disclosure — clicks never reach the member row's own
   *  interactions. The interceptor runs in the CAPTURE phase and stops
   *  propagation: the click toggles the body and dies before the row's
   *  expandOnRowClick fires (React's onClick would be too late — the row's
   *  handler runs first on the target). The single form passes the row
   *  through untouched (native interactions, no toggle). */
  const renderHeaderContent = (f: HeaderForm): ReactNode => {
    const intercept = expandable && f.kind !== 'aggregate' && f.kind !== 'single'
    const entry = f.kind === 'drafting' ? draftingEntry(f.drafting.name) : undefined
    const ariaLabel = f.kind === 'running'
      ? t('execflow.slot.toggle', { name: f.member.toolName })
      : t('execflow.slot.toggleDrafting', { label: entry === undefined ? '' : t(entry.key) })
    return (
      <div
        className={css.header}
        {...intercept ? {
          role: 'button',
          tabIndex: 0,
          'aria-expanded': expanded,
          'aria-label': ariaLabel,
        } : {}}
        {...intercept ? {
          onClickCapture: (event: React.MouseEvent) => {
            event.stopPropagation()
            event.preventDefault()
            setExpanded(v => !v)
          },
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.stopPropagation()
              event.preventDefault()
              setExpanded(v => !v)
            }
          },
        } : {}}
      >
        {f.kind === 'aggregate' ? (
          <div
            className={css.aggregate}
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            onClick={() => { setExpanded(v => !v) }}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setExpanded(v => !v) }}
          >
            <span className={css.leading} aria-hidden>
              <span className={css.leadingIcon}>
                {(() => { const last = members[members.length - 1]; return last === undefined ? null : toolIcon(last.toolName) })()}
              </span>
              <span className={css.leadingChevron}>
                {expanded ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />}
              </span>
            </span>
            <span className={css.aggregateText}>{aggregateText(members, t)}</span>
          </div>
        ) : f.kind === 'drafting' && entry !== undefined ? (
          <DraftingToolRow label={t(entry.key)} icon={entry.icon} />
        ) : f.kind === 'running' ? (
          renderMember(f.member.nodeKey)
        ) : f.kind === 'single' && members[0] !== undefined ? (
          renderMember(members[0].nodeKey)
        ) : null}
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
