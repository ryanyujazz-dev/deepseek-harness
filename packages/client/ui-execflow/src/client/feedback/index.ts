/**
 * Vendored message feedback (Like/Dislike) for the execflow turn tail's
 * assistant-actions strip, retargeted from ui-message-feedback. One
 * MessageFeedbackController per Session backs every message control in that
 * Session; mutations go through the generated messageFeedback Remote.
 */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the generated Remote API and ctx.remote merge through the Client assembly boundary.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the ui-conversation SlotMap merge (the assistant-actions entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { MessageFeedbackController } from './controller.ts'
import { MessageFeedbackActions } from './MessageFeedbackActions.tsx'
import type { MessageFeedbackInjected } from './slots.ts'

export type {
  MessageFeedbackActionResult, MessageFeedbackStatus, MessageFeedbackView, MessageFeedbackRemote,
} from './controller.ts'
export type { MessageFeedbackActionProps, MessageFeedbackInjected } from './slots.ts'
export type { MessageFeedbackKey } from './locales.ts'

/**
 * The feedback sub-plugin: declares the feedback services on its OWN fiber, so
 * a missing `remote.messageFeedback` only stalls this child fiber — the parent
 * execflow plugin and its tab keep loading. cordis enforces `inject` on every
 * nested-service property access (`ctx.remote.messageFeedback`), so the only
 * way to make feedback truly optional is to isolate its inject requirement
 * behind a `ctx.plugin` child fiber rather than the main apply's inject list.
 */
export const execFlowFeedbackPlugin = {
  name: 'execflow-feedback',
  /** Required by THIS fiber only; absent feedback stalls just this child. */
  inject: ['slots', 'remote', 'remote.messageFeedback', 'locale'],
  apply(ctx: Context): void {
    // The `feedback` locale namespace is owned by ui-message-feedback (already
    // in the module table) — do not re-register; the entry reuses it.

    const controllers = new Map<SessionId, MessageFeedbackController>()
    const controllerFor = (sessionId: SessionId): MessageFeedbackController => {
      let controller = controllers.get(sessionId)
      if (controller === undefined) {
        controller = new MessageFeedbackController(ctx.remote.messageFeedback, sessionId)
        controllers.set(sessionId, controller)
      }
      return controller
    }

    // A reconnect can only invalidate what was already read; a cold Session
    // stays cold until something asks for it.
    ctx.on('connection/reset', () => {
      for (const controller of controllers.values()) {
        if (controller.getSnapshot().status !== 'cold') void controller.resync()
      }
    })

    ctx.slots.inject('execflow.chat.assistant-actions', () => {
      const dispose = ctx.slots.register({
        name: 'execflow.chat.assistant-actions',
        id: 'feedback',
        order: 10,
        locale: 'feedback',
        inject: (sessionId): MessageFeedbackInjected => {
          const controller = controllerFor(sessionId)
          return {
            hooks: { feedback: controller },
            ensure: () => controller.ensure(),
            rate: (messageId, rating, note) => controller.rate(messageId, rating, note),
            toggle: (messageId, rating) => controller.toggle(messageId, rating),
            clearNote: messageId => controller.clearNote(messageId),
            clear: messageId => controller.clear(messageId),
          }
        },
      }, MessageFeedbackActions)
      return () => {
        dispose()
        for (const controller of controllers.values()) controller.dispose()
        controllers.clear()
      }
    })
  },
}

/**
 * Mount the feedback sub-plugin on a child fiber. Safe to call regardless of
 * whether the host's feedback plugin is composed in: a missing
 * `remote.messageFeedback` stalls only the child, not the execflow tab.
 * @param ctx - Client root context.
 */
export function registerExecFlowFeedback(ctx: ClientContext): void {
  ctx.plugin(execFlowFeedbackPlugin)
}
