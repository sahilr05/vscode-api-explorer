/**
 * tokenExtractor.ts
 * Finds auth tokens in API responses and decodes JWT expiry.
 * Handles the most common response shapes across FastAPI and other frameworks.
 */

export interface ExtractedToken {
    token:     string
    expiresAt: number | undefined  // Unix timestamp ms, undefined if not JWT or no exp
}

// Common field names that contain auth tokens — ordered by likelihood
const TOKEN_FIELDS = [
    'access_token',
    'token',
    'jwt',
    'id_token',
    'auth_token',
    'bearer_token',
    'accessToken',
    'idToken',
    'authToken',
]

/**
 * Attempts to extract a token from a parsed response body.
 * Checks top-level fields first, then one level deep.
 * Returns undefined if no token found.
 */
export function extractToken(body: any): ExtractedToken | undefined {
    if (!body || typeof body !== 'object') return undefined

    // Check top-level fields
    for (const field of TOKEN_FIELDS) {
        if (typeof body[field] === 'string' && body[field].length > 10) {
            return {
                token:     body[field],
                expiresAt: decodeJwtExpiry(body[field]),
            }
        }
    }

    // Check one level deep (e.g. { data: { access_token: "..." } })
    for (const key of Object.keys(body)) {
        const nested = body[key]
        if (nested && typeof nested === 'object') {
            for (const field of TOKEN_FIELDS) {
                if (typeof nested[field] === 'string' && nested[field].length > 10) {
                    return {
                        token:     nested[field],
                        expiresAt: decodeJwtExpiry(nested[field]),
                    }
                }
            }
        }
    }

    return undefined
}

/**
 * Decodes the exp claim from a JWT without any external library.
 * Returns undefined if the token is not a JWT or has no exp claim.
 */
export function decodeJwtExpiry(token: string): number | undefined {
    try {
        const parts = token.split('.')
        if (parts.length !== 3) return undefined

        // Base64url decode the payload
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const padded   = payload + '='.repeat((4 - payload.length % 4) % 4)
        const decoded  = Buffer.from(padded, 'base64').toString('utf8')
        const json     = JSON.parse(decoded)

        if (typeof json.exp === 'number') {
            return json.exp * 1000  // convert seconds → ms
        }
    } catch {
        // Not a JWT or malformed — that's fine
    }
    return undefined
}

/**
 * Returns a human-readable expiry string for display in the UI.
 * e.g. "expires in 23m", "expired 5m ago"
 */
export function formatExpiry(expiresAt: number | undefined): string {
    if (!expiresAt) return ''

    const diff = expiresAt - Date.now()
    const abs  = Math.abs(diff)
    const mins = Math.floor(abs / 60000)
    const hrs  = Math.floor(mins / 60)

    if (diff < 0) {
        return mins < 60
            ? `expired ${mins}m ago`
            : `expired ${hrs}h ago`
    }

    return mins < 60
        ? `expires in ${mins}m`
        : `expires in ${hrs}h`
}