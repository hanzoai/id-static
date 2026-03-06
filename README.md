# Hanzo ID — Static Login Template

Zero-dependency, static HTML login page with PKCE OAuth2. No backend needed — just a publishable `client_id`.

## Quick Start

1. Set your IAM provider and client ID:

```html
<script>
  HanzoAuth.init({
    issuer: 'https://hanzo.id',      // Your OIDC provider
    clientId: 'app-hanzo',            // Publishable client ID
    redirectUri: location.origin + '/index.html',
  })
</script>
```

2. Deploy anywhere — GitHub Pages, Netlify, CF Pages, S3, or just open `index.html`.

## How It Works

- **SSO button**: Starts PKCE authorization code flow (RFC 7636)
- **Email/password**: Uses Resource Owner Password grant
- **Token storage**: `localStorage` (`hanzo_access_token`, `hanzo_refresh_token`)
- **Auto-discovery**: Fetches `/.well-known/openid-configuration` from the issuer

## id.js API

```js
HanzoAuth.init({ issuer, clientId, redirectUri, scope })
HanzoAuth.startPKCE()                      // Redirect to authorize
HanzoAuth.handleCallback(searchParams)      // Exchange code → tokens
HanzoAuth.passwordLogin(email, password)    // Password grant
HanzoAuth.refreshToken(token)               // Refresh access token
HanzoAuth.getUserInfo(accessToken)          // Fetch user profile
HanzoAuth.logout({ postLogoutUri })         // Clear + redirect
HanzoAuth.isAuthenticated()                 // Check token exists
HanzoAuth.getAccessToken()                  // Get stored token
```

## Configuration

Set via JavaScript, URL params, or global variables:

| Method | Example |
|--------|---------|
| JS | `HanzoAuth.init({ issuer: '...' })` |
| URL | `?issuer=https://hanzo.id&client_id=app-hanzo` |
| Global | `window.HANZO_ISSUER = 'https://hanzo.id'` |

## Deploy to Cloudflare Pages

```bash
npx wrangler pages deploy . --project-name my-login
```

## Files

| File | Size | Purpose |
|------|------|---------|
| `index.html` | ~4KB | Login page with SSO + email/password |
| `id.js` | ~4KB | PKCE OAuth2 client (zero deps) |

## License

MIT
