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

export function attachRequestHandler(
    panel:           vscode.WebviewPanel,
    endpoint:        ApiEndpoint,
    config:          ConfigManager,
    history:         HistoryManager,
    onMarkPermanent: () => void
): vscode.Disposable {

    return panel.webview.onDidReceiveMessage(async (message) => {

        if (message.type === "markPermanent") {
            onMarkPermanent()
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