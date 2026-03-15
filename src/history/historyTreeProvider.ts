import * as vscode from 'vscode'
import { HistoryManager, HistoryEntry, timeAgo } from './historyManager'

const STATUS_ICON: Record<string, string> = {
    '2': 'pass',     // 2xx green
    '3': 'warning',  // 3xx yellow
    '4': 'error',    // 4xx orange
    '5': 'error',    // 5xx red
}

const STATUS_COLOR: Record<string, string> = {
    '2': 'testing.iconPassed',
    '3': 'list.warningForeground',
    '4': 'list.errorForeground',
    '5': 'list.errorForeground',
}

const METHOD_COLORS: Record<string, string> = {
    GET:    "charts.green",
    POST:   "charts.blue",
    PUT:    "charts.yellow",
    DELETE: "charts.red",
    PATCH:  "charts.purple",
}

export class HistoryTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<void>()
    readonly onDidChangeTreeData: vscode.Event<void> = this._onDidChangeTreeData.event

    constructor(private readonly history: HistoryManager) {
        // Refresh tree whenever history changes
        history.onDidChange(() => this._onDidChangeTreeData.fire())
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (element) return []

        const entries = this.history.getAll()

        if (entries.length === 0) {
            const empty = new vscode.TreeItem("No requests yet")
            empty.iconPath    = new vscode.ThemeIcon("history")
            empty.contextValue = "historyEmpty"
            return [empty]
        }

        return entries.map(e => new HistoryItem(e))
    }
}

class HistoryItem extends vscode.TreeItem {

    constructor(public readonly entry: HistoryEntry) {

        super(entry.path, vscode.TreeItemCollapsibleState.None)

        const statusKey = String(entry.status)[0]
        const ago       = timeAgo(entry.timestamp)

        // e.g. "POST  · 201 · 142ms · 2m ago"
        this.description = `${entry.method}  ·  ${entry.status}  ·  ${entry.elapsed}ms  ·  ${ago}`

        this.tooltip = new vscode.MarkdownString(
            `**${entry.method}** \`${entry.path}\`\n\n` +
            `Status: **${entry.status} ${entry.statusText}**  ·  ${entry.elapsed}ms\n\n` +
            `URL: \`${entry.url}\`\n\n` +
            (entry.body && entry.body !== '{}' && entry.body !== 'null'
                ? `**Request Body:**\n\`\`\`json\n${entry.body}\n\`\`\`\n\n`
                : '') +
            (entry.responseBody
                ? `**Response:**\n\`\`\`json\n${entry.responseBody.slice(0, 500)}${entry.responseBody.length > 500 ? '\n… (truncated)' : ''}\n\`\`\``
                : '')
        )
        this.tooltip.isTrusted = true

        this.iconPath = new vscode.ThemeIcon(
            STATUS_ICON[statusKey] ?? 'circle-outline',
            new vscode.ThemeColor(STATUS_COLOR[statusKey] ?? 'foreground')
        )

        // Clicking re-opens the request panel for this endpoint
        this.command = {
            command:   'apiExplorer.openFromHistory',
            title:     'Open Request',
            arguments: [entry],
        }

        this.contextValue = 'historyItem'
    }
}