/**
 * requestHandler.ts
 * Handles incoming messages from the webview, fires HTTP requests
 * from the extension host, and saves results to history.
 *
 * Returns a Disposable so the caller can remove the listener
 * before attaching a new one — prevents duplicate requests.
 */

import * as vscode        from "vscode"
import { ApiEndpoint }    from "../types/endpoint"
import { ConfigManager }  from "../config/configManager"
import { HistoryManager } from "../history/historyManager"
import { EndpointTreeProvider } from "../explorer/endpointTreeProvider"

export function attachRequestHandler(
    panel:           vscode.WebviewPanel,
    endpoint:        ApiEndpoint,
    config:          ConfigManager,
    history:         HistoryManager,
    treeProvider:    EndpointTreeProvider,
    onMarkPermanent: () => void
): vscode.Disposable {

    const endpointKey = `${endpoint.method}:${endpoint.path}`

    return panel.webview.onDidReceiveMessage(async (message) => {

        if (message.type === "markPermanent") {
            onMarkPermanent()
            return
        }

        if (message.type === "openConfig") {
            vscode.commands.executeCommand('apiExplorer.openConfig')
            return
        }

        if (message.type === "openInEditor") {
            const { content } = message
            const doc = await vscode.workspace.openTextDocument({
                content,
                language: 'json',
            })
            await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preview:    false,
            })
            return
        }

        if (message.type === "sendRequest") {
            const { url, method, body } = message

            // Merge default headers + auth from project config
            // Request-level Content-Type is passed as override
            const headers = config.buildRequestHeaders(
                body ? { 'Content-Type': 'application/json' } : {}
            )

            try {
                const startTime = Date.now()
                const response  = await fetch(url, {
                    method,
                    headers,
                    body: body || undefined,
                })
                const elapsed = Date.now() - startTime
                const text    = await response.text()

                let responseData: any
                try   { responseData = JSON.parse(text) }
                catch { responseData = text }

                panel.webview.postMessage({
                    type:       "response",
                    status:     response.status,
                    statusText: response.statusText,
                    elapsed,
                    data:       responseData,
                })

                // Update sidebar error state
                if (response.status >= 500) {
                    treeProvider.setEndpointError(endpointKey, response.status)
                } else {
                    treeProvider.clearEndpointError(endpointKey)
                }

                history.add({
                    method,
                    path:         endpoint.path,
                    url,
                    status:       response.status,
                    statusText:   response.statusText,
                    elapsed,
                    timestamp:    Date.now(),
                    body:         body   || undefined,
                    responseBody: typeof responseData === "string"
                                    ? responseData
                                    : JSON.stringify(responseData, null, 2),
                })

            } catch (err: any) {
                panel.webview.postMessage({ type: "error", message: err.message })
            }
        }
    })
}