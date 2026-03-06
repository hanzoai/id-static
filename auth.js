/**
 * HanzoAuth — Zero-dependency PKCE OAuth2 client
 *
 * Works with any RFC 6749 / OIDC compliant provider.
 * Designed for static sites — publishable client_id only, no backend needed.
 *
 * Usage:
 *   HanzoAuth.init({ issuer: 'https://hanzo.id', clientId: 'app-hanzo' })
 *   HanzoAuth.startPKCE()                    // redirect to authorize
 *   HanzoAuth.handleCallback(searchParams)    // exchange code for tokens
 *   HanzoAuth.passwordLogin(email, password)  // resource owner password
 *   HanzoAuth.refreshToken(refreshToken)      // refresh access token
 *   HanzoAuth.logout()                        // clear tokens + redirect
 */
;(function (root) {
  'use strict'

  let _config = {
    issuer: 'https://hanzo.id',
    clientId: 'app-hanzo',
    redirectUri: location.origin + location.pathname,
    scope: 'openid profile email',
  }

  // --- PKCE helpers ---

  function base64url(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  function generateVerifier() {
    const buf = new Uint8Array(32)
    crypto.getRandomValues(buf)
    return base64url(buf)
  }

  async function generateChallenge(verifier) {
    const encoded = new TextEncoder().encode(verifier)
    const digest = await crypto.subtle.digest('SHA-256', encoded)
    return base64url(digest)
  }

  // --- Discovery ---

  let _discoveryCache = null

  async function discover() {
    if (_discoveryCache) return _discoveryCache
    const res = await fetch(`${_config.issuer}/.well-known/openid-configuration`)
    _discoveryCache = await res.json()
    return _discoveryCache
  }

  // --- Public API ---

  const HanzoAuth = {
    init(opts) {
      Object.assign(_config, opts)
      _discoveryCache = null
      return _config
    },

    getConfig() {
      return { ..._config }
    },

    /**
     * Start PKCE authorization code flow.
     * Generates verifier+challenge, stores verifier, redirects to authorize.
     */
    async startPKCE() {
      const verifier = generateVerifier()
      const challenge = await generateChallenge(verifier)
      sessionStorage.setItem('hanzo_pkce_verifier', verifier)

      const disc = await discover()
      const authUrl = new URL(disc.authorization_endpoint)
      authUrl.searchParams.set('client_id', _config.clientId)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('redirect_uri', _config.redirectUri)
      authUrl.searchParams.set('scope', _config.scope)
      authUrl.searchParams.set('code_challenge', challenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      authUrl.searchParams.set('state', generateVerifier().slice(0, 16))

      location.href = authUrl.toString()
    },

    /**
     * Handle the callback after authorize redirect.
     * Exchanges authorization code for tokens using PKCE verifier.
     */
    async handleCallback(searchParams) {
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      if (error) return { error, error_description: searchParams.get('error_description') }
      if (!code) return { error: 'no_code', error_description: 'No authorization code in callback' }

      const verifier = sessionStorage.getItem('hanzo_pkce_verifier')
      sessionStorage.removeItem('hanzo_pkce_verifier')

      const disc = await discover()
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: _config.clientId,
        redirect_uri: _config.redirectUri,
      })
      if (verifier) body.set('code_verifier', verifier)

      const res = await fetch(disc.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      return res.json()
    },

    /**
     * Resource Owner Password Credentials grant.
     * Works when the IAM app has `password` in grant_types.
     */
    async passwordLogin(username, password) {
      const disc = await discover()
      const body = new URLSearchParams({
        grant_type: 'password',
        username,
        password,
        client_id: _config.clientId,
        scope: _config.scope,
      })
      const res = await fetch(disc.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      return res.json()
    },

    /**
     * Refresh an access token.
     */
    async refreshToken(token) {
      const disc = await discover()
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token,
        client_id: _config.clientId,
      })
      const res = await fetch(disc.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      return res.json()
    },

    /**
     * Fetch user info from the OIDC userinfo endpoint.
     */
    async getUserInfo(accessToken) {
      const disc = await discover()
      const res = await fetch(disc.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      return res.json()
    },

    /**
     * Clear stored tokens and optionally redirect to logout.
     */
    async logout(opts = {}) {
      const accessToken = localStorage.getItem('hanzo_access_token')
      localStorage.removeItem('hanzo_access_token')
      localStorage.removeItem('hanzo_refresh_token')
      localStorage.removeItem('hanzo_user')

      if (opts.redirect !== false) {
        const disc = await discover()
        if (disc.end_session_endpoint) {
          const logoutUrl = new URL(disc.end_session_endpoint)
          logoutUrl.searchParams.set('post_logout_redirect_uri', opts.postLogoutUri || location.origin)
          if (accessToken) logoutUrl.searchParams.set('id_token_hint', accessToken)
          location.href = logoutUrl.toString()
          return
        }
      }
    },

    /**
     * Check if user has a stored access token.
     */
    isAuthenticated() {
      return !!localStorage.getItem('hanzo_access_token')
    },

    /**
     * Get stored access token.
     */
    getAccessToken() {
      return localStorage.getItem('hanzo_access_token')
    },
  }

  root.HanzoAuth = HanzoAuth
})(globalThis)
