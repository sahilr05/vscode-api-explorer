# Changelog

## [0.1.1] - 2026-03-15

### Fixed
- Duplicate API calls when switching endpoints in preview tab
- Default grouping now shows modules instead of methods

### Added
- Filter by module in the sidebar toolbar

## [0.1.0] - 2026-03-15

### Initial Release

- Zero-config OpenAPI endpoint discovery (FastAPI + any OpenAPI 3.x server)
- Request panel with pre-filled bodies resolved from `$ref` schemas
- Expected response schema preview
- Request history with full request/response persistence per workspace
- Group endpoints by method or module (auto-inferred from URL structure)
- Filter by HTTP method, live search, sort toggle
- Per-project base URL via status bar
- Go to Source — jump from any endpoint to its Python route handler
- Preview tab behaviour — reuses one tab until you edit