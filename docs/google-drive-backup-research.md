# Google Drive auto-backup for a pure client-side SPA — 2026 constraint report

Research date: **2026-09-30**. All claims below were fetched live during this research;
page-level "Last updated" dates are quoted where Google publishes them.

Legend: ✅ VERIFIED (fetched + quoted or probed) · ⚠️ PARTIAL · ❌ UNVERIFIED

---

## Executive summary (read this first)

The user's working assumption — *"Google fully blocked implicit flow around Jan/Feb 2023"* — is
**wrong, and conflates two different deprecations**. Jan/Feb 2023 is the **OOB flow** (copy/paste
code for native apps). Implicit flow was **never hard-blocked**; Google's live OIDC discovery
document still advertises `response_types_supported: [... "token" ...]`.

But the conclusion the user actually cares about still lands, via a *different* mechanism:

> **A pure browser-only SPA cannot get a refresh token from Google at all, with any client type.**
> Google's token endpoint does not support public-client authentication (`none`), and the GIS
> Token Client response object has **no `refresh_token` field at all**.

That single fact is the crux. "Auto-backup every so often, without the user present" is
**not achievable** in a no-backend app without a server that holds a client secret. Everything
else in this document is detail on that one constraint.

**Recommended direction for the PRD:** a thin serverless proxy holding the client secret, with the
refresh token stored server-side rather than in IndexedDB. Rationale in §5 and §6.

---

## 1. Is Implicit flow still permitted for NEW integrations?

**Answer: Not blocked — but deprecated, discouraged, and documented as legacy-only. Effectively
do not use.**

Your Jan/Feb 2023 date belongs to a *different* flow:

| Flow | Status | Date | Source |
|---|---|---|---|
| **OOB** (`urn:ietf:wg:oauth:2.0:oob`) | **Hard-blocked for all clients** | Blocked for new usage **Feb 28, 2022**; **fully blocked Jan 31, 2023** | ✅ [oob-migration](https://developers.google.com/identity/protocols/oauth2/resources/oob-migration) (page updated 2026-05-26) |
| **Implicit** (`response_type=token`) | **Deprecated, discouraged, still functional** | No hard sunset date published | ✅ [javascript-implicit-flow](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow) (page updated 2026-09-14) |

OOB dates verbatim: *"The OOB flow, used by native clients without a redirect URI, will be blocked
for new OAuth usage starting February 28, 2022, and fully deprecated by January 31, 2023, for all
client types in production."*

**Current state of implicit, from Google's own live page (updated 2026-09-14):**

> *"**Warning:** The OAuth 2.0 Implicit Grant flow is considered insecure for browser-based
> single-page applications (SPAs) due to the risk of token interception. For modern web
> applications, you should use the Authorization Code flow with PKCE instead."*

> *"**Important:** Interacting with Google's OAuth 2.0 endpoints directly to implement the implicit
> flow is strongly discouraged due to security vulnerabilities... **Direct interaction with the
> implicit grant endpoints detailed on this page is provided only for legacy support and
> troubleshooting.**"*

It is **still technically live** — probed Google's discovery endpoint:
`https://accounts.google.com/.well-known/openid-configuration` →
`response_types_supported: ["code","token","id_token","code token","code id_token","token id_token","code token id_token","none"]`

⚠️ **Note a subtlety worth putting in the PRD:** implicit is *not blocked*, but Google's own
comparison table rates its security as "**Least**" and says a "**user gesture** such as button
press or clicking on a link is required to request and obtain a new, valid access token." So even
if implicit worked, it could not drive unattended periodic backup.

Standards body agrees — **RFC 9700, "Best Current Practice for OAuth 2.0 Security" (January 2025)**,
§2.1.2:

> *"In order to avoid these issues, clients SHOULD NOT use the implicit grant (response type
> token) or other response types issuing access tokens in the authorization response, unless access
> token injection in the authorization response is prevented and the aforementioned token leakage
> vectors are mitigated."*

Source: https://www.rfc-editor.org/rfc/rfc9700.txt

**Also note:** the dedicated implicit client-side reference page
`https://developers.google.com/identity/protocols/oauth2/client-side` now returns **HTTP 404** ✅
(probed). Google restructured its docs; the live implicit page is the `javascript-implicit-flow`
URL above.

---

## 2. GIS Token Client — supported? Refresh tokens?

