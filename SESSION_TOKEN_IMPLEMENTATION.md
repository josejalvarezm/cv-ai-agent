# JWT Session Token Implementation

## Overview
This document describes the JWT-based session token system implemented to replace per-message Turnstile token validation. This approach fixes mobile timeout issues while maintaining security.

## Architecture

### Flow
1. **Initial Load**: User visits MyCV, clicks chatbot → Turnstile challenge appears
2. **Token Exchange**: Chatbot iframe loads with Turnstile token → calls `POST /session` → receives JWT
3. **Query Phase**: All chat messages use JWT in `Authorization: Bearer <token>` header
4. **Expiration**: After 15 minutes, session expires → user must refresh page for new Turnstile challenge

### Security Model
- **Turnstile**: Validates human once at session start (5-minute TTL, single-use token)
- **JWT**: 15-minute session token for subsequent queries (prevents mobile postMessage timeouts)
- **HMAC-SHA256**: JWT signed with shared secret using Web Crypto API
- **Expiry Buffer**: 1-minute buffer before expiry triggers re-initialization

## Implementation Details

### Worker Side (`src/index.ts`)

#### New Endpoint: `POST /session`
```typescript
async function handleSession(request: Request, env: Env): Promise<Response> {
  const turnstileToken = request.headers.get('X-Turnstile-Token');
  // Validates Turnstile token via siteverify API
  // Returns JWT with 15-minute expiry
}
```

#### Updated Endpoint: `GET /query`
Now accepts **either**:
- `Authorization: Bearer <JWT>` (new)
- `X-Turnstile-Token: <token>` (backward compatible)

### Chatbot Side

#### ChatService (`src/app/services/chat.service.ts`)
```typescript
class ChatService {
  private sessionToken: string | null = null;
  private sessionExpiresAt: number = 0;

  initializeSession(turnstileToken: string): Observable<void>
  isSessionValid(): boolean
  clearSession(): void
  sendMessage(question: string): Observable<Message>
}
```

#### AppComponent (`src/app/app.component.ts`)
- `ngOnInit()`: Extracts Turnstile token from URL, calls `initializeSession()`
- `sendQuestion()`: Checks `isSessionValid()` before sending
- **Removed**: Old `requestFreshToken()` method and Turnstile token caching logic

## Deployment

### Prerequisites
1. **JWT Secret**: Strong random secret (32+ characters)
2. **Environment**: Production Worker environment configured

### Steps

#### 1. Set Worker Secret
```bash
# Production
wrangler secret put JWT_SECRET --env production

# Development (optional, for local testing)
wrangler secret put JWT_SECRET --env dev
```

When prompted, enter a strong random value:
```bash
# Example generation (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

#### 2. Deploy Worker
```bash
wrangler deploy --env production
```

#### 3. Deploy Chatbot
```bash
cd MyCVChatbot
ng build --configuration production
# Deploy dist/my-cv-chatbot to hosting
```

#### 4. Verify MyCV Integration
Ensure `MyCV` project still:
- Loads Turnstile script
- Passes token via iframe URL: `?turnstileToken=<token>`
- Listens for chatbot ready event

## Testing Checklist

### Local Testing
- [ ] Set `JWT_SECRET` in dev environment
- [ ] Run Worker locally: `wrangler dev`
- [ ] Run Chatbot locally: `ng serve`
- [ ] Test session initialization with valid Turnstile token
- [ ] Test queries with valid JWT
- [ ] Test session expiry (wait 15+ minutes or mock)
- [ ] Test invalid JWT returns 401

### Production Testing
- [ ] User completes Turnstile challenge
- [ ] Chatbot iframe loads successfully
- [ ] First message sends without errors
- [ ] Subsequent messages (2-20) work without Turnstile prompts
- [ ] Mobile users don't experience timeouts
- [ ] Session expires gracefully after 15 minutes
- [ ] Page refresh triggers new Turnstile challenge

## Troubleshooting

### "Failed to initialize session"
**Cause**: Turnstile validation failed or JWT signing failed
**Solution**: Check Worker logs, verify `JWT_SECRET` is set, ensure Turnstile token is valid

### "Session expired, please refresh the page"
**Cause**: JWT has expired (15+ minutes old)
**Solution**: User refreshes page → new Turnstile challenge → new session

### 401 Unauthorized Errors
**Cause**: Invalid or expired JWT
**Solution**: Chatbot should detect 401, clear session, show refresh prompt

### Worker Error: "JWT_SECRET not configured"
**Cause**: Missing environment secret
**Solution**: Run `wrangler secret put JWT_SECRET --env production`

## Security Considerations

### Token Lifetime Trade-offs
- **Turnstile**: 5-minute TTL enforced by Cloudflare (single-use)
- **JWT**: 15-minute TTL balances security and UX
- **Buffer**: 1-minute buffer prevents edge-case expirations

### Why Not Refresh Tokens?
- **Simplicity**: Page refresh is acceptable for chat sessions
- **Scope**: Chatbot is embedded, not a standalone SPA
- **Security**: Shorter sessions = smaller attack window

### CORS Configuration
Worker allows `Authorization` header from chatbot origin. Ensure `Access-Control-Allow-Headers` includes `Authorization`.

## Migration Notes

### Backward Compatibility
Worker still accepts `X-Turnstile-Token` header for clients that haven't upgraded. This allows gradual rollout.

### Breaking Changes
- **None**: Old Turnstile-only flow still works
- **Recommended**: Update all chatbot clients to use JWT sessions

## Related Files
- `src/jwt.ts`: JWT utilities (sign, verify, generate session ID)
- `src/index.ts`: Worker endpoints (/session, /query)
- `MyCVChatbot/src/app/services/chat.service.ts`: Session management
- `MyCVChatbot/src/app/app.component.ts`: Component integration

## Future Enhancements
- [ ] Configurable JWT expiry via environment variable
- [ ] Session activity tracking (analytics)
- [ ] Rate limiting per session (D1-backed)
- [ ] WebSocket support for real-time updates
