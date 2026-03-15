# TODO

## 🐛 Known Bugs

- [ ] **Duplicate API calls when multiple tabs open for same endpoint** — if 3 panels exist for the same route and a request is fired, all 3 message handlers respond. Fix: `_attachHandler` should dispose the previous listener before attaching a new one, or panels should be strictly deduplicated so 3 tabs can never exist for the same key.

- [ ] **Sort doesn't work within module groups** — `toggleSort` sorts the group list alphabetically but endpoints *within* each module group are not sorted. Fix: apply `_sortMode` inside the `getChildren` branch for `ModuleGroupItem`, same way it's applied in `_visibleEndpoints`.

- [ ] **Default grouping should be by module, not by method** — change initial `_groupMode` in `EndpointTreeProvider` constructor from `"method"` to `"module"`, and update the initial `setContext` call in `extension.ts` to match.

---

## 🔧 Pending Features

- [ ] **Response schema behaviour** — currently shows a read-only schema preview. Decide on and implement: validation of actual response against spec (flag missing/extra fields, type mismatches). Lives in `template.ts` + `schemaResolver.ts`.

- [ ] **Filter by module** — alongside the existing filter-by-method, allow filtering the tree to show only selected modules. Needs a new QuickPick command and a `_moduleFilters` set in `EndpointTreeProvider`.

- [ ] **Auth token management** — detect login endpoints, fire once, auto-extract token, store in `SecretStorage`, attach as `Authorization: Bearer` on all subsequent requests.

- [ ] **Environment switching** — read `.env` files from workspace, `{{variable}}` placeholders in URLs and bodies, QuickPick env switcher.

- [ ] **Default headers manager** — per-project key-value headers stored in `workspaceState`, merged into every request automatically.

- [ ] **Chained requests (basic)** — pin a field from a response as a workspace variable, reference as `{{response.id}}` in next request.

- [ ] **Export collection** — export all endpoints as Postman-compatible JSON and a plain Git-committable format.

---

## ✅ Recently Fixed

- [x] Sort broken in module group mode — `_groupByModule` now respects `_sortMode` for group order
- [x] `operationId` not passed to `goToSource` from inline tree button — unwrap `item.endpoint ?? item` in command handler
- [x] `$ref` resolution root mismatch — use direct regex match instead of path walking

---

## 📝 Contributor Notes

- Keep files split per separation of concerns — one responsibility per file
- `requestHandler.ts` import path for `HistoryManager` must be `"../history/historyManager"` not `"./historyManager"`
- All new features should be workspace-scoped (use `workspaceState` not `globalState`)
- Webview HTML, styles, and client JS live in `src/request/webview/` — keep them separate
- Source navigation currently FastAPI-only — framework detection lives in `sourceMapper.ts`