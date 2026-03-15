import * as vscode from 'vscode'
import { ApiEndpoint } from '../types/endpoint'

const METHOD_COLORS: Record<string, string> = {
    GET:    "charts.green",
    POST:   "charts.blue",
    PUT:    "charts.yellow",
    DELETE: "charts.red",
    PATCH:  "charts.purple",
}

const METHOD_ICONS: Record<string, string> = {
    GET:    "arrow-down",
    POST:   "add",
    PUT:    "edit",
    DELETE: "trash",
    PATCH:  "tools",
}

const SKIP_SEGMENTS = new Set(["api", "v1", "v2", "v3", "v4", "rest", "graphql"])

export type GroupMode = "method" | "module"
export type SortMode  = "default" | "alpha"

export class EndpointTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    private _endpoints:     ApiEndpoint[] = []
    private _searchQuery:   string        = ""
    private _groupMode:     GroupMode     = "method"
    private _sortMode:      SortMode      = "default"
    private _methodFilters: Set<string>   = new Set()

    private _onDidChangeTreeData = new vscode.EventEmitter<void>()
    readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event

    constructor(initialEndpoints: ApiEndpoint[]) {
        this._endpoints = initialEndpoints
    }

    setEndpoints(endpoints: ApiEndpoint[]) {
        this._endpoints = endpoints
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
    }

    setMethodFilters(methods: Set<string>) {
        this._methodFilters = methods
        this._onDidChangeTreeData.fire()
    }

    get groupMode():     GroupMode   { return this._groupMode }
    get sortMode():      SortMode    { return this._sortMode }
    get methodFilters(): Set<string> { return this._methodFilters }

    refresh(): void { this._onDidChangeTreeData.fire() }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem { return element }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {

        if (!element && this._endpoints.length === 0) {
            return [new InfoItem("No endpoints loaded", "loading~spin")]
        }

        if (!element) {
            const visible = this._visibleEndpoints()
            if (visible.length === 0 && this._searchQuery) {
                return [new InfoItem(`No matches for "${this._searchQuery}"`, "search")]
            }
            if (visible.length === 0 && this._methodFilters.size > 0) {
                return [new InfoItem("No endpoints match the active filter", "filter")]
            }
            return this._groupMode === "method"
                ? this._groupByMethod(visible)
                : this._groupByModule(visible)
        }

        if (element instanceof MethodGroupItem) {
            return this._visibleEndpoints()
                .filter(e => e.method === element.method)
                .map(e => new EndpointItem(e))
        }

        if (element instanceof ModuleGroupItem) {
            return this._visibleEndpoints()
                .filter(e => inferModule(e.path) === element.moduleName)
                .map(e => new EndpointItem(e))
        }

        return []
    }

    private _visibleEndpoints(): ApiEndpoint[] {
        let list = [...this._endpoints]

        if (this._methodFilters.size > 0) {
            list = list.filter(e => this._methodFilters.has(e.method))
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

    private _groupByModule(endpoints: ApiEndpoint[]): vscode.TreeItem[] {
        const moduleMap = new Map<string, number>()
        for (const e of endpoints) {
            const mod = inferModule(e.path)
            moduleMap.set(mod, (moduleMap.get(mod) ?? 0) + 1)
        }

        const keys = [...moduleMap.keys()]
        if (keys.length === 1 && keys[0] === "other") {
            return [
                new InfoItem("No modules detected — paths have no named segments", "info"),
                ...this._groupByMethod(endpoints)
            ]
        }

        // Apply sort within module groups too
        const sortedKeys = this._sortMode === "alpha" ? keys.sort() : keys
        return sortedKeys.map(mod => new ModuleGroupItem(mod, moduleMap.get(mod)!))
    }
}

// ── Tree items ────────────────────────────────────────────────────────────────

class MethodGroupItem extends vscode.TreeItem {
    constructor(public readonly method: string, count: number) {
        super(method, vscode.TreeItemCollapsibleState.Expanded)
        this.description  = `${count}`
        this.tooltip      = `${method} — ${count} endpoint${count !== 1 ? "s" : ""}`
        this.iconPath     = new vscode.ThemeIcon(
            METHOD_ICONS[method] ?? "symbol-method",
            new vscode.ThemeColor(METHOD_COLORS[method] ?? "foreground")
        )
        this.contextValue = "methodGroup"
    }
}

class ModuleGroupItem extends vscode.TreeItem {
    constructor(public readonly moduleName: string, count: number) {
        super(moduleName, vscode.TreeItemCollapsibleState.Expanded)
        this.description  = `${count}`
        this.tooltip      = `${moduleName} — ${count} endpoint${count !== 1 ? "s" : ""}`
        this.iconPath     = new vscode.ThemeIcon("folder")
        this.contextValue = "moduleGroup"
    }
}

class EndpointItem extends vscode.TreeItem {
    constructor(public readonly endpoint: ApiEndpoint) {
        super(endpoint.path, vscode.TreeItemCollapsibleState.None)
        this.description = endpoint.summary || endpoint.method
        this.tooltip     = new vscode.MarkdownString(
            `**${endpoint.method}** \`${endpoint.path}\`` +
            (endpoint.summary     ? `\n\n${endpoint.summary}` : "") +
            (endpoint.operationId ? `\n\n*operationId: \`${endpoint.operationId}\`*` : "")
        )
        this.iconPath = new vscode.ThemeIcon(
            "circle-small-filled",
            new vscode.ThemeColor(METHOD_COLORS[endpoint.method] ?? "foreground")
        )
        this.command = {
            command:   "apiExplorer.openRequest",
            title:     "Open Request",
            arguments: [endpoint],
        }
        // "endpoint" context shows the Go to Source item in the right-click menu
        // "endpointWithSource" shows it AND the inline icon
        this.contextValue = endpoint.operationId ? "endpointWithSource" : "endpoint"
    }
}

class InfoItem extends vscode.TreeItem {
    constructor(message: string, icon: string) {
        super(message, vscode.TreeItemCollapsibleState.None)
        this.iconPath     = new vscode.ThemeIcon(icon)
        this.contextValue = "info"
    }
}

export function inferModule(path: string): string {
    const segments = path.split("/").filter(Boolean)
    for (const seg of segments) {
        if (SKIP_SEGMENTS.has(seg.toLowerCase())) continue
        if (seg.startsWith("{")) continue
        if (/^v\d+$/i.test(seg)) continue
        return seg.toLowerCase()
    }
    return "other"
}