declare function seAlert(msg: string): void
declare function seConfirm(msg: string, choices?: string[]): Promise<string>
declare function seSelect(msg: string, choices: string[]): Promise<string>
declare function sePrompt(msg: string, defaultValue?: string): Promise<string | null>
declare function seForeignHtml(initialHtml?: string): Promise<string | null>
