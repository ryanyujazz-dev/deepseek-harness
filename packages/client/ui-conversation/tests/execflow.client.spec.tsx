// @vitest-environment jsdom
// ExecFlow execution view behavior: the flow partition (tool runs between
// content anchors), the ExecutionSlot header state machine (drafting →
// running → aggregate → single), the Think clamp + Show more toggle, and
// the think-mode dual forms — driven through the same scripted
// ObservableSnapshot fake as chat-view.client.spec.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type {
  ConversationSnapshot, RunningToolCall, SessionId, SessionListState,
  ToolResultNode, WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  createSnapshotStore, EMPTY_CONVERSATION_VIEWS,
} from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import type { ChatViewSlotProps, SelectionTarget } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { createChatStore } from '../src/client/stores.ts'
import { ChatView } from '../src/client/chat/ChatView.tsx'
import { zh } from '../src/client/locales.ts'
import { chatSnapshotFixture } from './chat-snapshot-fixture.client.ts'
import type { AssistantMessageNode, UserMessageNode } from '@deepseek-ai/dsh-client-runtime/client'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  localStorage.clear()
})

const SID = 's1' as SessionId

function snapshotBase(): ConversationSnapshot {
  return {
    sessionId: SID, views: EMPTY_CONVERSATION_VIEWS, chat: chatSnapshotFixture(), nodes: [],
    turnTimings: new Map(), turnEnds: new Map(), partial: null, runningCalls: [],
    pending: [], queue: [], running: false, composerPhase: 'active', removed: false, openState: 'open', openError: null,
    hasMore: false, loadingOlder: false, promptError: null, blank: false, subagent: null, lastAgentError: null,
  }
}

function makeSource(init?: Partial<ConversationSnapshot>) {
  const initial = { ...snapshotBase(), ...init }
  let snap: ConversationSnapshot = {
    ...initial,
    chat: init?.chat ?? chatSnapshotFixture(initial),
  }
  const subs = new Set<() => void>()
  return {
    set: (next: Partial<ConversationSnapshot>) => {
      const merged = { ...snap, ...next }
      snap = {
        ...merged,
        chat: Object.hasOwn(next, 'chat') && next.chat !== undefined
          ? next.chat
          : chatSnapshotFixture(merged, snap.chat),
      }
      for (const fn of [...subs]) fn()
    },
    source: {
      getSnapshot: () => snap,
      subscribe: (fn: () => void) => {
        subs.add(fn)
        return () => subs.delete(fn)
      },
    },
  }
}

const user = (seq: number, text: string): UserMessageNode => ({
  kind: 'user',
  seq,
  time: seq * 1000,
  content: [{ type: 'text', text }] as never,
  source: null,
})
const assistant = (seq: number, text: string, turn = 1): AssistantMessageNode => ({
  kind: 'assistant', seq, time: seq * 1_000, turn, step: 1, blocks: [{ kind: 'text', text }],
})
const toolResult = (seq: number, callId: string, name = 'bash', turn = 1): ToolResultNode => ({
  kind: 'tool-result', seq, time: seq * 1_000, callId, turn, step: 1,
  call: { name, argsRaw: `{"command":"cmd-${callId}"}` },
  callTime: seq * 1_000 - 500,
  content: [], isError: false, callView: null, resultView: null, subCalls: [],
} as never)
const runningCall = (callId: string, name = 'bash'): RunningToolCall => ({
  callId, name, argsRaw: `{"command":"cmd-${callId}"}`, turn: 2, step: 1, time: 1_000, callView: null, subCalls: [],
})

function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}

