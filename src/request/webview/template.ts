/**
 * template.ts
 * Assembles the full HTML for the request panel webview.
 * Imports styles and clientScript separately for maintainability.
 */

import { ApiEndpoint } from "../../types/endpoint"
import {
    buildRequestBodyTemplate,
    buildResponseBodyTemplate,
} from "../../openapi/schemaResolver"
import { getStyles }      from "./styles"
import { getClientScript } from "./clientScript"

const METHOD_COLORS: Record<string, string> = {
    GET:    "#10b981",
    POST:   "#3b82f6",
    PUT:    "#f59e0b",
    DELETE: "#f43f5e",
    PATCH:  "#a78bfa",
}

export interface RestoredState {
    requestBody?:  string
    responseBody?: string
    status?:       number
    statusText?:   string
    elapsed?:      number
}

export function renderPanel(
    endpoint: ApiEndpoint,
    baseUrl:  string,
    restored?: RestoredState
): string {
    const color       = METHOD_COLORS[endpoint.method] ?? "#cccccc"
    const hasBody     = ["POST", "PUT", "PATCH"].includes(endpoint.method)
    const pathParams  = (endpoint.parameters ?? []).filter((p: any) => p.in === "path")
    const queryParams = (endpoint.parameters ?? []).filter((p: any) => p.in === "query")
    const components  = endpoint.components ?? {}

    const bodyContent = restored?.requestBody
        ?? (hasBody ? buildRequestBodyTemplate(endpoint.requestBody, components) : "")

    const responseSchema = buildResponseBodyTemplate(endpoint.responses, components)

    const formattedPath = endpoint.path.replace(
        /\{([^}]+)\}/g,
        `<span style="color:rgba(204,204,204,0.35)">{$1}</span>`
    )

    // ── Path params ──────────────────────────────────────────────────────────
    const pathParamsHtml = pathParams.length > 0 ? `
        <div class="section">
            <h3 class="section-title">Path Parameters</h3>
            <div class="param-list">
                ${pathParams.map((p: any) => `
                    <div class="param-row">
                        <label class="param-label">${p.name}${p.required ? ' <span class="required">*</span>' : ""}</label>
                        <input class="param-input" id="path_${p.name}" placeholder="${p.description || p.name}" data-param="${p.name}" />
                    </div>`).join("")}
            </div>
        </div>` : ""

    // ── Query params ─────────────────────────────────────────────────────────
    const queryParamsHtml = queryParams.length > 0 ? `
        <div class="section">
            <h3 class="section-title">Query Parameters</h3>
            <div class="param-list">
                ${queryParams.map((p: any) => `
                    <div class="param-row">
                        <label class="param-label">${p.name}${p.required ? ' <span class="required">*</span>' : ""}</label>
                        <input class="param-input" id="query_${p.name}" placeholder="${p.description || p.name}" data-query="${p.name}" />
                    </div>`).join("")}
            </div>
        </div>` : ""

    // ── Request body ─────────────────────────────────────────────────────────
    const bodyHtml = hasBody ? `
        <div class="section">
            <h3 class="section-title">Request Body</h3>
            <textarea class="code-block" id="requestBody" style="height:140px;resize:vertical;width:100%">${bodyContent}</textarea>
        </div>` : ""

    // ── Expected response schema (read-only hint) ────────────────────────────
    const responseSchemaHtml = responseSchema ? `
        <div class="section">
            <h3 class="section-title">Expected Response</h3>
            <div class="schema-label">schema preview — read only</div>
            <div class="schema-preview">${responseSchema
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            }</div>
        </div>` : ""

    // ── Restored response (from history) ────────────────────────────────────
    const restoredResponseHtml = (() => {
        if (!restored?.responseBody) return ""
        const status     = restored.status ?? 0
        const statusText = restored.statusText ?? ""
        const elapsed    = restored.elapsed ?? 0
        const cls        = status >= 500 ? "s5xx"
                         : status >= 400 ? "s4xx"
                         : status >= 300 ? "s3xx" : "s2xx"
        const escaped = restored.responseBody
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        return `
            <div class="response-meta">
                <span class="status-badge ${cls}">${status} ${statusText}</span>
                <span class="elapsed">${elapsed}ms</span>
                <span class="restored-tag">restored</span>
            </div>
            <div class="code-block response-pre" id="restoredResponse">${escaped}</div>`
    })()

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <title>${endpoint.method} ${endpoint.path}</title>
    <style>${getStyles(color)}</style>
</head>
<body>

<div class="scroll-area">
    <div class="inner">

        <div class="header">
            <span class="method-badge">${endpoint.method}</span>
            <span class="endpoint-path">${formattedPath}</span>
            <button class="copy-btn" id="copyBtn" onclick="copyPath()" title="Copy path">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 4v-2a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2h-2v2a2 2 0 01-2 2H2a2 2 0 01-2-2V6a2 2 0 012-2h2zm2 0h4a2 2 0 012 2v6h2V2H6v2zM2 6v8h6V6H2z"/>
                </svg>
            </button>
        </div>

        ${endpoint.summary ? `<div class="summary">${endpoint.summary}</div>` : ""}

        <div class="base-url-strip">
            <span class="base-url-tag">Base URL</span>
            <span class="base-url-value">${baseUrl}</span>
            <span class="base-url-hint">click status bar to change</span>
        </div>

        ${pathParamsHtml}
        ${queryParamsHtml}
        ${bodyHtml}
        ${responseSchemaHtml}

        <div class="section">
            <h3 class="section-title">Response</h3>
            <div id="responseArea">
                ${restoredResponseHtml || '<div class="placeholder">Hit Send to see the response</div>'}
            </div>
        </div>

    </div>
</div>

<div class="footer">
    <button class="send-btn" id="sendBtn" onclick="sendRequest()">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2l11 6-11 6V2z"/></svg>
        Send Request
    </button>
</div>

<script>${getClientScript(endpoint.path, endpoint.method, baseUrl)}</script>
</body>
</html>`
}