# @tts/sigarra

TypeScript SDK for [SIGARRA](https://sigarra.up.pt), generated from [`openapi.json`](./openapi.json) with [Fern](https://buildwithfern.com).

```ts
import { SigarraClient } from '@tts/sigarra'

const sigarra = new SigarraClient()
await sigarra.home.getHomePage({ faculty: 'feup', language: 'pt' })
```

## Authentication

The SDK doesn't manage sessions. Log in, take the `SI_SESSION` and `SI_SECURITY` cookies from the response, and pass them to a new client through the `headers` option:

```ts
import { SigarraClient } from '@tts/sigarra'

const { data, rawResponse } = await new SigarraClient().auth
  .login({ faculty: 'feup', language: 'pt', pv_login: username, pv_password: password })
  .withRawResponse()

const cookie = rawResponse.headers
  .getSetCookie()
  .map((setCookie) => setCookie.split(';')[0])
  .join('; ')

const sigarra = new SigarraClient({ headers: { Cookie: cookie } })
await sigarra.student.getProfile({ faculty: 'feup', language: 'pt', pv_codigo: data.codigo })
```

A wrong username or password throws `Sigarra.ForbiddenError`. Sessions last about 2 hours and are tied to the IP address that logged in; endpoints that also accept them from other addresses say so in their description. Use the SDK from a server, and log in again once the session expires. See the `info.description` of [`openapi.json`](./openapi.json) for the other ways to log in (OpenID Connect and SAML).

## Generating

The generated SDK is committed under `src/generated`. Regenerate the SDK with:

```sh
bun run generate
```

This runs `fern generate --local` and then `scripts/patch-generated.ts`, which patches the generated output: it fixes a type error in Fern's generated `Headers.ts` and turns off implicit retries (see [Retries](#retries)). CI regenerates the SDK on pull requests that touch this package and fails if the committed files differ. Fern needs Docker (the Fern TypeScript generator runs in a container) and `node`. With Podman, unqualified image names such as `fernapi/fern-typescript-sdk` must resolve to Docker Hub; if they don't, point `CONTAINERS_REGISTRIES_CONF` to a file containing `unqualified-search-registries = ["docker.io"]`.

## Retries

Retries are opt-in. Fern retries every request twice by default, including `POST`s, which could replay non-idempotent calls such as logging in or `finances.generateMbReference`. `scripts/patch-generated.ts` changes that default to 0, so a request is never retried unless you ask for it with `maxRetries`, either for the whole client or for a single request:

```ts
const sigarra = new SigarraClient({ maxRetries: 2 })
await sigarra.home.getHomePage({ faculty: 'feup', language: 'pt' }, { maxRetries: 1 })
```

Only enable retries for idempotent requests. Don't edit the generated files by hand: change the patch script instead, and `bun run generate` will reapply it.
