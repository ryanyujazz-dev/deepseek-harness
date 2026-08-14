/**
 * Register the vendored atomic Tool views behind this plugin's
 * execflow.tool.call.toolview seat (mirrors ui-tool's apply).
 */
import type { Context } from '@deepseek-ai/cordis'
import { askQuestionToolview } from './toolviews/ask-question-row.tsx'
import { bashToolviewSample } from './toolviews/bash-sample.tsx'
import { fileMutationToolview } from './toolviews/file-mutation-row.tsx'
import { readToolview } from './toolviews/read-row.tsx'
import { searchToolview } from './toolviews/search-row.tsx'
import { todoToolview } from './toolviews/todo-row.tsx'
import { webToolview } from './toolviews/web-row.tsx'

/**
 * Mount the vendored atomic Tool registrations.
 *
 * @param ctx - client root context.
 */
export function registerExecFlowToolviews(ctx: Context): void {
  ctx.plugin(bashToolviewSample)
  ctx.plugin(readToolview)
  ctx.plugin(fileMutationToolview)
  ctx.plugin(searchToolview)
  ctx.plugin(webToolview)
  ctx.plugin(todoToolview)
  ctx.plugin(askQuestionToolview)
}
