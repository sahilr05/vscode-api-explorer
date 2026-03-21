/**
 * requestHandler.ts
 * Handles incoming messages from the webview, fires HTTP requests
 * from the extension host, and saves results to history.
 * Also detects auth tokens in responses and prompts user to store them.
 */

import * as vscode              from "vscode"
import { ApiEndpoint }          from "../types/endpoint"
import { ConfigManager }        from "../config/configManager"
import { HistoryManager }       from "../history/historyManager"
import { EndpointTreeProvider } from "../explorer/endpointTreeProvider"
import { AuthStore }            from "../auth/authStore"
import { shouldPromptForToken } from "../auth/authDetector"
import { extractToken }         from "../auth/tokenExtractor"

export function attachRequestHandler(
    panel:           vscode.WebviewPanel,
    endpoint:        ApiEndpoint,
    config:          ConfigManager,
    history:         HistoryManager,
    treeProvider:    EndpointTreeProvider,
    authStore:       AuthStore,
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

        if (message.type === "useAsAuth") {
            await config.saveProjectConfig({
                ...config.projectConfig,
                auth: { type: 'bearer', token: message.token }
            })

            await authStore.save({
                token:        message.token,
                expiresAt:    undefined,
                endpointKey,
                endpointPath: endpoint.path,
                storedAt:     Date.now(),
            })
            treeProvider.setAuthEndpoint(endpointKey)
            vscode.window.showInformationMessage(
                'API Explorer: Token set. Attached to all requests automatically.'
            )
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

            // Merge default headers + auth (manual config or auto-extracted token)
            const activeToken   = await authStore.getActiveToken()
            const authOverrides: Record<string, string> = activeToken && !isTokenExpired(activeToken)
                ? { 'Authorization': `Bearer ${activeToken.token}` }
                : {}

            const headers = config.buildRequestHeaders({
                ...(body ? { 'Content-Type': 'application/json' } : {}),
                ...authOverrides,
            })

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

                // ── Auth token detection ──────────────────────────────────────
                // Only check on 2xx responses, only if not already ignored
                if (
                    response.status >= 200 &&
                    response.status < 300 &&
                    !authStore.isIgnored(endpointKey) &&
                    !authStore.isAuthEndpoint(endpointKey) &&
                    shouldPromptForToken(endpoint, responseData)
                ) {
                    const extracted = extractToken(responseData)
                    if (extracted) {
                        promptToStoreToken(
                            endpoint, endpointKey, extracted, authStore, treeProvider, config
                        )
                    }
                }

            } catch (err: any) {
                panel.webview.postMessage({ type: "error", message: err.message })
            }
        }
    })
}

function isTokenExpired(token: { expiresAt?: number }): boolean {
    return !!token.expiresAt && token.expiresAt <= Date.now()
}

async function promptToStoreToken(
    endpoint:     ApiEndpoint,
    endpointKey:  string,
    extracted:    { token: string; expiresAt: number | undefined },
    authStore:    AuthStore,
    treeProvider: EndpointTreeProvider,
    config:       ConfigManager
): Promise<void> {

    const preview = extracted.token.length > 20
        ? `${extracted.token.slice(0, 20)}…`
        : extracted.token

    const action = await vscode.window.showInformationMessage(
        `API Explorer detected an auth token in ${endpoint.method} ${endpoint.path}. Use it for all requests?`,
        'Use Token',
        'Ignore',
        "Don't ask again"
    )

    if (action === 'Use Token') {
        await authStore.save({
            token:        extracted.token,
            expiresAt:    extracted.expiresAt,
            endpointKey,
            endpointPath: endpoint.path,
            storedAt:     Date.now(),
        })

        // Sync to configManager so badge + config panel update immediately
        await config.saveProjectConfig({
            ...config.projectConfig,
            auth: {
                type:  'bearer',
                token: extracted.token,
            }
        })

        // Update tree to show key icon on this endpoint
        treeProvider.setAuthEndpoint(endpointKey)

        const expiry = extracted.expiresAt
            ? ` (expires in ${Math.round((extracted.expiresAt - Date.now()) / 60000)}m)`
            : ''
        vscode.window.showInformationMessage(
            `API Explorer: Token stored${expiry}. Attached to all requests automatically.`
        )
    } else if (action === "Don't ask again") {
        await authStore.ignore(endpointKey)
    }
}