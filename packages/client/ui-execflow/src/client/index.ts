/**
 * Browser execflow plugin: a full clone of the official Chat view under its
 * own tab. The data plane is shared — the official conversation Definitions
 * and the runtime's assembled `snapshot.chat` — while the render plane is
 * vendored (chat/ + tool/) and re-keyed onto the plugin's own slots
 * (`execflow.chat.node`, `execflow.tool.call.toolview`, …), so this tab can
 * drift stylistically without touching the shipped Chat tab.
 */
// Type-only: the runtime's snapshot/Context merges the vendored code reads.
import type {} from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: the conversation package's Context merges (ctx.conversation) and
// the ChatNodeDataMap/Snapshot merges its node files re-export. The kinds the
// vendored renderers dispatch on are compile-time facts; the runtime module
// table already serves the official plugin's live registrations.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the layout plugin's Context merge (ctx.layout).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { resolveWorkspacePath } from '@deepseek-ai/dsh-client-runtime/client'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import { registerChatNodeRenderers } from './chat/register-node-renderers.ts'
import { ChatView } from './chat/ChatView.tsx'
import type { ChatViewInjected } from './contract/execflow-slots.ts'
import { ToolCallTree } from './tool/ToolCallTree.tsx'
import { CONVERSATION_NS as TOOL_NS } from './tool/locale.ts'
import { createExecFlowStore } from './stores.ts'
import { registerExecFlowToolviews } from './tool/register-toolviews.ts'
import { registerExecFlowFeedback } from './feedback/index.ts'
import type { ChatNodeTurnDataInjected } from './contract/execflow-slots.ts'

/** The conversation service's concrete type carries resolveImage (not on IConversation). */
interface ConversationWithImages {
  resolveImage(sessionId: SessionId, attachment: import('@deepseek-ai/dsh-attachment').ImageAttachmentRef): Promise<string>
}

/** Required services: the conversation slot tree, registries, paging, locale, workspaces, layout.
 * `remote`/`remote.messageFeedback` are intentionally absent — feedback is an
 * optional service resolved at apply time (see registerExecFlowFeedback), so
 * the plugin loads even when the host's feedback plugin is not composed in. */
export const inject = [
  'slots', 'layout', 'sessions', 'workspaces', 'locale', 'conversationEvents',
]

/** Turn-data hook factory for the execflow node seat (mirrors chat's). */
const CHAT_NODE_INJECT: ChatNodeTurnDataInjected = {
  hooks: {
    turnData: ({ useSession }, nodeKey) => function useTurnData(key) {
      return useSession((snapshot) => {
        const location = snapshot.chat.nodes.get(nodeKey)?.location
        return location?.kind === 'turn' || location?.kind === 'step'
          ? location.turn.data.get(key)
          : undefined
      })
    },
  },
}

/**
 * Client plugin body: register the vendored renderers behind this plugin's
 * own slots, then the execflow view tab carrying the vendored ChatView.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  const sessions = ctx.sessions
  const workspaces = ctx.workspaces
  const layout = ctx.layout
  const slots = ctx.slots

  // The vendored keyed renderers behind this plugin's node seat.
  registerChatNodeRenderers(ctx)
  registerExecFlowToolviews(ctx)
  // The vendored Like/Dislike entry behind the turn tail's assistant-actions seat.
  registerExecFlowFeedback(ctx)
  // The tool-call tree renderer (vendored ui-tool root) behind the same seat.
  slots.inject('execflow.chat.node', () => slots.register({
    name: 'execflow.chat.node',
    key: 'tool-call',
    locale: TOOL_NS,
    children: {
      'execflow.tool.call.toolview': { kind: 'keyed', scope: 'session' },
    },
  }, ToolCallTree))

  const execFlowStore = createExecFlowStore()

  // ExecFlow semantic reader positions by session, surviving view switches.
  const chatScrollPositions = new Map<SessionId, { anchorKey: string; anchorTop: number; scrollTop: number }>()

  slots.inject('conversation.view', () => slots.register({
    name: 'conversation.view',
    id: 'execflow',
    order: 5,
    // Declared under the conversation locale so the entry's `t` seat matches
    // the vendored ChatView's PropsLocale<'conversation'>. The tab label is a
    // plain string thunk (SlotLabel), so it needs no dictionary key.
    locale: 'conversation',
    label: '执行流',
    children: {
      'execflow.chat.node': { kind: 'keyed', scope: 'session', inject: CHAT_NODE_INJECT },
    },
    store: execFlowStore,
    inject: (sessionId: SessionId, actions: BoundActions<typeof execFlowStore>): ChatViewInjected => ({
      openDetails: (target) => {
        actions.select(target)
        layout.openDetails()
      },
      openFile: (path) => {
        const cwd = sessions.list.getSnapshot().byId[sessionId]?.cwd
        void workspaces.openPath(resolveWorkspacePath(cwd, path)).catch(() => {
          // Open failures stay silent in the row.
        })
      },
      loadOlder: () => {
        const binding = sessions.binding(sessionId)?.session
        if (binding !== undefined) void binding.loadOlder()
      },
      loadImage: (attachment) => {
        const conversation = ctx.get('conversation') as (ConversationWithImages | undefined)
        if (conversation === undefined || typeof conversation.resolveImage !== 'function') {
          return Promise.reject(new Error('ui-execflow: conversation service unavailable'))
        }
        return conversation.resolveImage(sessionId, attachment)
      },
      inspectCall: (callId) => {
        // The view ring reads the OFFICIAL chat store (ui-conversation's
        // per-session instance), which this plugin cannot write from outside;
        // writing our own store would be a silent no-op. The jump therefore
        // drives the ring the way a user does: a real click on the official
        // "轨迹" tab (BoundActions.setView through the header's own handler),
        // which works identically on stock dsh. The call-focus handoff the
        // official chat tab enjoys (setInspect) is not reachable without an
        // upstream API; the trajectory opens without the pre-selected call.
        actions.setInspect({ callId })
        const tabs = [...document.querySelectorAll('[role="tab"]')]
        const trajectoryTab = tabs.find(tab => (tab.textContent || '').trim() === '轨迹')
        if (trajectoryTab instanceof HTMLElement) trajectoryTab.click()
      },
      chatScroll: {
        save: (position) => {
          if (position === null) chatScrollPositions.delete(sessionId)
          else chatScrollPositions.set(sessionId, position)
        },
        read: () => chatScrollPositions.get(sessionId) ?? null,
      },
      forkAt: (seq) => {
        sessions.fork({ sessionId, atSeq: seq, increaseTitle: true })
          .then((childId) => { sessions.open(childId) })
          .catch(() => {
            // Fork failure keeps the source view untouched.
          })
      },
      fileMentions: owner => ctx.get('chatFileMentions')?.forClosing(owner),
    }),
  }, ChatView))
}
