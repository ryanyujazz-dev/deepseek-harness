/**
 * ExecFlow slot declarations: the vendored chat view's own keyed node seat
 * and child holes. Mirrors ui-conversation's chat contracts with the slot
 * keys namespaced under `execflow.` — the official package keeps exclusive
 * declaration rights over `conversation.chat.node`, so this plugin declares
 * its own seat with the same owner/keyProps/hookContext/inject shape and
 * dispatches the same ChatNode payloads through it.
 */
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type {
  PropsLocale, PropsRenderSlots, PropsRuntime, PropsStore, SlotHookFactory,
} from '@deepseek-ai/dsh-client-ui-slots'
import type {
  CommandNode, CompactionSummaryNode, ConversationTurnDataMap,
  ToolCallBlock, TurnLocation,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { MarkdownFileMentions } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ChatNode, ChatNodeKind } from '../chat/chat-nodes.ts'
import type { CallId, SelectionTarget } from './views.ts'
import type { createExecFlowStore } from '../stores.ts'

/** The plugin's per-session store handle (selection + view + inspect + draft). */
export type ExecFlowStore = ReturnType<typeof createExecFlowStore>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * ExecFlow's clone of the chat node seat: same keyed dispatch over
     * `ChatNode.kind`, same owner currency, its own declaration so this
     * plugin can render into it while the official chat view keeps its own.
     */
    'execflow.chat.node': {
      kind: 'keyed'
      scope: 'session'
      owner: ChatNodeOwnerProps
      keyProps: { [Kind in ChatNodeKind]: { node: ChatNode<Kind> } }
      hookContext: string
      inject: ChatNodeTurnDataInjected
    }
    /** ExecFlow's clone of the per-command row hole. */
    'execflow.chat.commandview': { kind: 'keyed'; scope: 'session'; owner: CommandRowOwnerProps }
    /** ExecFlow's clone of the completed-turn extension chain. */
    'execflow.chat.turnTail': { kind: 'chain'; scope: 'session'; owner: TurnTailOwnerProps }
    /** ExecFlow's clone of the per-message assistant action strip. */
    'execflow.chat.assistant-actions': {
      kind: 'list'
      scope: 'session'
      owner: AssistantActionOwnerProps
    }
  }
}

/** Owner currency of the execflow turn-tail hole (same shape as chat's). */
export interface TurnTailOwnerProps {
  /** Engine-owned closing Turn boundary. */
  turn: TurnLocation
  /** The closing assistant's seq — the anchor the tail renders under. */
  seq: number
  /** Open a filesystem path through the Host. */
  openFile: (path: string) => void
}

/** Owner currency of the execflow assistant-message action strip. */
export interface AssistantActionOwnerProps {
  /** Stable identity carried from the `assistant/message` event. */
  messageId: MessageId
}

/** Hook constrained to business data published on the current Chat Node's Turn. */
export type UseChatNodeTurnData = <Key extends Extract<keyof ConversationTurnDataMap, string>>(
  key: Key,
) => Readonly<ConversationTurnDataMap[Key]> | undefined

/** Slot-level Hook factory used by execflow renderers reading their Node's Turn data. */
export interface ChatNodeTurnDataInjected {
  hooks: {
    turnData: SlotHookFactory<'execflow.chat.node', UseChatNodeTurnData>
  }
}

/** Stable owner currency delivered to one keyed ExecFlow business renderer. */
export interface ChatNodeOwnerProps {
  /** Selected Tool call, when the shared details store names one. */
  selectedCallId?: CallId | undefined
  /** Session workspace root; Tool summaries display paths relative to it. */
  cwd?: string | undefined
  openFile: (path: string) => void
  inspectCall: (callId: CallId) => void
  forkAt: (seq: number) => void
  /** Resolve a session-authorized historical image for inline display. */
  loadImage: (attachment: ImageAttachmentRef) => Promise<string>
  fileMentions: (owner: TurnTailOwnerProps) => MarkdownFileMentions | undefined
  /** Active think display form: 'compact' hides reasoning blocks downstream. */
  thinkMode?: 'inline' | 'compact' | undefined
}

/** Full props of one registered keyed ExecFlow business renderer. */
export type ChatNodeViewProps<Kind extends ChatNodeKind = ChatNodeKind> =
  PropsRuntime<'execflow.chat.node', Kind> & PropsLocale<'conversation'>

/** Owner currency of the per-command row slot. */
export interface CommandRowOwnerProps {
  /** Folded command lifecycle node (run + optional done). */
  node: CommandNode
  /** Explicitly linked compaction checkpoint for the settled `/compact` presentation. */
  compaction?: CompactionSummaryNode
}

/** Base props of the execflow view entry. */
export type ConvViewProps = PropsRuntime<'conversation.view'>

/** In-memory reader position resilient to transcript width reflow. */
export interface ChatScrollPosition {
  /** Stable rendered node/call identity nearest the visible reading edge. */
  readonly anchorKey: string
  /** Anchor top relative to the transcript scrollport when saved. */
  readonly anchorTop: number
  /** Approximate offset used before the semantic anchor is measured. */
  readonly scrollTop: number
}

/**
 * Injected share of the execflow view entry (same shape as chat's; the
 * layout orchestration targets stay the shared official services).
 */
export interface ChatViewInjected {
  /** Selection write + details panel opening in one gesture. */
  openDetails: (target: SelectionTarget) => void
  /** Open a tool-arg filesystem path with the host OS default application. */
  openFile: (path: string) => void
  loadOlder: () => void
  /** Resolve a session-authorized historical image for inline display. */
  loadImage: (attachment: ImageAttachmentRef) => Promise<string>
  /** Hand a call off to the trajectory view. */
  inspectCall: (callId: CallId) => void
  /** Per-session scroll memory surviving view switches. */
  chatScroll: {
    save: (position: ChatScrollPosition | null) => void
    read: () => ChatScrollPosition | null
  }
  /** Fork through the completed turn ending at the eligible message `seq`. */
  forkAt: (seq: number) => void
  /** Prose file-mention vocabulary for one closing message. */
  fileMentions: (owner: TurnTailOwnerProps) => MarkdownFileMentions | undefined
}

/** Full execflow-view component props. */
export type ChatViewSlotProps =
  PropsRuntime<'conversation.view'> & PropsRenderSlots<'execflow.chat.node'>
  & PropsStore<ExecFlowStore> & ChatViewInjected & PropsLocale<'conversation'>

/** Owner share of the details panel tool renderer (type parity with chat's). */
export interface DetailsToolOwnerProps {
  block: ToolCallBlock
  cwd?: string | undefined
}

/** Reserved re-export the vendored tool slot references. */
export type { CallId } from './views.ts'
