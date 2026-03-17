# TODO

## 🐛 Known Bugs

- [x] **Duplicate API calls when multiple tabs open for same endpoint** — fixed by disposing previous `onDidReceiveMessage` listener before attaching a new one in `requestPanel.ts`

- [ ] **Sort doesn't work within module groups** — `toggleSort` notification fires but tree children don't reorder visually. VSCode appears to cache expanded `ModuleGroupItem` children. Tried double-firing `onDidChangeTreeData` with a 50ms gap — no effect. Needs deeper investigation into VSCode TreeView cache invalidation for nested items.

---

## 🚀 Differentiating Features (high priority)

- [ ] **Auth Flow Sequences** ⭐⭐
    - Detect login/auth endpoints automatically (`/login`, `/auth/token`, `/auth/login` etc.)
    - Let user define a simple auth sequence in `.api-explorer.json` in workspace root
    - "Run Auth Flow" button that fires login → extracts token from response → stores in `SecretStorage`
    - Auto-attaches `Authorization: Bearer {token}` to all subsequent requests
    - Show token expiry if JWT, prompt to re-auth when expired
    - New files: `src/auth/authManager.ts`, `src/auth/tokenExtractor.ts`

---

## 🔧 Pending Features

- [ ] **Spec changelog diff** — diff old spec vs new spec on every reload, show what changed (new endpoints, removed endpoints, changed schemas) in a notification or dedicated panel

- [ ] **Environment switching** — read `.env` files from workspace, `{{variable}}` placeholders in URLs and bodies, QuickPick env switcher (dev / staging / prod)

- [ ] **Default headers manager** — per-project key-value headers stored in `workspaceState`, merged into every request automatically. Solves headers fatigue.

- [ ] **Chained requests (basic)** — pin a field from a response as a workspace variable, reference as `{{response.id}}` in next request

- [ ] **Export collection** — export all endpoints as Postman-compatible JSON and a plain Git-committable format

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
- [x] Add auth support
= [x] Added Project Configuration Panel to configure auth, headers, base URL

---

## 📝 Contributor Notes

- Keep files split per separation of concerns — one responsibility per file
- All new features should be workspace-scoped (use `workspaceState` not `globalState`)
- Webview HTML, styles, and client JS live in `src/request/webview/` — keep them separate
- Source navigation currently FastAPI-only — framework detection lives in `sourceMapper.ts`