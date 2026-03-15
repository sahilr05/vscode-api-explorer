import * as vscode from 'vscode'

export interface HistoryEntry {
    id:           string
    method:       string
    path:         string
    url:          string
    status:       number
    statusText:   string
    elapsed:      number
    timestamp:    number
    body?:        string  // request body
    responseBody?: string // response body
}

const HISTORY_KEY    = 'apiExplorer.history'
const MAX_ENTRIES    = 50

export class HistoryManager {

    private _context: vscode.ExtensionContext
    private _onChange: vscode.EventEmitter<void>
    readonly onDidChange: vscode.Event<void>

    constructor(context: vscode.ExtensionContext) {
        this._context  = context
        this._onChange = new vscode.EventEmitter<void>()
        this.onDidChange = this._onChange.event
    }

    getAll(): HistoryEntry[] {
        return this._context.workspaceState.get<HistoryEntry[]>(HISTORY_KEY) ?? []
    }

    async add(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
        const all = this.getAll()

        const newEntry: HistoryEntry = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        }

        // Newest first, cap at MAX_ENTRIES
        const updated = [newEntry, ...all].slice(0, MAX_ENTRIES)
        await this._context.workspaceState.update(HISTORY_KEY, updated)
        this._onChange.fire()
    }

    async clear(): Promise<void> {
        await this._context.workspaceState.update(HISTORY_KEY, [])
        this._onChange.fire()
    }

    dispose() {
        this._onChange.dispose()
    }
}

// Formats timestamp as "2 min ago", "just now", "3h ago" etc.
export function timeAgo(timestamp: number): string {
    const diff = Date.now() - timestamp
    const sec  = Math.floor(diff / 1000)
    if (sec < 10)  return "just now"
    if (sec < 60)  return `${sec}s ago`
    const min = Math.floor(sec / 60)
    if (min < 60)  return `${min}m ago`
    const hr  = Math.floor(min / 60)
    if (hr  < 24)  return `${hr}h ago`
    return `${Math.floor(hr / 24)}d ago`
}