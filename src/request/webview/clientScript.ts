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

  function iconCopy() {
    return '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M4 4v-2a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2h-2v2a2 2 0 01-2 2H2a2 2 0 01-2-2V6a2 2 0 012-2h2zm2 0h4a2 2 0 012 2v6h2V2H6v2zM2 6v8h6V6H2z"/></svg>'
  }

  function iconCheck() {
    return '<svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>'
  }

  // ── Incoming messages from extension host ─────────────────────────────────
  window.addEventListener('message', (event) => {
    const msg  = event.data
    const area = document.getElementById('responseArea')
    const btn  = document.getElementById('sendBtn')

    btn.disabled = false
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2l11 6-11 6V2z"/></svg> Send Request'

    if (msg.type === 'response') {
      const cls = msg.status >= 500 ? 's5xx' : msg.status >= 400 ? 's4xx' : msg.status >= 300 ? 's3xx' : 's2xx'
      const fmt = typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data, null, 2)
      area.innerHTML = \`
        <div class="response-meta">
          <span class="status-badge \${cls}">\${msg.status} \${msg.statusText}</span>
          <span class="elapsed">\${msg.elapsed}ms</span>
        </div>
        <div class="code-block response-pre">\${highlight(fmt)}</div>\`

    } else if (msg.type === 'error') {
      area.innerHTML = \`
        <div class="error-block">
          ⚠ \${msg.message}<br/>
          <span style="opacity:.6;font-size:11px">Check that your server is running and the base URL is correct.</span>
        </div>\`
    }
  })

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