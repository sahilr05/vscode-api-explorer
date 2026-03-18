/**
 * requestPanel.ts
 * Manages webview panel lifecycle:
 * - Deduplication (one panel per endpoint)
 * - Preview tab behaviour (reuse until user edits)
 * - History panels (each entry gets its own panel)
 *
 * Delegates HTML rendering to webview/template.ts
 * and message handling to requestHandler.ts
 */

import * as vscode        from "vscode"
import { ApiEndpoint }    from "../types/endpoint"
import { ConfigManager }  from "../config/configManager"
import { HistoryManager } from "../history/historyManager"
import { renderPanel, RestoredState } from "./webview/template"
import { attachRequestHandler }       from "./requestHandler"

export class RequestPanel {

    // Permanent panels — keyed by "METHOD:path"
    private static _panels = new Map<string, vscode.WebviewPanel>()

    // Single reusable preview panel
    private static _previewPanel:      vscode.WebviewPanel | undefined
    private static _previewKey:        string              | undefined
    private static _previewDisposable: vscode.Disposable   | undefined

    // Call this when config changes — updates auth badge in all open panels
    public static notifyConfigChanged(auth: import("../config/configManager").AuthConfig) {
        const message = { type: 'configUpdated', auth }
        this._panels.forEach(panel => panel.webview.postMessage(message))
        if (this._previewPanel) this._previewPanel.webview.postMessage(message)
    }

    public static create(
        endpoint:  ApiEndpoint,
        context:   vscode.ExtensionContext,
        config:    ConfigManager,
        history:   HistoryManager,
        restored?: RestoredState,
        panelKey?: string
    ) {
        // History entries — dedicated permanent panel per entry
        if (panelKey) {
            const existing = this._panels.get(panelKey)
            if (existing) { existing.reveal(vscode.ViewColumn.One); return }

            const p = this._newPanel(endpoint, context, config, history, restored)
            this._panels.set(panelKey, p)
            p.onDidDispose(() => this._panels.delete(panelKey))
            return
        }

        const key = `${endpoint.method}:${endpoint.path}`

        // Already a permanent panel — just focus it
        const permanent = this._panels.get(key)
        if (permanent) { permanent.reveal(vscode.ViewColumn.One); return }

        // Reuse preview panel — dispose old handler before swapping
        if (this._previewPanel) {
            this._previewDisposable?.dispose()

            this._previewKey                = key
            this._previewPanel.title        = `${endpoint.method} ${endpoint.path}`
            this._previewPanel.webview.html = renderPanel(endpoint, config.baseUrl, undefined, config.auth)
            this._previewDisposable         = this._attachHandler(
                this._previewPanel, endpoint, config, history, key
            )
            this._previewPanel.reveal(vscode.ViewColumn.One)
            return
        }

        // No preview panel yet — create one
        const panel             = this._newPanel(endpoint, context, config, history, restored)
        this._previewPanel      = panel
        this._previewKey        = key

        panel.onDidDispose(() => {
            if (this._previewPanel === panel) {
                this._previewDisposable?.dispose()
                this._previewDisposable = undefined
                this._previewPanel      = undefined
                this._previewKey        = undefined
            }
        })
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private static _newPanel(
        endpoint:  ApiEndpoint,
        context:   vscode.ExtensionContext,
        config:    ConfigManager,
        history:   HistoryManager,
        restored?: RestoredState
    ): vscode.WebviewPanel {

        const panel = vscode.window.createWebviewPanel(
            "apiExplorerRequest",
            `${endpoint.method} ${endpoint.path}`,
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        )

        panel.webview.html = renderPanel(endpoint, config.baseUrl, restored, config.auth)

        const disposable = this._attachHandler(
            panel, endpoint, config, history,
            `${endpoint.method}:${endpoint.path}`
        )

        this._previewDisposable = disposable
        panel.onDidDispose(() => disposable.dispose())

        return panel
    }

    private static _attachHandler(
        panel:    vscode.WebviewPanel,
        endpoint: ApiEndpoint,
        config:   ConfigManager,
        history:  HistoryManager,
        key:      string
    ): vscode.Disposable {

        return attachRequestHandler(panel, endpoint, config, history, () => {
            if (this._previewPanel === panel) {
                this._panels.set(key, panel)
                this._previewDisposable = undefined
                this._previewPanel      = undefined
                this._previewKey        = undefined
                panel.onDidDispose(() => this._panels.delete(key))
            }
        })
    }
}