/**
 * Per-session execflow store: the vendored chat view reads `selection` for
 * tool-call highlight and the tab ring writes `view`/`inspect`. The official
 * chat store stays owned by ui-conversation — this handle is the plugin's own
 * instance with the same shape (persisted under the plugin's own key).
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { CallId, SelectionTarget } from './contract/views.ts'

/** Per-session execflow state (mirrors ChatStoreState). */
export interface ChatStoreState {
  /** Details-linkage channel (execflow writes, details reads). */
  selection: SelectionTarget | null
  /** Composer draft mirror (unused here; kept for shape parity). */
  draft: string
  /** Active conversation view id; null falls back to Chat. */
  view: string | null
  /** One-shot inspect handoff. */
  inspect: { callId: CallId } | null
}

/** Declared action shape used to give the exported factory a stable return type. */
type ChatActions = {
  select: (draft: ChatStoreState, target: SelectionTarget | null) => void
  setDraft: (draft: ChatStoreState, text: string) => void
  setView: (draft: ChatStoreState, view: string) => void
  setInspect: (draft: ChatStoreState, target: { callId: CallId } | null) => void
}

/**
 * Declares the per-session execflow state and write surface.
 * @returns the store handle.
 */
export function createExecFlowStore(): EngineStoreHandle<ChatStoreState, ChatActions> {
  return defineStore({
    init: (): ChatStoreState => ({ selection: null, draft: '', view: null, inspect: null }),
    persist: 'dsh.execflow.view',
    actions: {
      select: (d, target: SelectionTarget | null) => { d.selection = target },
      setDraft: (d, text: string) => { d.draft = text },
      setView: (d, view: string) => { d.view = view },
      setInspect: (d, target: { callId: CallId } | null) => { d.inspect = target },
    },
  })
}
