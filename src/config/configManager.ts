import * as vscode from 'vscode'

export class ConfigManager {

    private static readonly BASE_URL_KEY = 'apiExplorer.baseUrl'
    private static readonly DEFAULT_URL  = 'http://localhost:8000'

    private _baseUrl: string
    private _context: vscode.ExtensionContext

    // Fires whenever baseUrl changes so other components can react
    private _onDidChangeBaseUrl = new vscode.EventEmitter<string>()
    readonly onDidChangeBaseUrl: vscode.Event<string> = this._onDidChangeBaseUrl.event

    constructor(context: vscode.ExtensionContext) {
        this._context = context

        // workspaceState is scoped to the current workspace folder —
        // so each project on the machine gets its own value
        const saved = context.workspaceState.get<string>(ConfigManager.BASE_URL_KEY)

        // Fall back to the vscode settings value if nothing saved yet,
        // then strip /openapi.json suffix if present to get the base URL
        if (saved) {
            this._baseUrl = saved
        } else {
            const settingsUrl = vscode.workspace
                .getConfiguration('apiExplorer')
                .get<string>('openapiUrl') || ConfigManager.DEFAULT_URL

            this._baseUrl = settingsUrl.replace(/\/openapi\.json$/, '')
        }
    }

    get baseUrl(): string {
        return this._baseUrl
    }

    get openApiUrl(): string {
        return `${this._baseUrl}/openapi.json`
    }

    // Shows a VSCode input box to let the user change the base URL
    // Returns true if they confirmed, false if they cancelled
    async promptChange(): Promise<boolean> {

        const input = await vscode.window.showInputBox({
            title: 'API Explorer — Set Base URL',
            prompt: 'Base URL for this workspace (e.g. http://localhost:8000)',
            value: this._baseUrl,
            validateInput: (value) => {
                if (!value.startsWith('http://') && !value.startsWith('https://')) {
                    return 'URL must start with http:// or https://'
                }
                return null
            }
        })

        if (input === undefined) {
            // User pressed Escape
            return false
        }

        // Strip trailing slash for consistency
        const cleaned = input.replace(/\/$/, '')

        this._baseUrl = cleaned
        await this._context.workspaceState.update(ConfigManager.BASE_URL_KEY, cleaned)
        this._onDidChangeBaseUrl.fire(cleaned)

        return true
    }

    dispose() {
        this._onDidChangeBaseUrl.dispose()
    }
}