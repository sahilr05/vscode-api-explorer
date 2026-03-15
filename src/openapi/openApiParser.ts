import { ApiEndpoint } from "../types/endpoint"

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"]

export class OpenApiParser {

    static parse(spec: any): ApiEndpoint[] {
        const endpoints: ApiEndpoint[] = []
        if (!spec.paths) return endpoints

        const components = spec.components ?? {}

        for (const path in spec.paths) {
            const pathItem = spec.paths[path]

            for (const method in pathItem) {
                if (!HTTP_METHODS.includes(method)) continue

                const op = pathItem[method]

                endpoints.push({
                    method:      method.toUpperCase(),
                    path,
                    summary:     op.summary     || "",
                    operationId: op.operationId || undefined,
                    parameters:  op.parameters  || [],
                    requestBody: op.requestBody,
                    responses:   op.responses,
                    components,
                })
            }
        }

        return endpoints
    }
}