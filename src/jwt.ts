/**
 * JWT utilities for session token management
 * Uses Web Crypto API (no external dependencies)
 */

export interface JWTPayload {
  sub: string;           // subject (session identifier)
  iat: number;           // issued at (unix timestamp)
  exp: number;           // expiration (unix timestamp)
  sessionId: string;     // unique session identifier
}

/**
 * Generate a random session ID
 */
export function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create and sign a JWT using HMAC-SHA256
 * @param payload - JWT payload
 * @param secret - Signing secret (from environment)
 * @returns Base64url-encoded JWT string
 */
export async function signJWT(payload: JWTPayload, secret: string): Promise<string> {
  // Create header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  // Sign with HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );

  // Return JWT
  const encodedSignature = base64UrlEncode(signature);
  return `${data}.${encodedSignature}`;
}

/**
 * Verify and decode a JWT
 * @param token - JWT string
 * @param secret - Signing secret (from environment)
 * @returns Decoded payload if valid, null otherwise
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;

    // Import key
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Verify signature
    const signature = base64UrlDecode(encodedSignature);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(data)
    );

    if (!valid) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload))
    ) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null; // Token expired
    }

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Base64url encode (without padding)
 */
function base64UrlEncode(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' 
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64url decode
 */
function base64UrlDecode(input: string): Uint8Array {
  // Add padding if needed
  const padded = input + '=='.substring(0, (4 - input.length % 4) % 4);
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
