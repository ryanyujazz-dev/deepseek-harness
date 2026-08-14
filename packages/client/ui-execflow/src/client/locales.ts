/** `execflow` namespace: this plugin's own view-tab label. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'execflow'

/** The execflow dictionary key set (the source of truth for both locales). */
export type ExecFlowKey =
  | 'view.execflow'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The execflow view tab label. */
    'execflow': ExecFlowKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<ExecFlowKey, string> = {
  'view.execflow': '执行流',
}

/** English dictionary. */
export const en: Record<ExecFlowKey, string> = {
  'view.execflow': 'ExecFlow',
}
