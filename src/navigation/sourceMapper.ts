/**
 * sourceMapper.ts
 *
 * Maps an API endpoint back to its Python source handler.
 *
 * Strategy: grep for the FastAPI route decorator pattern directly.
 * Much more reliable than operationId parsing — doesn't rely on
 * function name extraction or naming conventions.
 *
 * Searches for patterns like:
 *   @router.get("/items")
 *   @app.post("/rfq/")
 *   @router.put("/{item_id}")
 *
 * Handles both full paths and relative paths (when router has a prefix).
 *
 */

import * as vscode from "vscode"
import { ApiEndpoint } from "../types/endpoint"

export interface SourceLocation {
    uri:  vscode.Uri
    line: number   // 0-indexed, points to the def line
}

/**
 * Builds a list of path candidates to search for.
 * For /rfq/{rfq_id} we try:
 *   - "/rfq/{rfq_id}"    (full path)
 *   - "/{rfq_id}"        (relative — router has /rfq prefix)
 *   - "{rfq_id}"         (without leading slash)
 *
 * For /rfq/ we try:
 *   - "/rfq/"
 *   - "/"
 *   - ""
 */
function buildPathCandidates(path: string): string[] {
    const candidates = new Set<string>()

    // Full path
    candidates.add(path)

    // Strip leading segments one at a time to handle router prefixes
    const segments = path.split("/").filter(Boolean)
    for (let i = 1; i < segments.length; i++) {
        candidates.add("/" + segments.slice(i).join("/"))
    }

    // Root path variants
    candidates.add("/")
    candidates.add("")

    return [...candidates]
}

/**
 * Escapes a path string for use in a regex.
 * Handles path params like {item_id} → \{item_id\}
 */
function escapePath(path: string): string {
    return path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Builds regex patterns for the given method and path candidates.
 * Matches: @<identifier>.<method>("<path>") or @<identifier>.<method>('<path>')
 */
function buildDecoratorPatterns(method: string, paths: string[]): RegExp[] {
    const m = method.toLowerCase()
    return paths.map(p => {
        const escaped = escapePath(p)
        // Match @anything.get("/path") with optional whitespace, single or double quotes
        return new RegExp(
            `@\\w+\\.${m}\\s*\\(\\s*["']${escaped}["']`,
            "m"
        )
    })
}

/**
 * Given a document and a decorator match index,
 * finds the line of the `def` or `async def` that follows.
 */
function findDefLine(doc: vscode.TextDocument, decoratorIndex: number): number {
    const decoratorLine = doc.positionAt(decoratorIndex).line
    const lineCount     = doc.lineCount

    // Look ahead up to 10 lines for the def
    for (let i = decoratorLine; i < Math.min(decoratorLine + 10, lineCount); i++) {
        const text = doc.lineAt(i).text
        if (/^\s*(async\s+)?def\s+\w+/.test(text)) {
            return i
        }
    }

    // Fallback: return decorator line itself
    return decoratorLine
}

/**
 * Searches the workspace Python files for the route handler.
 * Returns the location of the `def` line.
 */
export async function findSourceLocation(
    endpoint: ApiEndpoint
): Promise<SourceLocation | undefined> {

    const method   = endpoint.method
    const path     = endpoint.path
    const paths    = buildPathCandidates(path)
    const patterns = buildDecoratorPatterns(method, paths)

    // Find all Python files, skip venv / cache / node_modules
    const files = await vscode.workspace.findFiles(
        "**/*.py",
        "**/{.venv,venv,env,.env,node_modules,__pycache__,site-packages,dist-packages}/**"
    )

    // Sort files to prefer routers/ and api/ directories
    // This makes the first match more likely to be the right one
    const sorted = files.sort((a, b) => {
        const aPath = a.fsPath.toLowerCase()
        const bPath = b.fsPath.toLowerCase()
        const aScore = (aPath.includes("router") || aPath.includes("/api/")) ? 0 : 1
        const bScore = (bPath.includes("router") || bPath.includes("/api/")) ? 0 : 1
        return aScore - bScore
    })

    for (const fileUri of sorted) {
        try {
            const doc     = await vscode.workspace.openTextDocument(fileUri)
            const content = doc.getText()

            for (const pattern of patterns) {
                const match = pattern.exec(content)
                if (match) {
                    const line = findDefLine(doc, match.index)
                    return { uri: fileUri, line }
                }
            }
        } catch {
            // Skip unreadable files
        }
    }

    return undefined
}

/**
 * Returns a human-readable label for the source location.
 */
export function formatSourceLocation(
    loc:  SourceLocation,
    root: vscode.Uri
): string {
    const relative = vscode.workspace.asRelativePath(loc.uri, false)
    return `${relative}:${loc.line + 1}`
}