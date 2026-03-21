/**
 * authStore.ts
 * Stores extracted auth tokens securely in VSCode SecretStorage.
 * Keyed by endpoint ("METHOD:path") so multiple auth endpoints are supported.
 */

import * as vscode from 'vscode'
import { ExtractedToken, formatExpiry } from './tokenExtractor'

export interface StoredToken extends ExtractedToken {
    endpointKey: string   // "METHOD:path" e.g. "POST:/auth/login"
    endpointPath: string  // just the path, for display
    storedAt:    number   // Date.now() when stored
}

const SECRET_KEY = 'apiExplorer.authTokens'

export class AuthStore {

    private _context: vscode.ExtensionContext
    private _onChange = new vscode.EventEmitter<void>()
    readonly onDidChange: vscode.Event<void> = this._onChange.event

    // In-memory cache — SecretStorage is async so we cache after first load
    private _tokens: Map<string, StoredToken> = new Map()
    private _loaded = false

    // Track which endpoints user said "don't ask again"
    private _ignored: Set<string>

    constructor(context: vscode.ExtensionContext) {
        this._context = context
        this._ignored = new Set(
            context.workspaceState.get<string[]>('apiExplorer.ignoredAuthEndpoints') ?? []
        )
    }

    async load(): Promise<void> {
        if (this._loaded) return
        try {
            const raw = await this._context.secrets.get(SECRET_KEY)
            if (raw) {
                const parsed = JSON.parse(raw) as StoredToken[]
                this._tokens = new Map(parsed.map(t => [t.endpointKey, t]))
            }
        } catch {}
        this._loaded = true
    }

    async save(token: StoredToken): Promise<void> {
        await this.load()
        this._tokens.set(token.endpointKey, token)
        await this._persist()
        this._onChange.fire()
    }

    async remove(endpointKey: string): Promise<void> {
        await this.load()
        this._tokens.delete(endpointKey)
        await this._persist()
        this._onChange.fire()
    }

    async getAll(): Promise<StoredToken[]> {
        await this.load()
        return [...this._tokens.values()]
    }

    async getForEndpoint(endpointKey: string): Promise<StoredToken | undefined> {
        await this.load()
        return this._tokens.get(endpointKey)
    }

    // Returns the best token to use for a request — prefers non-expired ones
    async getActiveToken(): Promise<StoredToken | undefined> {
        await this.load()
        const all    = [...this._tokens.values()]
        const valid  = all.filter(t => !t.expiresAt || t.expiresAt > Date.now())
        const expired = all.filter(t => t.expiresAt && t.expiresAt <= Date.now())

        // Prefer valid, fallback to most recently stored expired
        return valid[0] ?? expired.sort((a, b) => b.storedAt - a.storedAt)[0]
    }

    isIgnored(endpointKey: string): boolean {
        return this._ignored.has(endpointKey)
    }

    async ignore(endpointKey: string): Promise<void> {
        this._ignored.add(endpointKey)
        await this._context.workspaceState.update(
            'apiExplorer.ignoredAuthEndpoints',
            [...this._ignored]
        )
    }

    isAuthEndpoint(endpointKey: string): boolean {
        return this._tokens.has(endpointKey)
    }

    formatTokenStatus(token: StoredToken): string {
        if (!token.expiresAt) return 'Bearer (auto)'
        const expiry = formatExpiry(token.expiresAt)
        const expired = token.expiresAt <= Date.now()
        return expired
            ? `Bearer (${expiry})`
            : `Bearer (${expiry})`
    }

    private async _persist(): Promise<void> {
        const arr = [...this._tokens.values()]
        await this._context.secrets.store(SECRET_KEY, JSON.stringify(arr))
    }

    dispose() { this._onChange.dispose() }
}