**Answer: Fully supported for SPA use. It does NOT issue refresh tokens. This is by design.**

Canonical current docs (note: the older `/identity/gsi/web/...` paths now **redirect** to a generic
overview page; the live tree is under `/identity/oauth2/web/` — verified by following redirects):

- Library overview: https://developers.google.com/identity/oauth2/web/guides/overview
- JS reference: https://developers.google.com/identity/oauth2/web/reference/js-reference
- "Authorizing for Web": https://developers.google.com/identity/oauth2/web/overview

**`google.accounts.oauth2.initTokenClient(config)` is alive and documented** (reference page
updated 2026-05-26):

> *"The `initTokenClient` method initializes and returns a token client, with the configurations
> in the parameter."* — ✅ https://developers.google.com/identity/oauth2/web/reference/js-reference

### The critical detail — TokenResponse has no refresh token

The `TokenResponse` data type documented properties, verbatim from the reference, are:
`access_token`, `expires_in`, `hd`, `prompt`, `token_type`, `scope`, `state`.

✅ **There is no `refresh_token` field.** Google's own flow comparison table confirms this —
*"Refresh token issued"* is **"No"** for implicit/token flow and **"Yes"** for authorization code
flow: https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model

### GIS "token model" vs "code model" — the official distinction you asked about (Q3)

There is an official "model" terminology, but note: it is **token model vs code model**, *not*
"cookie model". ❌ **"Cookie model" is not a Google term** — I found no such term in Google's OAuth
or GIS docs. Do not use that phrase in the PRD.

Google's comparison table (page updated 2026-05-26), verbatim:

| | Implicit flow | Authorization code flow |
|---|---|---|
| User consent required | For every token request, including replacing expired tokens | Only for the first token request |
| User must be present | **Yes** | **No, supports offline use** |
| User security | Least | Most, has client authentication and avoids in-browser token handling risks |
| Refresh token issued | **No** | **Yes** |
| Access token used to call Google APIs | only from a web app running in the user's browser | either from a server running on backend platform, or from a web app running in the user's browser |
| Requires backend platform | **No** | **Yes, for endpoint hosting and storage** |
| Secure storage needed | **No** | **Yes, for refresh token storage** |
| Access token expiration behavior | A user gesture such as button press or clicking on a link is required to request and obtain a new, valid access token | After an initial user request, your platform exchanges the stored refresh token to obtain a new, valid access token |

> *"**Key Point:** Authorization code flow is recommended because it provides a more secure flow."*

**Read that table as the PRD's central risk table.** Columns 2 and 6 are exactly what "automatic
periodic backup" needs, and the no-backend SPA can only have column 1.

### Caveats on the token client (all ✅ verified)

- **Lifetime:** *"By design, access tokens have a short lifetime. If the access token expires prior
  to the end of the user's session, obtain a new token by calling `requestAccessToken()` from a
  user-driven event such as a button press."* — [use-token-model](https://developers.google.com/identity/oauth2/web/guides/use-token-model) (2026-05-26)
- **User gesture required:** a gesture is required to request a token "even if there was a prior
  request" — [migration-to-gis](https://developers.google.com/identity/oauth2/web/guides/migration-to-gis)
- GIS separates auth from authz: *"the authentication API can only return ID tokens... whereas the
  authorization API can only return code or access tokens"* — [GIS overview](https://developers.google.com/identity/gsi/web/guides/overview) (2026-02-10)
- Only **one** public method: `requestAccessToken(overrideConfig?)`.
- `prompt` defaults to `'select_account'`; `include_granted_scopes` defaults to `true`.
- `enable_granular_consent` and `enable_serial_consent` are both marked **"Deprecated, no effect if set."**

---

## 3. Token storage in IndexedDB / localStorage

**Answer: Google and OWASP both say no, for refresh tokens specifically. Note the asymmetry —
Google's objection to the *token model* is architectural, not just about storage.**

