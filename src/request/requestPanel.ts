/**
 * requestPanel.ts
 *
 * Each endpoint gets its own tab in ViewColumn.Two (the API Explorer pane).
 * - Click endpoint → open its tab (or create if not open)
 * - Same endpoint clicked again → reveal existing tab
 * - Tabs stay open until manually closed
 * History entries get their own dedicated tabs keyed by entry id.
 */

import * as vscode        from "vscode"
import { ApiEndpoint }    from "../types/endpoint"
import { ConfigManager }  from "../config/configManager"
import { HistoryManager } from "../history/historyManager"
import { renderPanel, RestoredState } from "./webview/template"
import { attachRequestHandler }       from "./requestHandler"

export class RequestPanel {

    // All open endpoint panels — keyed by "METHOD:path"
    private static _panels      = new Map<string, vscode.WebviewPanel>()
    private static _disposables = new Map<string, vscode.Disposable>()

    // History panels — keyed by entry id
    private static _historyPanels = new Map<string, vscode.WebviewPanel>()

    // Broadcast auth badge update to all open panels
    public static notifyConfigChanged(auth: import("../config/configManager").AuthConfig) {
        const msg = { type: 'configUpdated', auth }
        this._panels.forEach(p => p.webview.postMessage(msg))
        this._historyPanels.forEach(p => p.webview.postMessage(msg))
    }

    public static create(
        endpoint:  ApiEndpoint,
        context:   vscode.ExtensionContext,
        config:    ConfigManager,
        history:   HistoryManager,
        restored?: RestoredState,
        panelKey?: string
    ) {
        // History entries — dedicated tab per entry
        if (panelKey) {
            const existing = this._historyPanels.get(panelKey)
            if (existing) { existing.reveal(vscode.ViewColumn.Two); return }

            const p = this._makePanel(panelKey, endpoint, config, history, restored, true)
            this._historyPanels.set(panelKey, p)
            p.onDidDispose(() => this._historyPanels.delete(panelKey))
            return
        }

        const key = `${endpoint.method}:${endpoint.path}`

        // Already open — just reveal it (dirty or pristine, doesn't matter)
        const existing = this._panels.get(key)
        if (existing) {
            existing.reveal(vscode.ViewColumn.Two)
            return
        }

        // New endpoint — open a new tab in column two
        const panel = this._makePanel(key, endpoint, config, history, restored, false)
        this._panels.set(key, panel)
        panel.onDidDispose(() => {
            this._panels.delete(key)
            this._disposables.get(key)?.dispose()
            this._disposables.delete(key)
        })
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private static _makePanel(
        key:       string,
        endpoint:  ApiEndpoint,
        config:    ConfigManager,
        history:   HistoryManager,
        restored?: RestoredState,
        isHistory: boolean = false
    ): vscode.WebviewPanel {

        const panel = vscode.window.createWebviewPanel(
            "apiExplorerRequest",
            `${endpoint.method} ${endpoint.path}`,
            vscode.ViewColumn.Two,
            { enableScripts: true, retainContextWhenHidden: true }
        )

        panel.webview.html = renderPanel(endpoint, config.baseUrl, restored, config.auth)

        const disposable = attachRequestHandler(panel, endpoint, config, history, () => {})
        this._disposables.set(key, disposable)
        panel.onDidDispose(() => disposable.dispose())

        return panel
    }
}