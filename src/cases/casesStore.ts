/**
 * casesStore.ts
 * Persists named test cases as small, git-committable workspace files under
 *   .api-explorer/cases/<module>.json
 *
 * Why per-module files (not one cases.json): a single shared file means two
 * teammates editing DIFFERENT endpoints still collide in the same file on merge.
 * Splitting by module (the first path segment) keeps independent work in
 * independent files, so conflicts only happen when two people genuinely edit the
 * same module's cases. The full "METHOD:path" key is stored inside each file, so a
 * slug collision is harmless (two modules just share a file; no data is lost).
 *
 * The anti-drift principle is unchanged: we store ONLY the human's input (body +
 * param values + a name) keyed by "METHOD:path". The schema, URL, and response are
 * always derived from the live spec, so there is nothing to drift.
 *
 * Migration: older projects have a single `.api-explorer/cases.json`. We read both
 * formats (legacy + per-module), and on first load we split the legacy file into
 * per-module files and delete it (read-both / write-new).
 */

import * as vscode from 'vscode'
import { TestCase } from '../core/types'

export type { TestCase }

const DIR_PARTS    = ['.api-explorer', 'cases']        // new: per-module files live here
const LEGACY_PARTS = ['.api-explorer', 'cases.json']   // old: single file (migrated away)

// Which per-module file a "METHOD:path" key belongs to: the first path segment.
function moduleSlug(endpointKey: string): string {
    const path = endpointKey.slice(endpointKey.indexOf(':') + 1)
    const seg  = path.split('/').filter(Boolean)[0] ?? ''
    return seg.replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase() || '_root'
}

// Stable, sorted serialization so independent edits diff and merge cleanly.
function serialize(cases: Record<string, TestCase[]>): string {
    const sorted: Record<string, TestCase[]> = {}
    for (const k of Object.keys(cases).sort()) sorted[k] = cases[k]
    return JSON.stringify({ version: 2, cases: sorted }, null, 2) + '\n'
}

export class CasesStore {

    private _cases:  Record<string, TestCase[]> = {}
    private _loadPromise: Promise<void> | undefined

    private _onDidChange = new vscode.EventEmitter<void>()
    readonly onDidChange: vscode.Event<void> = this._onDidChange.event

    // True only when a workspace folder is open - case saving is disabled otherwise.
    get available(): boolean {
        return !!vscode.workspace.workspaceFolders?.length
    }

    private get _root(): vscode.Uri | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri
    }
    private _dirUri(root: vscode.Uri)             { return vscode.Uri.joinPath(root, ...DIR_PARTS) }
    private _legacyUri(root: vscode.Uri)          { return vscode.Uri.joinPath(root, ...LEGACY_PARTS) }
    private _moduleUri(root: vscode.Uri, s: string) { return vscode.Uri.joinPath(root, ...DIR_PARTS, `${s}.json`) }

    // ── Load (read-both) + one-time migration ─────────────────────────────────────

    // Single-flight: every caller awaits the SAME load promise, so a save() can never
    // run on half-loaded state while the migration is still in flight (that race
    // overwrote freshly-saved cases with the legacy file during migration).
    private _load(): Promise<void> {
        if (!this._loadPromise) this._loadPromise = this._doLoad()
        return this._loadPromise
    }

    private async _doLoad(): Promise<void> {
        const root = this._root
        if (!root) return

        const merged: Record<string, TestCase[]> = {}

        // Legacy single file first, so new per-module files win on any overlap.
        let legacyCount = 0
        try {
            const b = await vscode.workspace.fs.readFile(this._legacyUri(root))
            const p = JSON.parse(Buffer.from(b).toString('utf8'))
            if (p?.cases) { Object.assign(merged, p.cases); legacyCount = Object.keys(p.cases).length }
        } catch { /* no legacy file */ }

        // New per-module files.
        try {
            for (const [name, type] of await vscode.workspace.fs.readDirectory(this._dirUri(root))) {
                if (type !== vscode.FileType.File || !name.endsWith('.json')) continue
                try {
                    const b = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(this._dirUri(root), name))
                    const p = JSON.parse(Buffer.from(b).toString('utf8'))
                    if (p?.cases) Object.assign(merged, p.cases)
                } catch { /* skip an unreadable file */ }
            }
        } catch { /* dir does not exist yet */ }

        this._cases = merged

        // One-time migration: split the legacy file into per-module files, then drop it.
        // Non-destructive on failure: if the split fails we keep the legacy file, so
        // read-both still serves the data and nothing is lost.
        if (legacyCount > 0) {
            try {
                await this._persistAll()
                await vscode.workspace.fs.delete(this._legacyUri(root))
            } catch { /* leave the legacy file in place; no data lost */ }
        }
    }

    // Rewrite every module file from memory (migration).
    private async _persistAll(): Promise<void> {
        const root = this._root
        if (!root) return
        const slugs = new Set(Object.keys(this._cases).map(moduleSlug))
        for (const slug of slugs) await this._writeModule(root, slug)
    }

    // Rewrite the file for one module (or delete it when it becomes empty).
    private async _writeModule(root: vscode.Uri, slug: string): Promise<void> {
        const subset: Record<string, TestCase[]> = {}
        for (const [key, list] of Object.entries(this._cases)) {
            if (moduleSlug(key) === slug) subset[key] = list
        }
        const uri = this._moduleUri(root, slug)
        if (Object.keys(subset).length === 0) {
            try { await vscode.workspace.fs.delete(uri) } catch { /* already gone */ }
        } else {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(serialize(subset), 'utf8'))
        }
    }

    private async _persistModule(slug: string): Promise<void> {
        const root = this._root
        if (!root) return
        await this._writeModule(root, slug)
        this._onDidChange.fire()
    }

    // ── Public API (signatures unchanged) ─────────────────────────────────────────

    async list(endpointKey: string): Promise<TestCase[]> {
        await this._load()
        return this._cases[endpointKey] ?? []
    }

    async get(endpointKey: string, name: string): Promise<TestCase | undefined> {
        await this._load()
        return (this._cases[endpointKey] ?? []).find(c => c.name === name)
    }

    // Upsert by name - saving a case with an existing name overwrites it.
    async save(endpointKey: string, testCase: TestCase): Promise<void> {
        await this._load()
        const existing = this._cases[endpointKey] ?? []
        const idx      = existing.findIndex(c => c.name === testCase.name)

        if (idx === -1) existing.push(testCase)
        else            existing[idx] = testCase

        this._cases[endpointKey] = existing
        await this._persistModule(moduleSlug(endpointKey))
    }

    async delete(endpointKey: string, name: string): Promise<void> {
        await this._load()
        const existing = this._cases[endpointKey]
        if (!existing) return

        const filtered = existing.filter(c => c.name !== name)
        if (filtered.length > 0) this._cases[endpointKey] = filtered
        else                     delete this._cases[endpointKey]

        await this._persistModule(moduleSlug(endpointKey))
    }

    dispose() { this._onDidChange.dispose() }
}
