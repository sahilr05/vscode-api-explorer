/**
 * executeRequest.ts
 * Host-side request firing - shared by the request panel handler and "Run all".
 *
 * Keeps the fetch + auth-attach + parse logic in one place (no webview involved),
 * so cases can be replayed headlessly. Intentionally pure: it does NOT prompt,
 * write history, or detect tokens - callers layer that on as needed.
 */

import { ApiEndpoint }   from "../types/endpoint"
import { ConfigManager } from "../config/configManager"
import { AuthStore }     from "../auth/authStore"
import { TestCase }      from "../cases/casesStore"
import { getRequestContentType } from "../openapi/schemaResolver"

export interface PreparedRequest {
    method:      string
    url:         string
    body?:       string
    contentType: string
}

export interface ExecResult {
    status:     number
    statusText: string
    elapsed:    number
    data:       any
}

/**
 * Assembles a concrete request from an endpoint + a saved case.
 * Mirrors the browser-side assembly in clientScript.ts, including the
 * JSON→form-urlencoded conversion (empty fields dropped) for form bodies.
 */
export function buildRequestFromCase(
    endpoint: ApiEndpoint,
    testCase: TestCase,
    baseUrl:  string
): PreparedRequest {

    const method = endpoint.method

    // Substitute path params
    let path = endpoint.path
    for (const [k, v] of Object.entries(testCase.pathParams ?? {})) {
        path = path.replace(`{${k}}`, encodeURIComponent(v))
    }

    // Build query string (skip empties)
    const qp = Object.entries(testCase.queryParams ?? {})
        .filter(([, v]) => v !== "" && v != null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)

    const url = baseUrl.replace(/\/$/, "") + path + (qp.length ? `?${qp.join("&")}` : "")

    const hasBody     = ["POST", "PUT", "PATCH"].includes(method)
    const contentType = (hasBody && getRequestContentType(endpoint.requestBody)) || "application/json"
    const isForm      = contentType.includes("form-urlencoded") || contentType.includes("form-data")

    let body: string | undefined
    if (hasBody && testCase.body) {
        if (isForm) {
            try {
                const obj    = JSON.parse(testCase.body || "{}")
                const params = new URLSearchParams()
                for (const [k, v] of Object.entries(obj)) {
                    if (v !== "" && v != null) params.append(k, String(v))
                }
                body = params.toString()
            } catch {
                body = testCase.body
            }
        } else {
            body = testCase.body
        }
    }

    return { method, url, body, contentType }
}

/**
 * Fires a prepared request, attaching the active auth token (if any) and the
 * configured default headers. Returns the parsed response. Throws on network error.
 */
export async function executeRequest(
    req:       PreparedRequest,
    config:    ConfigManager,
    authStore: AuthStore
): Promise<ExecResult> {

    const activeToken = await authStore.getActiveToken()
    const authOverrides: Record<string, string> =
        activeToken && (!activeToken.expiresAt || activeToken.expiresAt > Date.now())
            ? { Authorization: `Bearer ${activeToken.token}` }
            : {}

    const headers = config.buildRequestHeaders({
        ...(req.body ? { "Content-Type": req.contentType } : {}),
        ...authOverrides,
    })

    const start    = Date.now()
    const response = await fetch(req.url, {
        method:  req.method,
        headers,
        body:    req.body || undefined,
    })
    const elapsed = Date.now() - start
    const text    = await response.text()

    let data: any
    try   { data = JSON.parse(text) }
    catch { data = text }

    return { status: response.status, statusText: response.statusText, elapsed, data }
}
