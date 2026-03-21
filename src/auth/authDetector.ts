/**
 * authDetector.ts
 * Detects whether an endpoint is likely an auth endpoint
 * based on path patterns and response body structure.
 */

import { ApiEndpoint } from '../types/endpoint'
import { extractToken } from './tokenExtractor'

// Path segments that strongly suggest an auth endpoint
const AUTH_PATH_PATTERNS = [
    '/login',
    '/signin',
    '/sign-in',
    '/auth/token',
    '/auth/login',
    '/auth/signin',
    '/authenticate',
    '/token',
    '/oauth/token',
    '/api/token',
]

/**
 * Returns true if the endpoint path matches a known auth pattern.
 */
export function looksLikeAuthEndpoint(endpoint: ApiEndpoint): boolean {
    const path = endpoint.path.toLowerCase()
    // Only POST/PUT make sense for login
    if (!['POST', 'PUT'].includes(endpoint.method)) return false
    return AUTH_PATH_PATTERNS.some(pattern => path.includes(pattern))
}

/**
 * Returns true if the response body looks like it contains an auth token.
 * Used as a secondary signal even if the path doesn't match.
 */
export function responseHasToken(body: any): boolean {
    return extractToken(body) !== undefined
}

/**
 * Combined check — returns true if we should prompt the user.
 * Either path OR response structure match is sufficient.
 */
export function shouldPromptForToken(
    endpoint: ApiEndpoint,
    responseBody: any
): boolean {
    return looksLikeAuthEndpoint(endpoint) || responseHasToken(responseBody)
}