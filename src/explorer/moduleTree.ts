/**
 * moduleTree.ts
 * Builds a recursive module tree from a flat list of endpoints.
 * Supports n-level nesting — no hardcoded depth limit.
 */

import * as vscode      from 'vscode'
import { ApiEndpoint }  from '../types/endpoint'
import { inferModulePath, endpointBelongsTo } from './inferModule'
import { ModuleGroupItem, EndpointItem, InfoItem, METHOD_COLORS } from './treeItems'

export interface ModuleTreeContext {
    extensionUri:  vscode.Uri
    errorMap:      Map<string, number>
    authEndpoints: Set<string>
}

/**
 * Builds tree items for a given set of endpoints at a given module depth.
 * Recursively groups endpoints into sub-folders as needed.
 */
export function buildModuleTree(
    endpoints:  ApiEndpoint[],
    parentPath: string[],         // e.g. [] for root, ["rfx"] for rfx level
    ctx:        ModuleTreeContext
): vscode.TreeItem[] {

    const depth = parentPath.length

    // Split endpoints into: direct children vs deeper
    const direct:   ApiEndpoint[] = []
    const childMap: Map<string, ApiEndpoint[]> = new Map()

    for (const e of endpoints) {
        const modPath = inferModulePath(e.path)

        if (modPath.length <= depth) {
            // Endpoint lives directly at this level
            direct.push(e)
        } else {
            // Endpoint belongs in a sub-folder
            const childKey = modPath[depth]
            if (!childMap.has(childKey)) childMap.set(childKey, [])
            childMap.get(childKey)!.push(e)
        }
    }

    const items: vscode.TreeItem[] = []

    // Sub-folders first (sorted by name)
    const sortedKeys = [...childMap.keys()].sort()
    for (const childName of sortedKeys) {
        const childEndpoints = childMap.get(childName)!
        const childPath      = [...parentPath, childName]
        items.push(new ModuleGroupItem(childName, childPath, childEndpoints.length))
    }

    // Direct endpoints after folders
    for (const e of direct) {
        const key = `${e.method}:${e.path}`
        items.push(new EndpointItem(
            e,
            ctx.extensionUri,
            ctx.errorMap.get(key),
            parentPath,
            ctx.authEndpoints.has(key)
        ))
    }

    return items
}

/**
 * Builds the top-level module groups from all visible endpoints.
 * Falls back to method grouping if no modules detected.
 */
export function buildTopLevelModuleTree(
    endpoints:  ApiEndpoint[],
    ctx:        ModuleTreeContext,
    fallback:   () => vscode.TreeItem[]
): vscode.TreeItem[] {

    // Check if everything would land in "other" (no module segments)
    const allFlat = endpoints.every(e => inferModulePath(e.path).length === 0)
    if (allFlat) {
        return [
            new InfoItem("No modules detected — paths have no named segments", "info"),
            ...fallback()
        ]
    }

    return buildModuleTree(endpoints, [], ctx)
}