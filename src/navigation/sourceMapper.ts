/**
 * sourceMapper.ts
 *
 * Maps an API endpoint back to its source code handler.
 *
 * Strategy for FastAPI:
 *   operationId "create_item_module_a__post"
 *   → extract function name "create_item"
 *   → search workspace Python files for "def create_item"
 *   → return file URI + line number
 *
 * FastAPI's operationId convention:
 *   {function_name}_{path_segments_underscored}_{method}
 *   The function name is always the first segment before the path kicks in.
 *   We extract it by stripping the known suffix pattern.
 */

import * as vscode from "vscode"
import { ApiEndpoint } from "../types/endpoint"

export interface SourceLocation {
    uri:  vscode.Uri
    line: number   // 0-indexed
}

/**
 * Extracts the Python function name from a FastAPI operationId.
 *
 * Examples:
 *   "create_item_module_a__post"  → "create_item"
 *   "login_auth_login_post"       → "login"
 *   "get_users_users__get"        → "get_users"
 *
 * FastAPI appends the path (with slashes → underscores, params stripped)
 * and then the method. We strip from the right until we find a match
 * that exists in the workspace.
 */
export function extractFunctionName(operationId: string, path: string): string {
    // Build the path suffix FastAPI appends:
    // "/module-a/{item_id}" → "module_a__item_id_" (rough pattern)
    // Safer approach: strip the method suffix first, then try progressively
    // shorter prefixes of the operationId as the function name candidate.

    const method = operationId.split("_").pop() ?? ""
    // Strip trailing _method
    const withoutMethod = operationId.slice(0, -(method.length + 1))

    // Build expected path suffix from the path
    // "/module-a/{item_id}" → "module_a__item_id_" — underscores, params kept
    const pathSuffix = path
        .replace(/^\//, "")          // strip leading slash
        .replace(/\//g, "_")         // slashes → underscores
        .replace(/[{}-]/g, "_")      // params and hyphens → underscores
        .replace(/_+/g, "_")         // collapse multiple underscores
        .replace(/^_|_$/g, "")       // strip leading/trailing

    // Strip the path suffix from the end of withoutMethod to get function name
    if (pathSuffix && withoutMethod.endsWith(pathSuffix)) {
        const fnName = withoutMethod.slice(0, -(pathSuffix.length + 1))
        if (fnName) return fnName
    }

    // Fallback: return the operationId up to the first path segment
    // This covers most cases where path suffix extraction fails
    return withoutMethod.split("_")[0] ?? operationId
}

/**
 * Searches the workspace for a Python file containing the route handler.
 * Returns the first match found.
 */
export async function findSourceLocation(
    endpoint: ApiEndpoint
): Promise<SourceLocation | undefined> {

    if (!endpoint.operationId) return undefined

    const fnName = extractFunctionName(endpoint.operationId, endpoint.path)

    // Search all Python files in the workspace
    const files = await vscode.workspace.findFiles(
        "**/*.py",
        "**/node_modules/**"
    )

    // Patterns to search for — ordered by specificity
    const patterns = [
        // Exact async def or def with decorator context
        new RegExp(`^\\s*async\\s+def\\s+${fnName}\\s*\\(`, "m"),
        new RegExp(`^\\s*def\\s+${fnName}\\s*\\(`, "m"),
    ]

    for (const fileUri of files) {
        try {
            const doc     = await vscode.workspace.openTextDocument(fileUri)
            const content = doc.getText()

            for (const pattern of patterns) {
                const match = pattern.exec(content)
                if (match) {
                    // Convert character offset to line number
                    const line = doc.positionAt(match.index).line
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
 * e.g. "routers/items.py:42"
 */
export function formatSourceLocation(
    loc:  SourceLocation,
    root: vscode.Uri
): string {
    const relative = vscode.workspace.asRelativePath(loc.uri, false)
    return `${relative}:${loc.line + 1}`
}