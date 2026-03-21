/**
 * clientScript.ts
 * Browser-side JavaScript injected into the request panel webview.
 * Receives endpoint path and baseUrl as template params at render time.
 */

export function getClientScript(endpointPath: string, method: string, baseUrl: string): string {
    return `
  const vscode = acquireVsCodeApi()
  let _permanent = false

  // Highlight any pre-rendered restored response on load
  window.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('restoredResponse')
    if (el) el.innerHTML = highlight(el.textContent || '')
  })

  // First input on the page graduates this panel from preview → permanent
  document.addEventListener('input', () => {
    if (!_permanent) {
      _permanent = true
      vscode.postMessage({ type: 'markPermanent' })
    }
  }, { once: true })

  // ── Copy path button ──────────────────────────────────────────────────────
  function copyPath() {
    const btn = document.getElementById('copyBtn')
    navigator.clipboard.writeText('${endpointPath}')
    btn.classList.add('copied')
    btn.innerHTML = iconCheck()
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = iconCopy() }, 1500)
  }

  // ── Open config panel ─────────────────────────────────────────────────────
  function openConfig() {
    vscode.postMessage({ type: 'openConfig' })
  }

  function iconCopy()  { return 'Copy path' }
  function iconCheck() { return '✓ Copied' }

  const AUTH_LABELS = {
    bearer: { label: 'Bearer',     color: '#10b981' },
    apikey: { label: 'API Key',    color: '#3b82f6' },
    basic:  { label: 'Basic Auth', color: '#f59e0b' },
    none:   { label: 'No Auth',    color: 'rgba(204,204,204,0.3)' },
  }

  // ── Incoming messages from extension host ─────────────────────────────────
  window.addEventListener('message', (event) => {
    const msg  = event.data
    const area = document.getElementById('responseArea')
    const btn  = document.getElementById('sendBtn')

    // Config changed — update auth badge without re-rendering the whole panel
    if (msg.type === 'configUpdated') {
      const auth  = msg.auth
      const style = AUTH_LABELS[auth?.type] ?? AUTH_LABELS.none
      const badge = document.getElementById('authBadge')
      if (badge) {
        badge.textContent       = style.label
        badge.style.borderColor = style.color
        badge.style.color       = style.color
      }
      return
    }

    btn.disabled = false
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2l11 6-11 6V2z"/></svg> Send Request'

    if (msg.type === 'response') {
      const cls = msg.status >= 500 ? 's5xx' : msg.status >= 400 ? 's4xx' : msg.status >= 300 ? 's3xx' : 's2xx'
      const fmt = typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data, null, 2)

      // Detect token in response for manual "Use as Auth" button
      const detectedToken = detectToken(msg.data)

      area.innerHTML = \`
        <div class="response-meta">
          <span class="status-badge \${cls}">\${msg.status} \${msg.statusText}</span>
          <span class="elapsed">\${msg.elapsed}ms</span>
          <div style="margin-left:auto;display:flex;gap:6px">
            \${detectedToken ? \`<button onclick="useAsAuth('\${detectedToken}')" style="
              background:transparent;border:1px solid #10b981;
              color:#10b981;font-size:10px;font-family:inherit;
              padding:2px 8px;cursor:pointer;transition:all .1s;
            " onmouseover="this.style.opacity='.7'"
               onmouseout="this.style.opacity='1'">
              🔑 Use as Auth
            </button>\` : ''}
            <button onclick="copyResponse()" style="
              background:transparent;border:1px solid rgba(255,255,255,.12);
              color:rgba(204,204,204,.5);font-size:10px;font-family:inherit;
              padding:2px 8px;cursor:pointer;transition:all .1s;
            " onmouseover="this.style.color='#ccc';this.style.borderColor='rgba(255,255,255,.3)'"
               onmouseout="this.style.color='rgba(204,204,204,.5)';this.style.borderColor='rgba(255,255,255,.12)'">
              ⎘ Copy
            </button>
            <button onclick="openInEditor()" style="
              background:transparent;border:1px solid rgba(255,255,255,.12);
              color:rgba(204,204,204,.5);font-size:10px;font-family:inherit;
              padding:2px 8px;cursor:pointer;transition:all .1s;
            " onmouseover="this.style.color='#ccc';this.style.borderColor='rgba(255,255,255,.3)'"
               onmouseout="this.style.color='rgba(204,204,204,.5)';this.style.borderColor='rgba(255,255,255,.12)'">
              ↗ Open in Editor
            </button>
          </div>
        </div>
        <div class="code-block response-pre" id="currentResponse">\${highlight(fmt)}</div>\`

      window._lastResponse = fmt
      collapseSchema()

    } else if (msg.type === 'error') {
      area.innerHTML = \`
        <div class="error-block">
          ⚠ \${msg.message}<br/>
          <span style="opacity:.6;font-size:11px">Check that your server is running and the base URL is correct.</span>
        </div>\`
    }
  })

  // ── Schema toggle ─────────────────────────────────────────────────────────
  let _schemaVisible = true
  function toggleSchema() {
    _schemaVisible = !_schemaVisible
    const body   = document.getElementById('schemaBody')
    const toggle = document.getElementById('schemaToggle')
    if (body)   body.style.display   = _schemaVisible ? 'block' : 'none'
    if (toggle) toggle.textContent   = _schemaVisible ? '▼ hide' : '▶ show'
  }

  function collapseSchema() {
    if (!_schemaVisible) return
    _schemaVisible = false
    const body   = document.getElementById('schemaBody')
    const toggle = document.getElementById('schemaToggle')
    if (body)   body.style.display = 'none'
    if (toggle) toggle.textContent = '▶ show'
  }
  function detectToken(data) {
    if (!data || typeof data !== 'object') return null
    const fields = ['access_token','token','jwt','id_token','auth_token','accessToken']
    for (const f of fields) {
      if (typeof data[f] === 'string' && data[f].length > 10) return data[f]
    }
    for (const key of Object.keys(data)) {
      const nested = data[key]
      if (nested && typeof nested === 'object') {
        for (const f of fields) {
          if (typeof nested[f] === 'string' && nested[f].length > 10) return nested[f]
        }
      }
    }
    return null
  }

  function useAsAuth(token) {
    vscode.postMessage({ type: 'useAsAuth', token })
  }
  function copyResponse() {
    if (!window._lastResponse) return
    navigator.clipboard.writeText(window._lastResponse)
    // Brief visual feedback
    const btns = document.querySelectorAll('.response-meta button')
    btns.forEach(b => { if (b.textContent.includes('Copy')) b.textContent = '✓ Copied' })
    setTimeout(() => {
      btns.forEach(b => { if (b.textContent.includes('Copied')) b.textContent = '⎘ Copy' })
    }, 1500)
  }

  function openInEditor() {
    if (!window._lastResponse) return
    vscode.postMessage({
      type:     'openInEditor',
      content:  window._lastResponse,
      language: 'json',
    })
  }

  // ── Send request ──────────────────────────────────────────────────────────
  function sendRequest() {
    const btn  = document.getElementById('sendBtn')
    const area = document.getElementById('responseArea')

    let path = '${endpointPath}'
    document.querySelectorAll('[data-param]').forEach(el => {
      path = path.replace('{' + el.getAttribute('data-param') + '}', encodeURIComponent(el.value))
    })

    const qp = []
    document.querySelectorAll('[data-query]').forEach(el => {
      if (el.value) qp.push(
        encodeURIComponent(el.getAttribute('data-query')) + '=' + encodeURIComponent(el.value)
      )
    })

    const url    = '${baseUrl}' + path + (qp.length ? '?' + qp.join('&') : '')
    const bodyEl = document.getElementById('requestBody')

    if (bodyEl) {
      try { JSON.parse(bodyEl.value) } catch {
        area.innerHTML = '<div class="error-block">⚠ Request body is not valid JSON</div>'
        return
      }
    }

    btn.disabled    = true
    btn.textContent = 'Sending…'
    area.innerHTML  = '<div class="placeholder">Waiting for response…</div>'

    vscode.postMessage({
      type:    'sendRequest',
      url,
      method:  '${method}',
      headers: { 'Content-Type': 'application/json' },
      body:    bodyEl ? bodyEl.value : null,
    })
  }

  // ── JSON syntax highlighter ───────────────────────────────────────────────
  function highlight(json) {
    return json
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(
        /("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g,
        m => {
          let c = 'jn'
          if (/^"/.test(m)) c = /:$/.test(m) ? 'jk' : 'js'
          else if (/true|false|null/.test(m)) c = 'jb'
          return '<span class="' + c + '">' + m + '</span>'
        }
      )
  }
    `
}