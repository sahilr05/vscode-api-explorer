/**
 * endpointTreeProvider.ts
 * VSCode TreeDataProvider for the Endpoints sidebar.
 * Delegates rendering to treeItems.ts and grouping to moduleTree.ts.
 */

import * as vscode      from 'vscode'
import { ApiEndpoint }  from '../types/endpoint'
import { inferModule, inferModulePath, endpointBelongsTo } from './inferModule'
import { buildTopLevelModuleTree, buildModuleTree, ModuleTreeContext } from './moduleTree'
import {
    MethodGroupItem, ModuleGroupItem,
    EndpointItem, InfoItem
} from './treeItems'

export type GroupMode = "method" | "module"
export type SortMode  = "default" | "alpha"

export class EndpointTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    private _endpoints:     ApiEndpoint[] = []
    private _searchQuery:   string        = ""
    private _groupMode:     GroupMode     = "module"
    private _sortMode:      SortMode      = "default"
    private _methodFilters: Set<string>   = new Set()
    private _moduleFilters: Set<string>   = new Set()
    private _offlineUrl:    string | undefined
    private _errorMap:      Map<string, number> = new Map()
    private _authEndpoints: Set<string>   = new Set()

    private _onDidChangeTreeData = new vscode.EventEmitter<void>()
    readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event

    constructor(
        initialEndpoints: ApiEndpoint[],
        private readonly _extensionUri: vscode.Uri
    ) {
        this._endpoints = initialEndpoints
    }

    // ── State setters ─────────────────────────────────────────────────────────

    setEndpoints(endpoints: ApiEndpoint[]) {
        this._endpoints  = endpoints
        this._offlineUrl = undefined
        this._onDidChangeTreeData.fire()
    }

    setOffline(url: string) {
        this._endpoints  = []
        this._offlineUrl = url
        this._onDidChangeTreeData.fire()
    }

    setSearchQuery(query: string) {
        this._searchQuery = query.toLowerCase().trim()
        this._onDidChangeTreeData.fire()
    }

    setGroupMode(mode: GroupMode) {
        this._groupMode = mode
        this._onDidChangeTreeData.fire()
    }

    setSortMode(mode: SortMode) {
        this._sortMode = mode
        this._onDidChangeTreeData.fire()
        setTimeout(() => this._onDidChangeTreeData.fire(), 50)
    }

    setMethodFilters(methods: Set<string>) {
        this._methodFilters = methods
        this._onDidChangeTreeData.fire()
    }

    setModuleFilters(modules: Set<string>) {
        this._moduleFilters = modules
        this._onDidChangeTreeData.fire()
    }

    setAuthEndpoint(key: string) {
        this._authEndpoints.add(key)
        this._onDidChangeTreeData.fire()
    }

    clearAuthEndpoint(key: string) {
        this._authEndpoints.delete(key)
        this._onDidChangeTreeData.fire()
    }

    setAuthEndpoints(keys: string[]) {
        this._authEndpoints = new Set(keys)
        this._onDidChangeTreeData.fire()
    }

    setEndpointError(key: string, status: number) {
        this._errorMap.set(key, status)
        this._onDidChangeTreeData.fire()
    }

    clearEndpointError(key: string) {
        if (this._errorMap.has(key)) {
            this._errorMap.delete(key)
            this._onDidChangeTreeData.fire()
        }
    }

    refresh(): void { this._onDidChangeTreeData.fire() }

    // ── Getters ───────────────────────────────────────────────────────────────

    get groupMode():     GroupMode   { return this._groupMode }
    get sortMode():      SortMode    { return this._sortMode }
    get methodFilters(): Set<string> { return this._methodFilters }
    get moduleFilters(): Set<string> { return this._moduleFilters }

    get allModules(): string[] {
        return [...new Set(this._endpoints.map(e => inferModule(e.path)))].sort()
    }

    // ── TreeDataProvider ──────────────────────────────────────────────────────

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem { return element }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {

        // Offline state
        if (!element && this._offlineUrl) {
            return [
                new InfoItem(`Server offline — waiting for ${this._offlineUrl}`, "loading~spin"),
                new InfoItem("Start your server to auto-connect", "info"),
                new InfoItem("Wrong URL? Click ⚙ to change", "gear"),
            ]
        }

        if (!element && this._endpoints.length === 0) {
            return [new InfoItem("No endpoints loaded", "loading~spin")]
        }

        const ctx: ModuleTreeContext = {
            extensionUri:  this._extensionUri,
            errorMap:      this._errorMap,
            authEndpoints: this._authEndpoints,
        }

        // Root level
        if (!element) {
            const visible = this._visibleEndpoints()
            if (visible.length === 0 && this._searchQuery) {
                return [new InfoItem(`No matches for "${this._searchQuery}"`, "search")]
            }
            if (visible.length === 0 && this._methodFilters.size > 0) {
                return [new InfoItem("No endpoints match the active method filter", "filter")]
            }
            if (visible.length === 0 && this._moduleFilters.size > 0) {
                return [new InfoItem("No endpoints match the active module filter", "folder")]
            }

            if (this._groupMode === "method") {
                return this._groupByMethod(visible)
            }

            return buildTopLevelModuleTree(visible, ctx, () => this._groupByMethod(visible))
        }

        // Method group children — flat list
        if (element instanceof MethodGroupItem) {
            return this._visibleEndpoints()
                .filter(e => e.method === element.method)
                .map(e => new EndpointItem(
                    e, this._extensionUri,
                    this._errorMap.get(`${e.method}:${e.path}`),
                    undefined,
                    this._authEndpoints.has(`${e.method}:${e.path}`)
                ))
        }

        // Module group children — recursive
        if (element instanceof ModuleGroupItem) {
            const scoped = this._visibleEndpoints().filter(e =>
                endpointBelongsTo(e.path, element.modulePath)
            )
            return buildModuleTree(scoped, element.modulePath, ctx)
        }

        return []
    }

    // ── Private ───────────────────────────────────────────────────────────────

    private _visibleEndpoints(): ApiEndpoint[] {
        let list = [...this._endpoints]

        if (this._methodFilters.size > 0) {
            list = list.filter(e => this._methodFilters.has(e.method))
        }

        if (this._moduleFilters.size > 0) {
            list = list.filter(e => this._moduleFilters.has(inferModule(e.path)))
        }

        if (this._searchQuery) {
            list = list.filter(e =>
                e.path.toLowerCase().includes(this._searchQuery) ||
                (e.summary ?? "").toLowerCase().includes(this._searchQuery)
            )
        }

        if (this._sortMode === "alpha") {
            list.sort((a, b) => a.path.localeCompare(b.path))
        }

        return list
    }

    private _groupByMethod(endpoints: ApiEndpoint[]): vscode.TreeItem[] {
        const methods = [...new Set(endpoints.map(e => e.method))]
        return methods.map(method => {
            const count = endpoints.filter(e => e.method === method).length
            return new MethodGroupItem(method, count)
        })
    }
}