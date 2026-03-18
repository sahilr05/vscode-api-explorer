# TODO

## 🐛 Known Bugs

- [ ] **Sort doesn't work within module groups** — `toggleSort` notification fires but tree children don't reorder visually. VSCode appears to cache expanded `ModuleGroupItem` children. Tried double-firing `onDidChangeTreeData` with a 50ms gap — no effect. Needs deeper investigation into VSCode TreeView cache invalidation for nested items.

- [ ] **Source navigation fails for some endpoints** — `list_items_module_a__get` operationId not parsed correctly in `sourceMapper.ts` when path has underscores. `extractFunctionName` strips too aggressively and loses the actual function name.

---

## 🚀 Differentiating Features

- [ ] **Auth token auto-extract** ⭐
    - Static token config is already done (Project Config panel)
    - Remaining: detect login/auth endpoints automatically (`/login`, `/auth/token` etc.)
    - Fire login endpoint once → auto-extract token from response (`access_token`, `token`, `data.token`)
    - Store securely in VSCode `SecretStorage`
    - Auto-attach as `Authorization: Bearer {token}` on all subsequent requests
    - Show token expiry if JWT, prompt to re-auth when expired
    - New files: `src/auth/authManager.ts`, `src/auth/tokenExtractor.ts`

---

## 🔧 Pending Features

- [ ] **Environment switching** — read `.env` files from workspace, `{{variable}}` placeholders in URLs and request bodies, QuickPick env switcher (dev / staging / prod)

- [ ] **Export Postman collection** — export all endpoints as Postman-compatible JSON. Infrastructure already written in `postmanExporter.ts`, needs command + toolbar button wired up.

- [ ] **TypeScript interface generator** — convert `components/schemas` into TypeScript `interface` definitions, "Copy Type" or "Insert into Editor"

---

## ✅ Recently Fixed / Shipped

- [x] Duplicate API calls on preview tab swap — dispose old message handler before attaching new one
- [x] Default grouping now module instead of method
- [x] Filter by module added to sidebar toolbar
- [x] Sort broken in module group mode — `_groupByModule` now respects `_sortMode` for group order
- [x] `operationId` not passed to `goToSource` from inline tree button — unwrap `item.endpoint ?? item`
- [x] `$ref` resolution root mismatch — direct regex match instead of path walking
- [x] Published to VS Code Marketplace and Open VSX
- [x] Project Configuration Panel — configure auth, headers, base URL in one place
- [x] Auth support — Bearer Token, API Key, Basic Auth set once, applied to all requests
- [x] Default headers manager — set once per project, merged into every request
- [x] Auth badge on request panel with live updates when config changes
- [x] Auto-reconnect polling — silently polls when server offline, auto-connects when server starts
- [x] Friendly offline state in sidebar instead of error toast
- [x] "↗ Open in Editor" button — opens response in real VSCode editor tab
- [x] "⎘ Copy" button on response
- [x] Config panel opens in correct pane
- [x] Clicking same endpoint no longer opens duplicate tab

---

## 📝 Contributor Notes

- Keep files split per separation of concerns — one responsibility per file
- All new features should be workspace-scoped (use `workspaceState` not `globalState`)
- Webview HTML, styles, and client JS live in `src/request/webview/` — keep them separate
- Source navigation is FastAPI-only — framework detection lives in `sourceMapper.ts`
- Auth token auto-extract builds on top of existing `ConfigManager.saveProjectConfig()`
- `postmanExporter.ts` is written but not yet wired to a command