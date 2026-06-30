/**
 * core/casesReader.ts
 * vscode-free, read-only access to the committed cases file, for the MCP server.
 *
 * The extension's CasesStore writes this file via vscode.workspace.fs; the MCP
 * server (a plain Node process in the project dir) reads the very same file with
 * fs, so saved cases are shared across both surfaces with no duplicated state.
 */

import * as fs   from "fs"
import * as path from "path"
import { TestCase } from "./types"

// NOTE: still `.api-explorer/` to match what shipped extensions write. The rename
// to `.zerk/` is a deliberate, separate migration (read-both / write-new).
const DIR        = ".api-explorer"
const LEGACY     = "cases.json"     // old single file (still read for un-migrated repos)
const CASES_DIR  = "cases"          // new per-module files: .api-explorer/cases/<module>.json

// Read-both: merge the legacy single file with the new per-module files, so a repo
// works whether or not it has been migrated. Per-module files win on any overlap.
export function readAllCases(projectDir: string): Record<string, TestCase[]> {
    const merged: Record<string, TestCase[]> = {}

    try {
        const parsed = JSON.parse(fs.readFileSync(path.join(projectDir, DIR, LEGACY), "utf8"))
        if (parsed?.cases) Object.assign(merged, parsed.cases)
    } catch { /* no legacy file */ }

    try {
        const dir = path.join(projectDir, DIR, CASES_DIR)
        for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith(".json")) continue
            try {
                const parsed = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))
                if (parsed?.cases) Object.assign(merged, parsed.cases)
            } catch { /* skip unreadable file */ }
        }
    } catch { /* dir does not exist */ }

    return merged
}

export function listCasesFor(projectDir: string, endpointKey: string): TestCase[] {
    return readAllCases(projectDir)[endpointKey] ?? []
}
