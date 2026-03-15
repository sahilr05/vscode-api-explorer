import { SchemaComponents } from "../openapi/schemaResolver"

export interface ApiEndpoint {
    method:       string
    path:         string
    summary?:     string
    operationId?: string       // e.g. "create_item_module_a__post" — used for source navigation
    parameters?:  any[]
    requestBody?: any
    responses?:   any
    components?:  SchemaComponents
}