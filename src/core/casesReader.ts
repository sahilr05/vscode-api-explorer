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
const RELATIVE_PATH = [".api-explorer", "cases.json"]

export function readAllCases(projectDir: string): Record<string, TestCase[]> {
    try {
        const file   = path.join(projectDir, ...RELATIVE_PATH)
        const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
        return parsed?.cases ?? {}
    } catch {
        return {}
    }
}

export function listCasesFor(projectDir: string, endpointKey: string): TestCase[] {
    return readAllCases(projectDir)[endpointKey] ?? []
}