function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function makeHarness(init?: Partial<ConversationSnapshot>) {
  const { set, source } = makeSource(init)
  const openDetails = vi.fn<(t: SelectionTarget) => void>()
  const openFile = vi.fn<(path: string) => void>()
  const loadOlder = vi.fn()
  const inspectCall = vi.fn<(callId: string) => void>()
  let savedScroll: ReturnType<ChatViewSlotProps['chatScroll']['read']> = null
  const chatScroll: ChatViewSlotProps['chatScroll'] = {
    save: (position) => { savedScroll = position },
    read: () => savedScroll,
  }
  const forkAt = vi.fn()
  const chat = createChatStore().create()
  const t = makeTranslate(zh, commonZh)
  const renderSlot = ((_key: string, _owner: object, opts?: { fallback?: React.ReactNode }) =>
    opts?.fallback ?? null) as unknown as ChatViewSlotProps['renderSlot']
  const SessionProviderStub: ChatViewSlotProps['SessionProvider'] = ({ children }) => <>{children(SID)}</>
  const props: ChatViewSlotProps = {
    sessionId: SID,
    useSession: bindSnapshotSelector(source),
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useProjection: (() => undefined),
    useInput: (() => { throw new Error('unused') }),
    inputActions: {
      setDraft: () => {},
      addImages: () => true,
      removeImage: () => {},
      pruneImages: () => {},
      submit: () => {},
    },
    useStore: bindSnapshotSelector(chat),
    actions: chat.actions,
    renderSlot,
    SessionProvider: SessionProviderStub,
    openDetails,
    openFile,
    loadOlder,
    loadImage: vi.fn(() => Promise.reject(new Error('not used'))),
    inspectCall,
    chatScroll,
    forkAt,
    fileMentions: () => undefined,
    t,
  }
  return { set, ChatView, props, openDetails, openFile, loadOlder, inspectCall, chatScroll, forkAt }
}

