# Setup

Follow these steps to get your app running locally.

## Prerequisites

- Node.js (version specified in `.nvmrc`)
- Yarn 4
- Docker (to run the local Twenty server)

## Steps

1. Install dependencies:

   ```bash
   yarn install
   ```

   The committed `yarn.lock` pins exact, integrity-checked versions, so this
   resolves nothing from the registry.

2. Start the local Twenty server:

   ```bash
   yarn twenty docker:start
   ```

   Check the server status at any time with `yarn twenty docker:status`.

3. Start the development server and sync your app:

   ```bash
   yarn twenty dev
   ```

4. Open [http://localhost:2020](http://localhost:2020) and log in with the default development credentials: `tim@apple.dev` / `tim@apple.dev`.

## Verifying your setup

- `yarn lint` - Lint the project with oxlint
- `yarn typecheck` - Type-check the project
- `yarn test:unit` - Run unit tests
- `yarn test` - Run integration tests against the local server
- `yarn test:e2e` - Run browser tests (the client page and the Quote tab) with Playwright

Integration and browser tests need the Twenty CLI on your PATH (`npm install -g twenty@2.46.0`)
and the local server running. They create their own test deals and delete them afterwards.

By default `yarn test` uninstalls and reinstalls the app first, which **deletes every quote in the
workspace**. To keep your local data, test the app you already synced instead:

```bash
TWENTY_TEST_REUSE_INSTALL=1 yarn test
```

With `TWENTY_TEST_REUSE_INSTALL=1` the billing tests are skipped too, because they overwrite and
then clear the Stripe keys (server variables). Add `TWENTY_TEST_BILLING=1` to run them anyway on
a server where losing those keys is fine.

Browser tests expect the app to be installed (`yarn twenty apply`) and use the installed Google
Chrome locally. CI runs all of these on every push and pull request (`.github/workflows/ci.yml`).

## Troubleshooting

See the [troubleshooting guide](https://docs.twenty.com/developers/extend/apps/getting-started/troubleshooting) or ask on [Discord](https://discord.gg/cx5n4Jzs57).
