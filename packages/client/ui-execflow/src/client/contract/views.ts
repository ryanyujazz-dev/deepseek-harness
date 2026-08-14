/** Shared view tab and selection contracts re-exported for execflow slots. */

/** Tool call identity as carried on the wire. */
export type CallId = string

/** Selection target for the details linkage channel. */
export interface SelectionTarget { turnSeq: number; stepSeq?: number; callId?: CallId; toolName?: string }

/** One conversation view tab. */
export interface ViewTab { id: string; label: string }