**Google (OAuth 2.0 Policy, https://developers.google.com/identity/protocols/oauth2/policies) —
verbatim:**

> *"Handle user tokens securely. OAuth 2.0 tokens are entrusted to you by users who give you
> permission to act and access data on their behalf. **Never transmit tokens in plaintext, and
> always store encrypted tokens at rest** to provide an extra layer of protection in the event of a
> data breach."*

> *"**Revoke tokens** when you no longer need access to a user's account or when your app no longer
> needs access to permissions that a user previously granted. **After the tokens are revoked,
> delete them permanently** from your application or system."*

And on client credentials (relevant to §6):

> *"Store your OAuth client information in a secure place and protect it, especially your client
> secret, just as you would a password. Where possible, use a secret manager, such as Google Cloud
> Secret Manager... **You must never commit client credentials into publicly available code
> repositories.**"*

**OWASP (HTML5 Security Cheat Sheet) — unusually explicit about IndexedDB specifically** ✅:

> *"A user (or any process running with that user's privileges, including malware) with read access
> to the browser profile directory on disk can read or modify the stored data, so **do not assume
> client-side storage provides confidentiality. Do not store session tokens, credentials, or other
> secrets in IndexedDB unless they are encrypted with a key that is not itself recoverable from the
> browser** (for example, derived from a user-supplied passphrase that is never persisted, or
> wrapped by a non-extractable Web Crypto CryptoKey)."*

> *"A single Cross-Site Scripting vulnerability can read or write any data in IndexedDB; treat its
> contents as untrusted input on read."*

> *"Use the object `sessionStorage` instead of `localStorage` if persistent storage is not needed."*

Source: https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html

⚠️ **UNVERIFIED:** I did not find a Google or OWASP statement specifically blessing
*encrypted-in-IndexedDB* refresh tokens as an acceptable pattern. OWASP permits it conditionally
(with a non-extractable key); Google mandates encryption at rest but does not bless the browser as
a location. Treat "encrypted refresh token in IndexedDB" as **grey-area, defensible but not
endorsed**. A passphrase-derived key does provide real mitigation and is worth considering if the
PRD insists on no backend.

---

## 4. Drive API scopes — which one?

**Answer: `drive.file` for visible backups; `drive.appdata` for a hidden private folder. They are
genuinely different use cases, not alternatives to each other.**

Official scope table (https://developers.google.com/drive/api/guides/api-specific-auth,
page updated **2026-09-03**) — `drive.appdata` and `drive.file` are both classed **non-sensitive**:

| Scope | Classification | Google's verbatim description |
|---|---|---|
| `https://www.googleapis.com/auth/drive.appdata` (+ `drive.appfolder`) | **Non-sensitive** | "View and manage the app's own configuration data in your Google Drive." |
| `https://www.googleapis.com/auth/drive.file` | **Non-sensitive** | "Create new Drive files, or modify existing files, that you open with an app or that the user shares with an app while using the Google Picker API or the app's file picker." |
| `https://www.googleapis.com/auth/drive` | **Restricted** | "View and manage all your Drive files." |

Non-sensitive scopes *"only require basic OAuth App Verification"* ✅ — no restricted-scope review,
no security assessment. This matters a lot for a solo project.

### drive.file vs appDataFolder — the real difference

✅ [Store application-specific data](https://developers.google.com/drive/api/guides/appdata)
(page updated 2026-09-03):

> *"The **application data folder** is a special hidden folder that your app can use to store
> application-specific data, such as configuration files. The application data folder is
> automatically created when you attempt to create a file in it. Use this folder to store any files
> that the **user shouldn't directly interact with**. This folder is only accessible by your app and
> its contents are **hidden from the user and from other Google Drive apps**."*

> ⚠️ *"The application data folder is **deleted when a user uninstalls your app** from their My
> Drive. **Users can also delete your app's data folder manually.**"*

Hard constraints on `appDataFolder` (all quoted from same page):

> *"You **can't share** files or folders inside the application data folder."* → `notSupportedForAppDataFolderFiles`
> *"You **can't move** files in the appDataFolder between storage locations (spaces)."*
> *"You **can't trash** files or folders inside the application data folder."*

**Decision for the PRD:** `appDataFolder` is a **terrible fit for backups**, because (a) the user
cannot see or retrieve the file without the app, and (b) the data is destroyed if they uninstall /
delete. A backup the user cannot see and that vanishes on uninstall is not a backup.
**Recommend `drive.file`.**

⚠️ **Important caveat on `drive.file` that is easy to miss:** its per-file access is granted for
files the app *created* or files the *user shared* via Picker. Google's own docs recommend migrating
to `drive.file` + the **Google Picker API** for user file selection. ✅ Verified that the app can
**create** new files under `drive.file` (so "upload a new backup file each time" works), and that
`drive.file` *"works with all Drive API REST Resources."*
⚠️ **UNVERIFIED:** I did not empirically confirm that `files.list` reliably returns the app's own
previously-created backup files under `drive.file` in all cases. **The PRD must specify a
strategy for locating the prior backup file to replace it** (e.g. store the returned `fileId` in
IndexedDB, rather than re-listing). Recommend storing the `fileId`.

Upload mechanics ✅ ([Upload file data](https://developers.google.com/drive/api/guides/manage-uploads)):
`uploadType=media` for ≤5 MB; `uploadType=multipart` for files+metadata in one request. Both fine
for a JSON backup of a workout tracker.

---

## 5. Simpler alternatives that avoid OAuth — evaluated

### (a) `appDataFolder` — ❌ does NOT avoid OAuth
It still requires the `drive.appdata` scope, which still requires OAuth consent and a token. It
solves *where files go*, not *how you authenticate*. Plus the uninstall-deletes-your-backup and
invisible-to-user problems in §4.

### (b) Serverless proxy (Cloudflare Worker, etc.) — ✅ **THE RECOMMENDED PATH**
This is the only option that yields true unattended automatic backup. The Worker:
1. Holds the **client secret** (in a secret binding — never in the repo, per Google's policy above).
2. Performs the authorization-code exchange, obtaining the refresh token.
3. **Stores the refresh token** — this is the key design win: the refresh token never touches the
   browser, so the IndexedDB prohibition in §3 disappears entirely.
4. Uploads the backup on a **scheduled trigger** (Workers Cron Triggers), pulling the workout
   payload from wherever the SPA pushes it.

⚠️ **Caveats to state honestly in the PRD:** this reintroduces a backend, contradicting the app's
current "no backend" property — the user must accept that trade. It also needs a durable store for
both the tracker payload and the refresh token. Google also applies **refresh-token limits**:
*"Limits apply to the number of refresh tokens that are issued per client-user combination, and per
user across all clients"* — excessive issuance invalidates older tokens ✅
([OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)).

### (c) Clipboard + manual upload — ✅ **the no-backend fallback**
Zero OAuth, zero server, zero token storage risk. Cost: user effort, and it's not automatic. The
existing Export button already does better (direct download), so this option is mainly worth
documenting as the rejected alternative that justifies why a server was introduced.

### (d) Apps Script — ⚠️ partially viable, adds a deployment dependency
An Apps Script Web App could own the Drive write. ⚠️ **UNVERIFIED:** I did not verify current
Apps Script authorization modes, quota limits, or whether it can be made to work without its own
OAuth consent surface. It also still needs a trigger source for "periodically," and Apps Script is
a Google-hosted runtime the user must maintain and trust with their data. **Marked as not
recommended pending verification** rather than ruled out.

### (e) Recommended decision matrix

| Option | Automatic? | Backend? | Refresh token in browser? | Verdict |
|---|---|---|---|---|
| GIS Token Client (implicit-style) | ❌ user gesture every expiry | No | N/A — no refresh token exists | **Dead end for "auto"** |
| `appDataFolder` + token client | ❌ | No | N/A | **Dead end** — invisible + uninstall-deleted |
| Clipboard / manual upload | ❌ | No | No | Safe fallback, no automation |
| **Serverless proxy + code flow** | ✅ | **Yes** | **No** | **Recommended** |

---

## 6. Client ID / Client Secret — the core structural constraint

**Answer: There is no PKCE-only public-client flow in Google's Web client type. This is a hard
blocker, and it is the reason a backend is unavoidable.**

### Google's own statement on client types

✅ [OAuth 2.0 web](https://developers.google.com/identity/protocols/oauth2) (updated 2026-09-14):

> *"For server-side or JavaScript web apps use the **Web application** client type. Don't use this
> client type for any other application, such as native or mobile apps."*

✅ For **Installed application**:

> *"The process results in a client ID and, **in some cases, a client secret, which you embed in
> the source code of your application. (In this context, the client secret is obviously not treated
> as a secret.)"* — i.e. Google acknowledges embedded secrets for installed apps, **not** for SPAs.

### The browser setup you must use

✅ [Get your Google API client ID](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)
(updated 2025-08-05):

> *"When you configure the project, select the **Web browser** client type and specify the **origin
> URI** of your app. When you perform tests, both `http://localhost` and `http://localhost:<port_number>`
> must be added to the Authorized JavaScript origins field."*

> *"take note of the client ID that was created. You will need the client ID to complete the next
> steps. (**A client secret is also created, but you need it only for server-side operations.**)"*

That parenthetical is the crux: the Web client type **does** issue a secret, and Google expects it
to be used **server-side**.

### Live probe — Google's token endpoint does not support public clients

Pulled `https://accounts.google.com/.well-known/openid-configuration` ✅:

```
code_challenge_methods_supported      = ["plain", "S256"]
grant_types_supported                = ["authorization_code", "refresh_token",
                                       "urn:ietf:params:oauth:grant-type:device_code",
                                       "urn:ietf:params:oauth:grant-type:jwt-bearer"]
response_types_supported             = ["code","token","id_token","code token",
                                       "code id_token","token id_token","code token id_token","none"]
token_endpoint_auth_methods_supported = ["client_secret_post", "client_secret_basic"]
```

**`token_endpoint_auth_methods_supported` contains `client_secret_post` and `client_secret_basic`
but NOT `none`.** The OAuth spec value `none` is how a public client authenticates (PKCE-only, no
secret). **Google's token endpoint does not advertise it.** Therefore a browser-only app cannot
complete a code exchange as a public client.

⚠️ **Honest scoping of this finding:** `none` being absent from the advertised list is strong
evidence of no supported PKCE-only public client, and it is consistent with every Google doc page
that routes code exchange to "your backend server." **I could not complete a positive empirical
test** — probing `https://oauth2.googleapis.com/token` with a fabricated client ID returns
`invalid_client: "The OAuth client was not found."` for both the with-secret and without-secret
cases, so the probe cannot distinguish the two. **A live test with a real Client ID would be needed
to fully confirm.** Mark this as **⚠️ strong evidence + doc-corroborated, not empirically proven.**

Note that PKCE *primitives* exist (`code_challenge_methods_supported: ["plain","S256"]`) and are
documented for **installed apps** ✅ ([OAuth 2.0 for iOS & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app),
lines on `code_challenge`/`code_verifier`). For installed apps Google also notes:

> *"The client secret is **not applicable** to requests from clients registered as Android, iOS, or
> Chrome applications."*

> ⚠️ *"incremental authorization with installed apps is not supported due to the fact that the
> client cannot keep the client_secret confidential."*

### Is a public secret in a browser bundle acceptable?

**No — and Google has not shipped a PKCE-only alternative for Web clients.**

- ❌ **No "public client" client type exists** in the Google Cloud console for web apps. ✅ Verified
  the console client types named in docs: Web application, Android, iOS, Chrome Extension, TVs &
  Limited Input, Desktop app.
- ❌ **No "PKCE-only" checkbox / public-client flow** for Web clients. PKCE is documented for
  **installed apps**, where Google already accepts that the secret isn't secret.
- ❌ Google's policy explicitly says **"You must never commit client credentials into publicly
  available code repositories"** — a bundled Vite `VITE_*` env var is a public repository.
  ⚠️ Caveat: `client_id` alone is safe to expose (it is not confidential — it appears in URLs and
  in every consent screen). **`client_secret` is not.**

**Bottom line for the PRD:** with a Web-type client, Google expects the secret to be used
server-side. The GIS Code Client *can* run entirely in the browser and hand you a `code` in a popup
✅ (`initCodeClient` → `requestCode()` → `CodeResponse`), but **exchanging that code for a
refresh token requires the secret** — and Google documents that exchange as happening on your
backend ✅
([Use Code Model](https://developers.google.com/identity/oauth2/web/guides/use-code-model):
*"an endpoint on your backend server receives and validates the authorization code"*). **So the
Code Client does not escape the backend requirement; it just relocates where the secret is needed.**

---

## 7. Revocation / disconnect, and minimal-scope consent UX

### Revocation — ✅ fully client-side, and easy

`google.accounts.oauth2.revoke()` exists and needs no backend ✅
([reference](https://developers.google.com/identity/oauth2/web/reference/js-reference),
[use-token-model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)):

> *"The `revoke` method revokes **all of the scopes that the user granted to the app**. A valid
> access token is required to revoke the permission."*

```js
google.accounts.oauth2.revoke(accessToken, done => {
  console.log(done.successful);
  console.log(done.error);
  console.log(done.error_description);
});
```

**Documented error behavior** ✅ — highly relevant to UX design:

> *"`invalid_token` — Token is already expired or revoked before revoke method is called. **In most
> cases, you can regard the grant associated with the accessToken is revoked.**"*

That means a Disconnect button must **treat `invalid_token` as success**, otherwise users with an
expired token (the common case, since access tokens are short-lived and the app can't refresh
them) see an error and think disconnect failed. This is a concrete UX requirement for the PRD.

⚠️ **Refresh-token revocation caveat:** if a backend holds a refresh token, calling `revoke()` with
only an access token may not fully terminate server-side refresh. ⚠️ **UNVERIFIED** — the
`google.accounts.oauth2.revoke()` docs only describe access-token input. The standard way to revoke
a refresh token is a POST to `https://oauth2.googleapis.com/revoke` with `token=<refresh_token>`
⚠️ **I did not verify this endpoint against Google's docs during this research — mark as
needs-verification before writing it into the PRD.**

Per Google's policy, after revoking: *"delete them permanently from your application or system"* —
so a Disconnect must also wipe the `fileId` and any cached payload from IndexedDB.

Users can also revoke independently at
[myaccount.google.com/connections](https://myaccount.google.com/connections) ✅ noted in the GIS
client-ID guide: *"A user always has the option to revoke access to an application at any time."*

### Minimal-scope consent UX — ✅ concrete recommendations

All verified against the reference + policy pages:

1. **Request exactly one scope: `https://www.googleapis.com/auth/drive.file`.** Non-sensitive →
   basic verification only. Never `drive` (restricted → triggers security assessment). Google:
   *"You must only request the smallest set of scopes that are necessary."*
2. **Trigger consent in context, on a user click.** Google's *incremental authorization* practice —
   *"you must ask for scopes in context with the action they are used for"* — and the existing
   Export button is the natural consent trigger. ✅ Matches the app's existing
   `BackupReminderBanner` / `SettingsPage` Export UX.
3. **Never request at app startup.** GIS enforces the authn/authz split precisely to enable this.
4. **Honour `prompt`** — `''` (only first consent), `'consent'`, `'select_account'` (the default),
   `'none'`. Note `'none'` must not be combined with other values.
5. **Declare scopes in two places**: Cloud console consent screen (the ceiling) *and* the code (the
   actual request) ✅. Console must match the scopes used or you must justify/remove them.
6. **Handle partial grant**: *"a user might choose to grant one or more requested scopes or deny
   the request"* ✅ — so treat "scopes returned ≠ scopes requested" as a real case and degrade
   gracefully. `hasGrantedAllScopes()` / `hasGrantedAnyScope()` exist for this ✅.
7. **Write honest copy.** The consent screen will say the app can "create new Drive files." Avoid
   "back up all your data" overclaiming with a per-file scope.

---

## Bottom line for the PRD

1. Correct the premise: **Jan/Feb 2023 = OOB flow, not implicit.** Implicit is deprecated, not blocked.
2. **The real blocker is architectural, not a policy sunset:** Google issues **no refresh tokens**
   to browser-only clients (GIS `TokenResponse` has no `refresh_token`; token endpoint advertises no
   `none` auth method). Unattended automatic backup is therefore **not possible with zero backend**.
3. **Recommend: thin serverless proxy** (Worker + secret binding) doing the code exchange, holding
   the refresh token server-side, uploading on a schedule. This also *eliminates* the OWASP/Google
   token-storage problem rather than papering over it.
4. **Use `drive.file`** (non-sensitive). Avoid `appDataFolder` (invisible to user, deleted on
   uninstall). Store the returned `fileId` in IndexedDB to avoid `files.list` ambiguity.
5. **Handle `invalid_token` from `revoke()` as success.**
6. If no backend is acceptable, ship the honest fallback: improved manual export. Do not claim
   "automatic" — it cannot be automatic without a server.

### Explicitly UNVERIFIED — do not state these as fact in the PRD
- That a real Client ID with PKCE and no secret fails at the token endpoint (probe used a fake
  client ID; discovery metadata + docs are the basis, not a live success/failure).
- Google's `https://oauth2.googleapis.com/revoke` endpoint behaviour with a refresh token.
- Whether `files.list` returns app-created files under `drive.file` in all cases.
- Apps Script viability for this use case (quota, auth modes, trigger reliability).
- Any hard sunset/enforcement date for implicit flow — none is published.
