import type { Context } from '@deepseek-ai/cordis'
// The vendored renderers keep the official conversation copy: the locale
// seat is shared vocabulary, so NS points at the conversation namespace.
const NS = 'conversation'
import { AssistantNodeView } from './AssistantNodeView.tsx'
import { CommandNodeView, ManualCompactionNodeView } from './CommandNodeView.tsx'
import {
  CompactionNodeView, ContextMessageNodeView, RetryNodeView, TurnErrorNodeView,
  TurnMaxTokensNodeView, UnknownNodeView, UserMessageNodeView,
} from './MessageItem.tsx'
import { TurnTailNodeView } from './TurnTailNodeView.tsx'

/**
 * Register this package's business renderers behind the keyed Chat Node seat.
 * @param ctx - owning UI Conversation context.
 */
export function registerChatNodeRenderers(ctx: Context): void {
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register(
    { name: 'execflow.chat.node', key: 'user', locale: NS }, UserMessageNodeView))
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register(
    { name: 'execflow.chat.node', key: 'steering', locale: NS }, UserMessageNodeView))
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register(
    { name: 'execflow.chat.node', key: 'context', locale: NS }, ContextMessageNodeView))
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register(
    { name: 'execflow.chat.node', key: 'assistant-step', locale: NS }, AssistantNodeView))
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register({
    name: 'execflow.chat.node',
    key: 'command',
    locale: NS,
    children: { 'execflow.chat.commandview': { kind: 'keyed', scope: 'session' } },
  }, CommandNodeView))
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register(
    { name: 'execflow.chat.node', key: 'manual-compaction', locale: NS }, ManualCompactionNodeView))
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register(
    { name: 'execflow.chat.node', key: 'compaction', locale: NS }, CompactionNodeView))
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register(
    { name: 'execflow.chat.node', key: 'model-retry', locale: NS }, RetryNodeView))
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register(
    { name: 'execflow.chat.node', key: 'turn-error', locale: NS }, TurnErrorNodeView))
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register(
    { name: 'execflow.chat.node', key: 'turn-max-tokens', locale: NS }, TurnMaxTokensNodeView))
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register({
    name: 'execflow.chat.node',
    key: 'turn-tail',
    locale: NS,
    children: {
      'execflow.chat.turnTail': { kind: 'chain', scope: 'session' },
      'execflow.chat.assistant-actions': { kind: 'list', scope: 'session' },
    },
  }, TurnTailNodeView))
  ctx.slots.inject('execflow.chat.node', () => ctx.slots.register(
    { name: 'execflow.chat.node', key: 'unknown', locale: NS }, UnknownNodeView))
}
