/**
 * inferModule.ts
 * Infers the module path from an API endpoint path.
 * Returns an array of segments — supports n-level nesting.
 *
 * Examples:
 *   /auth/login          → ["auth"]
 *   /rfx/rfp/{rfp_id}   → ["rfx", "rfp"]
 *   /rfx/rfq/{rfq_id}   → ["rfx", "rfq"]
 *   /items/              → ["items"]
 *   /v1/api/users/{id}  → ["users"]
 */

const SKIP_SEGMENTS = new Set(["api", "v1", "v2", "v3", "v4", "rest", "graphql"])

/**
 * Returns the full module path as an array of segments.
 * Skips version prefixes, "api", path params, etc.
 */
export function inferModulePath(path: string): string[] {
    const segments = path.split("/").filter(Boolean)
    const result: string[] = []

    for (const seg of segments) {
        if (SKIP_SEGMENTS.has(seg.toLowerCase())) continue
        if (seg.startsWith("{")) break  // stop at path params
        if (/^v\d+$/i.test(seg)) continue
        result.push(seg.toLowerCase())
    }

    return result
}

/**
 * Returns just the top-level module name — used for filter QuickPick.
 */
export function inferModule(path: string): string {
    return inferModulePath(path)[0] ?? "other"
}

/**
 * Returns true if an endpoint belongs under a given module path.
 * e.g. endpoint /rfx/rfp/{id} belongs under ["rfx"] and ["rfx", "rfp"]
 */
export function endpointBelongsTo(endpointPath: string, modulePath: string[]): boolean {
    const ep = inferModulePath(endpointPath)
    if (ep.length < modulePath.length) return false
    return modulePath.every((seg, i) => ep[i] === seg)
}

/**
 * Strips the module path prefix from a display path.
 * e.g. /rfx/rfp/{id} with prefix ["rfx", "rfp"] → /{id}
 */
export function stripModulePrefix(path: string, modulePath: string[]): string {
    if (modulePath.length === 0) return path

    // Build the string prefix to strip
    // We strip the path segments that correspond to the module path
    const segments = path.split("/").filter(Boolean)
    let stripped = segments

    for (const mod of modulePath) {
        const idx = stripped.findIndex(
            s => s.toLowerCase() === mod && !s.startsWith("{") && !SKIP_SEGMENTS.has(s.toLowerCase())
        )
        if (idx !== -1) {
            stripped = stripped.slice(idx + 1)
        }
    }

    return "/" + stripped.join("/") || "/"
}