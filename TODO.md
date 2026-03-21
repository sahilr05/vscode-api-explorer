# TODO

## 🐛 Known Bugs

- [ ] **Source navigation fails for some endpoints** - `list_items_module_a__get` operationId not parsed correctly in `sourceMapper.ts` when path has underscores. `extractFunctionName` strips too aggressively and loses the actual function name.

---

## 🚀 Differentiating Features

- [ ] **Named test cases per endpoint** ⭐
    - Save named input sets per endpoint (e.g. "valid data", "missing field", "admin token")
    - Stored in `workspaceState` - per project, persists across reloads
    - Shown as a dropdown in the request panel to quickly switch between saved inputs
    - Feeds directly into pytest export

- [ ] **Export session to pytest** ⭐⭐
    - One click turns real API usage (from history or named test cases) into a runnable pytest file
    - Generated file uses `httpx` and `pytest`, ready to drop into the project and run in CI
    - Assertions generated from actual responses - status code, key field presence, values
    - Does NOT blindly run all endpoints - only exports what the dev has explicitly tested
    - DELETE/destructive endpoints require explicit opt-in
    - New file: `src/export/pytestExporter.ts`

---

## 🔧 Pending Features

- [ ] **Export Postman collection** - export all endpoints as Postman-compatible JSON. Infrastructure already written in `postmanExporter.ts`, needs command + toolbar button wired up.

- [ ] **Environment switching** - read `.env` files from workspace, `{{variable}}` placeholders in URLs and request bodies, QuickPick env switcher (dev / staging / prod)

- [ ] **TypeScript interface generator** - convert `components/schemas` into TypeScript `interface` definitions, "Copy Type" or "Insert into Editor"

---

## ✅ Recently Fixed / Shipped

- [x] Auth token auto-extract - detects login endpoints, prompts to store token, attaches to all requests
- [x] JWT expiry warning notification with "Open Login" shortcut
- [x] Method badge SVG icons in sidebar tree (colored pill per HTTP method)
- [x] 5xx error highlight - red icon on failing endpoints, clears on success
- [x] Filter & Sort combined into single toolbar icon - one picker for method + module
- [x] Collapsible Expected Response schema - auto-collapses when real response arrives
- [x] Response capped at 400px with scroll
- [x] History shows static timestamps (e.g. 7:01 PM) instead of relative "10s ago"
- [x] Module prefix stripped in tree - `/module-a/create` shows as `/create`
- [x] "What's New" button in update notification - opens CHANGELOG.md in markdown preview
- [x] "Copy path" button on request panel header
- [x] Sort removed from toolbar (rarely used)
- [x] Duplicate API calls on preview tab swap
- [x] Default grouping now module instead of method
- [x] Filter by module added to sidebar toolbar
- [x] `$ref` resolution root mismatch - direct regex match instead of path walking
- [x] Published to VS Code Marketplace and Open VSX
- [x] Project Configuration Panel - configure auth, headers, base URL in one place
- [x] Auth badge on request panel with live updates when config changes
- [x] Auto-reconnect polling - silently polls when server offline, auto-connects when server starts
- [x] Friendly offline state in sidebar instead of error toast
- [x] "↗ Open in Editor" button - opens response in real VSCode editor tab
- [x] Config panel opens in correct pane
- [x] Clicking same endpoint no longer opens duplicate tab

---

## 📝 Contributor Notes

- Keep files split per separation of concerns - one responsibility per file
- All new features should be workspace-scoped (use `workspaceState` not `globalState`)
- Source navigation is FastAPI-only - framework detection lives in `sourceMapper.ts`
- Auth store uses VSCode `SecretStorage` - do not move to `workspaceState`