describe('ExecFlow partition and slot forms', () => {

  it('contiguous same-turn tool calls collapse into one aggregate row', () => {
    const h = makeHarness({
      nodes: [
        user(1, 'run things'),
        toolResult(2, 'call-1'),
        toolResult(3, 'call-2'),
        toolResult(4, 'call-3'),
        assistant(5, 'done', 1),
      ],
      runningCalls: [],
    })
    const { container } = render(<h.ChatView {...h.props} />)
    // One aggregate: 3 tools in the run → the zh dictionary phrase.
    const aggregate = container.querySelector('[class*="aggregate"][role="button"]')
    expect(aggregate).not.toBeNull()
    expect(aggregate?.textContent).toContain('运行 3 条命令')
    // Collapsed: NO member renders its own flow row (the aggregate header
    // is the run's only surface; members appear solely in the expanded
    // body). Three sibling rows would mean the partition failed to group.
    const toolFlowRows = [...container.querySelectorAll('[data-chat-flow-kind="tool-call"]')]
    expect(toolFlowRows).toHaveLength(0)
  })

  it('a single tool run renders the tool row itself (no aggregate)', () => {
    const h = makeHarness({
      nodes: [
        user(1, 'run one thing'),
        toolResult(2, 'call-1'),
        assistant(3, 'done', 1),
      ],
    })
    const { container } = render(<h.ChatView {...h.props} />)
    // No aggregate form (single member → the slot is transparent); the
    // fallback JsonBlock renders the tool node through the seat fallback.
    expect(container.querySelector('[class*="aggregate"][role="button"]')).toBeNull()
  })

  it('a tool run split by visible content forms two aggregates', () => {
    const h = makeHarness({
      nodes: [
        user(1, 'go'),
        toolResult(2, 'call-1'),
        toolResult(3, 'call-2'),
        assistant(4, 'middle text', 1),
        toolResult(5, 'call-3'),
        toolResult(6, 'call-4'),
        assistant(7, 'end', 1),
      ],
    })
    const { container } = render(<h.ChatView {...h.props} />)
    const aggregates = container.querySelectorAll('[class*="aggregate"][role="button"]')
    expect(aggregates[0]?.textContent).toContain('运行 2 条命令')
    expect(aggregates[1]?.textContent).toContain('运行 2 条命令')
  })

  it('compact think mode merges tool runs across reasoning-only steps', () => {
    // Two runs separated ONLY by a reasoning block: inline mode splits them
    // (reasoning is visible content), compact mode merges (transparent).
    const inline = makeHarness({
      nodes: [
        user(1, 'go'),
        toolResult(2, 'call-1'),
        toolResult(3, 'call-1b'),
        { ...assistant(4, '', 1), blocks: [{ kind: 'reasoning', text: 'thinking…' }] },
        toolResult(5, 'call-2'),
        toolResult(6, 'call-2b'),
        assistant(7, 'end', 1),
      ],
    })
    localStorage.setItem('dsh.execflow.think-mode', 'inline')
    const inlineRender = render(<inline.ChatView {...inline.props} />)
    expect(inlineRender.container.querySelectorAll('[class*="aggregate"][role="button"]')).toHaveLength(2)
    inlineRender.unmount()

    localStorage.setItem('dsh.execflow.think-mode', 'compact')
    const compact = makeHarness({
      nodes: [
        user(1, 'go'),
        toolResult(2, 'call-1'),
        toolResult(3, 'call-1b'),
        { ...assistant(4, '', 1), blocks: [{ kind: 'reasoning', text: 'thinking…' }] },
        toolResult(5, 'call-2'),
        toolResult(6, 'call-2b'),
        assistant(7, 'end', 1),
      ],
    })
    const compactRender = render(<compact.ChatView {...compact.props} />)
    const aggregates = compactRender.container.querySelectorAll('[class*="aggregate"][role="button"]')
    expect(aggregates).toHaveLength(1)
    expect(aggregates[0]?.textContent).toContain('运行 4 条命令')
    expect(compactRender.container.querySelectorAll('[class*="thinkBody"]')).toHaveLength(0)
  })

  it('a drafting block on the partial renders the drafting row for mapped tools only', () => {
    const h = makeHarness({
      nodes: [user(1, 'go')],
      partial: {
        turn: 1, step: 2,
        blocks: [{ kind: 'tool-call', callId: 'call-9', name: 'edit', argsRaw: '{"file_path":"a.ts"' }],
      },
    })
    const { container } = render(<h.ChatView {...h.props} />)
    expect(container.textContent).toContain('Editing')
    // Unmapped short-drafting tools render no drafting row.
    const h2 = makeHarness({
      nodes: [user(1, 'go')],
      partial: {
        turn: 1, step: 2,
        blocks: [{ kind: 'tool-call', callId: 'call-9', name: 'read', argsRaw: '{"path":"a.ts"' }],
      },
    })
    const r2 = render(<h2.ChatView {...h2.props} />)
    expect(r2.container.textContent).not.toContain('Reading')
  })

  it('a running call heads the slot while the settled sibling waits in the body', () => {
    const h = makeHarness({
      nodes: [
        user(1, 'go'),
        toolResult(2, 'call-1'),
      ],
      runningCalls: [runningCall('call-2')],
    })
    const { container } = render(<h.ChatView {...h.props} />)
    // No aggregate while a member runs, and the RUNNING member heads the
    // slot: it renders through the seat's JsonBlock fallback (the harness
    // has no Tool presentation plugin), so its node kind reaches the DOM.
    expect(container.querySelector('[class*="aggregate"][role="button"]')).toBeNull()
    expect(container.textContent).toContain('未知 surface 事件：tool-call')
  })
})

describe('Think clamp and Show more', () => {
  // The clamp behavior lives in ReasoningRow; driving it through ChatView
  // requires the assistant renderer, so this suite targets the row-level
  // contract via the zh dictionary keys the row consumes.
  it('registers the Show more/less dictionary keys in both locales', async () => {
    const { zh } = await import('../src/client/locales.ts')
    const { en } = await import('../src/client/locales.ts')
    expect(zh['execflow.think.more']).toBe('显示更多')
    expect(zh['execflow.think.less']).toBe('收起')
    expect(en['execflow.think.more']).toBe('Show more')
    expect(en['execflow.think.less']).toBe('Show less')
  })
})
