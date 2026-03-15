export class OpenApiLoader {

    static async fetchSpec(url: string): Promise<any> {

        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Failed to fetch OpenAPI spec (${response.status})`)
        }

        return await response.json()
    }

}