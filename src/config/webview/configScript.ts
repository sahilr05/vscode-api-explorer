/**
 * configScript.ts
 * Browser-side JS for the project config panel webview.
 * Handles auth type switching, header rows, and saving.
 */

export function getConfigScript(initialConfig: string): string {
    return `
    const vscode = acquireVsCodeApi()
    let config = ${initialConfig}

    // ── Auth type switching ───────────────────────────────────────────────────
    function setAuthType(type) {
        config.auth.type = type
        document.querySelectorAll('.auth-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type)
        })
        document.querySelectorAll('.auth-fields').forEach(el => {
            el.classList.remove('visible')
        })
        const fields = document.getElementById('auth-' + type)
        if (fields) fields.classList.add('visible')
    }

    // ── Headers ───────────────────────────────────────────────────────────────
    function renderHeaders() {
        const list = document.getElementById('headersList')
        list.innerHTML = ''

        Object.entries(config.defaultHeaders).forEach(([key, value], i) => {
            const row = document.createElement('div')
            row.className = 'header-row'
            row.innerHTML = \`
                <input class="input" placeholder="Header name" value="\${escHtml(key)}"
                    onchange="updateHeaderKey(\${i}, this.value)" />
                <input class="input" placeholder="Value" value="\${escHtml(value)}"
                    onchange="updateHeaderValue(\${i}, this.value)" />
                <button class="remove-btn" onclick="removeHeader(\${i})" title="Remove">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.25 9.19l-1.06 1.06L8 9.06l-2.19 2.19-1.06-1.06L6.94 8 4.75 5.81l1.06-1.06L8 6.94l2.19-2.19 1.06 1.06L9.06 8l2.19 2.19z"/>
                    </svg>
                </button>
            \`
            list.appendChild(row)
        })
    }

    function updateHeaderKey(index, newKey) {
        const entries = Object.entries(config.defaultHeaders)
        const [, value] = entries[index]
        const newHeaders = {}
        entries.forEach(([k, v], i) => {
            newHeaders[i === index ? newKey : k] = v
        })
        config.defaultHeaders = newHeaders
    }

    function updateHeaderValue(index, newValue) {
        const entries = Object.entries(config.defaultHeaders)
        entries[index][1] = newValue
        config.defaultHeaders = Object.fromEntries(entries)
    }

    function removeHeader(index) {
        const entries = Object.entries(config.defaultHeaders)
        entries.splice(index, 1)
        config.defaultHeaders = Object.fromEntries(entries)
        renderHeaders()
    }

    function addHeader() {
        config.defaultHeaders[''] = ''
        renderHeaders()
        // Focus the last key input
        const inputs = document.querySelectorAll('#headersList .header-row input')
        if (inputs.length) inputs[inputs.length - 2].focus()
    }

    // ── Save ──────────────────────────────────────────────────────────────────
    function save() {
        // Collect current values from inputs
        config.baseUrl = document.getElementById('baseUrl').value.replace(/\\/$/, '')

        // Auth fields
        config.auth.token        = document.getElementById('bearerToken')?.value || ''
        config.auth.apiKeyName   = document.getElementById('apiKeyName')?.value  || ''
        config.auth.apiKeyValue  = document.getElementById('apiKeyValue')?.value || ''
        config.auth.basicUser    = document.getElementById('basicUser')?.value   || ''
        config.auth.basicPass    = document.getElementById('basicPass')?.value   || ''

        vscode.postMessage({ type: 'save', config })

        const msg = document.getElementById('savedMsg')
        msg.classList.add('visible')
        setTimeout(() => msg.classList.remove('visible'), 2000)
    }

    // ── Listen for response from extension ────────────────────────────────────
    window.addEventListener('message', (event) => {
        if (event.data.type === 'configSaved') {
            // Config saved successfully — nothing extra needed
        }
    })

    function escHtml(str) {
        return String(str)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;')
            .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    window.addEventListener('DOMContentLoaded', () => {
        setAuthType(config.auth.type || 'none')
        renderHeaders()
    })
    `
}