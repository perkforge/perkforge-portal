# Security boundary

The browser receives only an opaque `__Host-portal` session identifier: Secure,
HttpOnly, SameSite=Lax, Path=/ and no Domain. Tokens stay in bounded process memory,
never local/session storage, cookies, URLs returned to the UI, or logs. Request
logging is disabled because callback URLs contain codes. Errors are generic.

`POST /auth/login` and `/auth/logout` require an exact Origin and synchronizer CSRF
token obtained from `/auth/session`. OIDC authorization code exchange uses S256
PKCE, random state and nonce, ID token validation, and same-subject access token
validation. Login transactions are consumed before exchange and expire in five
minutes. Successful login rotates the session. Return navigation is restricted to
`/`; arbitrary redirects are never accepted. Metadata/JWKS use verified HTTPS in
production. Tests alone inject a loopback provider.

Access tokens must use RS256, match issuer and API audience, carry sub/iat/exp,
match the portal's authorized client (`azp`), contain the API client role
`tenant-reader`, and contain a Home group (`/tenants/home/admins`, `developers`, or
`viewers`). Realm admin roles do not bypass these checks. Keycloak group and
client-role mappers plus API audience mapper must be separately reviewed/provisioned.

`GET /api/tenants` requires a bearer token and rejects cookie-only requests.
`GET /bff/tenants` translates the server-side session into a bearer-authenticated
same-process API request, traversing the same validation middleware. Every API
request validates the token signature and claims. Browser CORS is not enabled.

Sessions expire at the earlier of access-token expiry and 30 minutes. No refresh
or offline tokens are requested or stored. Anonymous sessions last ten minutes;
1000 total sessions bound memory and new sessions fail closed at capacity. Expired
entries are inaccessible and pruned on creation. Process restart signs everyone
out. This is intentionally single-process, single-replica storage. Rate limiting
bounds requests per peer; behind a proxy all users share its limit until an exact
trusted-proxy policy is separately reviewed.

Sign out destroys the local session immediately and clears its cookie. It does
not terminate Keycloak SSO or revoke independently held bearer tokens. Revocation,
backchannel logout, and shared encrypted session storage are future reviewed work;
role changes may remain effective until the short access-token lifetime ends.

Headers include CSP, frame restrictions, nosniff and no-store. No client tokens or
secrets are compiled into Vite. Dependencies are locked. Deployment is not approved.
