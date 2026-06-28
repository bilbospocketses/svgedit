type ExtInit = (...args: unknown[]) => unknown

export type AddExtensionFn = (
  name: string,
  initfn: ExtInit | false | undefined,
  initArgs: Record<string, unknown>
) => Promise<void>

/**
 * Register one extension with its failure isolated. A rejecting init() (or any
 * addExtension error) is logged and swallowed so it cannot abort the load of
 * sibling extensions or the post-load extensions_added wiring in
 * extAndLocaleFunc (#36 F3). Resolves regardless of outcome.
 */
export async function loadExtension (
  addExtension: AddExtensionFn,
  name: string,
  initfn: ExtInit | false | undefined,
  initArgs: Record<string, unknown>,
  label: string
): Promise<void> {
  try {
    await addExtension(name, initfn, initArgs)
  } catch (err) {
    console.error('Extension failed to load: ' + label + '; ', err)
  }
}
