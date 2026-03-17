import * as vscode from 'vscode'
import { EndpointTreeProvider } from './explorer/endpointTreeProvider'
import { OpenApiLoader }        from './openapi/openApiLoader'
import { OpenApiParser }        from './openapi/openApiParser'
import { RequestPanel }         from './request/requestPanel'
import { ConfigManager }        from './config/configManager'
import { ConfigPanel }          from './config/webview/configPanel'
import { StatusBarManager }     from './statusBar/statusBarManager'
import { HistoryManager }       from './history/historyManager'
import { HistoryTreeProvider }  from './history/historyTreeProvider'
import { goToSource }           from './navigation/sourceNavigator'
import { ApiEndpoint }          from './types/endpoint'

const ALL_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

export function activate(context: vscode.ExtensionContext) {

    const config       = new ConfigManager(context)
    const history      = new HistoryManager(context)
    const treeProvider = new EndpointTreeProvider([])
    const histProvider = new HistoryTreeProvider(history)
    const statusBar = new StatusBarManager(config, context)

    // ── Version update notification ───────────────────────────────────────────
    const currentVersion = vscode.extensions.getExtension('sahilrajpal.api-explorer')?.packageJSON?.version
    const lastVersion    = context.globalState.get<string>('apiExplorer.lastVersion')

    if (currentVersion && lastVersion && currentVersion !== lastVersion) {
        vscode.window.showInformationMessage(
            `API Explorer updated to v${currentVersion} — Auth headers, default headers, and project config panel added. Click the ⚙ icon in the sidebar to set up.`,
            'Open Config'
        ).then(action => {
            if (action === 'Open Config') {
                vscode.commands.executeCommand('apiExplorer.openConfig')
            }
        })
    }

    if (currentVersion) {
        context.globalState.update('apiExplorer.lastVersion', currentVersion)
    }

    vscode.window.registerTreeDataProvider('apiExplorer.endpoints', treeProvider)
    vscode.window.registerTreeDataProvider('apiExplorer.history',   histProvider)

    // ── Load endpoints ────────────────────────────────────────────────────────
    const loadEndpoints = async () => {
        statusBar.setLoading()
        try {
            const spec      = await OpenApiLoader.fetchSpec(config.openApiUrl)
            const endpoints = OpenApiParser.parse(spec)
            treeProvider.setEndpoints(endpoints)
            statusBar.setConnected(endpoints.length)
        } catch (err: any) {
            treeProvider.setEndpoints([])
            statusBar.setError()
            vscode.window.showErrorMessage(
                `API Explorer: Could not reach ${config.openApiUrl}. Is your server running?`
            )
        }
    }

    loadEndpoints()

    // Re-load when base URL changes from config panel
    config.onDidChange(() => loadEndpoints())

    // ── Config panel ──────────────────────────────────────────────────────────
    const openConfigCommand = vscode.commands.registerCommand(
        'apiExplorer.openConfig',
        () => ConfigPanel.open(context, config, loadEndpoints)
    )

    // ── Search ────────────────────────────────────────────────────────────────
    let activeSearch: vscode.InputBox | undefined

    const searchCommand = vscode.commands.registerCommand('apiExplorer.search', () => {
        if (activeSearch) { activeSearch.show(); return }
        const box = vscode.window.createInputBox()
        box.placeholder = "Search endpoints by path or description…"
        box.onDidChangeValue(value => {
            treeProvider.setSearchQuery(value)
            vscode.commands.executeCommand('setContext', 'apiExplorer.searchActive', value.length > 0)
        })
        box.onDidAccept(() => box.hide())
        box.onDidHide(() => { activeSearch = undefined })
        activeSearch = box
        box.show()
    })

    const clearSearchCommand = vscode.commands.registerCommand('apiExplorer.clearSearch', () => {
        treeProvider.setSearchQuery("")
        activeSearch?.dispose()
        activeSearch = undefined
        vscode.commands.executeCommand('setContext', 'apiExplorer.searchActive', false)
    })

    // ── Core commands ─────────────────────────────────────────────────────────
    const refreshCommand = vscode.commands.registerCommand(
        'apiExplorer.refresh', loadEndpoints
    )

    const changeBaseUrlCommand = vscode.commands.registerCommand(
        'apiExplorer.changeBaseUrl',
        async () => {
            const changed = await config.promptChange()
            if (changed) loadEndpoints()
        }
    )

    const openRequestCommand = vscode.commands.registerCommand(
        'apiExplorer.openRequest',
        (endpoint: ApiEndpoint) => RequestPanel.create(endpoint, context, config, history)
    )

    const openFromHistoryCommand = vscode.commands.registerCommand(
        'apiExplorer.openFromHistory',
        (entry) => {
            const endpoint: ApiEndpoint = {
                method:  entry.method,
                path:    entry.path,
                summary: `From history — ${entry.status} ${entry.statusText}`,
            }
            RequestPanel.create(endpoint, context, config, history, {
                requestBody:  entry.body,
                responseBody: entry.responseBody,
                status:       entry.status,
                statusText:   entry.statusText,
                elapsed:      entry.elapsed,
            }, entry.id)
        }
    )

    const clearHistoryCommand = vscode.commands.registerCommand(
        'apiExplorer.clearHistory',
        async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Clear all request history for this workspace?',
                { modal: true }, 'Clear'
            )
            if (confirm === 'Clear') history.clear()
        }
    )

    // ── Source navigation ─────────────────────────────────────────────────────
    const goToSourceCommand = vscode.commands.registerCommand(
        'apiExplorer.goToSource',
        (item: any) => {
            const endpoint: ApiEndpoint = item?.endpoint ?? item
            goToSource(endpoint)
        }
    )

    // ── Grouping / filter / sort ──────────────────────────────────────────────
    const groupByMethodCommand = vscode.commands.registerCommand(
        'apiExplorer.groupByMethod',
        () => {
            treeProvider.setGroupMode("method")
            vscode.commands.executeCommand('setContext', 'apiExplorer.groupMode', 'method')
        }
    )

    const groupByModuleCommand = vscode.commands.registerCommand(
        'apiExplorer.groupByModule',
        () => {
            treeProvider.setGroupMode("module")
            vscode.commands.executeCommand('setContext', 'apiExplorer.groupMode', 'module')
        }
    )

    const filterMethodCommand = vscode.commands.registerCommand(
        'apiExplorer.filterByMethod',
        async () => {
            const current = treeProvider.methodFilters
            const items   = ALL_METHODS.map(m => ({
                label:  m,
                picked: current.size === 0 ? true : current.has(m),
            }))
            const picked = await vscode.window.showQuickPick(items, {
                canPickMany: true,
                title:       "Filter by HTTP Method",
                placeHolder: "Select methods to show (all = no filter)",
            })
            if (!picked) return
            treeProvider.setMethodFilters(
                picked.length === ALL_METHODS.length || picked.length === 0
                    ? new Set()
                    : new Set(picked.map(p => p.label))
            )
        }
    )

    const filterModuleCommand = vscode.commands.registerCommand(
        'apiExplorer.filterByModule',
        async () => {
            const allModules = treeProvider.allModules
            if (allModules.length === 0) {
                vscode.window.showInformationMessage('API Explorer: No modules detected yet.')
                return
            }
            const current = treeProvider.moduleFilters
            const items   = allModules.map(m => ({
                label:  m,
                picked: current.size === 0 ? true : current.has(m),
            }))
            const picked = await vscode.window.showQuickPick(items, {
                canPickMany: true,
                title:       "Filter by Module",
                placeHolder: "Select modules to show (all = no filter)",
            })
            if (!picked) return
            treeProvider.setModuleFilters(
                picked.length === allModules.length || picked.length === 0
                    ? new Set()
                    : new Set(picked.map(p => p.label))
            )
        }
    )

    const toggleSortCommand = vscode.commands.registerCommand(
        'apiExplorer.toggleSort',
        () => {
            const next = treeProvider.sortMode === "default" ? "alpha" : "default"
            treeProvider.setSortMode(next)
            vscode.window.showInformationMessage(
                `API Explorer: Sorted ${next === "alpha" ? "A → Z" : "by spec order"}`
            )
        }
    )

    // ── Initial context ───────────────────────────────────────────────────────
    vscode.commands.executeCommand('setContext', 'apiExplorer.groupMode', 'module')
    vscode.commands.executeCommand('setContext', 'apiExplorer.searchActive', false)

    context.subscriptions.push(
        openConfigCommand,
        searchCommand, clearSearchCommand,
        refreshCommand, changeBaseUrlCommand,
        openRequestCommand, openFromHistoryCommand, clearHistoryCommand,
        goToSourceCommand,
        groupByMethodCommand, groupByModuleCommand,
        filterMethodCommand, filterModuleCommand,
        toggleSortCommand,
        config,
    )
}