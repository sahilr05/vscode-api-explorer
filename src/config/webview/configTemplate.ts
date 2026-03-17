/**
 * configTemplate.ts
 * Assembles the full HTML for the project configuration panel.
 */

import { ProjectConfig } from "../configManager"
import { getConfigStyles } from "./configStyles"
import { getConfigScript } from "./configScript"

export function renderConfigPanel(config: ProjectConfig): string {

    const c = config
    const h = c.defaultHeaders

    const headersJson = JSON.stringify(c).replace(/</g, '\\u003c')

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
    <title>Project Configuration</title>
    <style>${getConfigStyles()}</style>
</head>
<body>

<div class="scroll-area">
<div class="inner">

    <!-- Header -->
    <div class="header">
        <div>
            <div class="header-title">⚙ Project Configuration</div>
            <div class="header-sub">Settings apply to all requests in this workspace</div>
        </div>
    </div>

    <!-- Base URL -->
    <div class="section">
        <h3 class="section-title">Base URL</h3>
        <div class="field">
            <label>Server base URL</label>
            <input class="input" id="baseUrl" value="${c.baseUrl}" placeholder="http://localhost:8000" />
        </div>
    </div>

    <div class="divider"></div>

    <!-- Authentication -->
    <div class="section">
        <h3 class="section-title">Authentication</h3>
        <div class="auth-types">
            <button class="auth-type-btn" data-type="none"   onclick="setAuthType('none')">None</button>
            <button class="auth-type-btn" data-type="bearer" onclick="setAuthType('bearer')">Bearer Token</button>
            <button class="auth-type-btn" data-type="apikey" onclick="setAuthType('apikey')">API Key</button>
            <button class="auth-type-btn" data-type="basic"  onclick="setAuthType('basic')">Basic Auth</button>
        </div>

        <!-- Bearer -->
        <div class="auth-fields" id="auth-bearer">
            <div class="field">
                <label>Token</label>
                <input class="input" id="bearerToken"
                    value="${c.auth.token ?? ''}"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
            </div>
        </div>

        <!-- API Key -->
        <div class="auth-fields" id="auth-apikey">
            <div class="field">
                <label>Header name</label>
                <input class="input" id="apiKeyName"
                    value="${c.auth.apiKeyName ?? ''}"
                    placeholder="X-API-Key" />
            </div>
            <div class="field">
                <label>Value</label>
                <input class="input" id="apiKeyValue"
                    value="${c.auth.apiKeyValue ?? ''}"
                    placeholder="your-api-key" />
            </div>
        </div>

        <!-- Basic -->
        <div class="auth-fields" id="auth-basic">
            <div class="field">
                <label>Username</label>
                <input class="input" id="basicUser"
                    value="${c.auth.basicUser ?? ''}"
                    placeholder="username" />
            </div>
            <div class="field">
                <label>Password</label>
                <input class="input" id="basicPass" type="password"
                    value="${c.auth.basicPass ?? ''}"
                    placeholder="password" />
            </div>
        </div>
    </div>

    <div class="divider"></div>

    <!-- Default Headers -->
    <div class="section">
        <h3 class="section-title">Default Headers</h3>
        <div class="headers-list" id="headersList"></div>
        <button class="add-btn" onclick="addHeader()">+ Add header</button>
    </div>

</div>
</div>

<!-- Footer -->
<div class="footer">
    <button class="save-btn" onclick="save()">Save</button>
    <span class="saved-msg" id="savedMsg">✓ Saved</span>
</div>

<script>${getConfigScript(headersJson)}</script>
</body>
</html>`
}