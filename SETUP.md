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

Locally, `yarn test` uses the app as you last synced it (`yarn twenty apply`) and keeps your data.
CI, and anyone who sets `TWENTY_TEST_FRESH_INSTALL=1`, uninstalls and reinstalls the app first,
which **deletes every quote in the workspace**, so only do that on a throwaway server.

The billing tests are skipped locally too, because they overwrite and then clear the Dodo Payments
keys (server variables). Add `TWENTY_TEST_BILLING=1` to run them anyway on a server where losing
those keys is fine.

Browser tests expect the app to be installed (`yarn twenty apply`) and use the installed Google
Chrome locally. CI runs all of these on pushes to `main` and on pull requests
(`.github/workflows/ci.yml`); start a run by hand from the Actions tab or with
`gh workflow run CI --ref <branch>`.

## Publishing

1. Make sure CI passes on `main` and the version in `package.json` and `CHANGELOG.md` match.
2. **First release only**, from your machine, because npm can set up trusted publishing only for a
   package that already exists: `npm login`, then
   `TWENTY_APP_PUBLISH_DISABLE_PROVENANCE=true yarn twenty app:publish`.
3. On npmjs.com, open the package → **Settings → Trusted Publisher**, and add this GitHub repository
   with the workflow `publish.yml`.
4. **Every later release:** bump the version, then push a tag (`git tag v0.2.1 && git push --tags`).
   `.github/workflows/publish.yml` publishes it with provenance, which is what lets you claim the
   app in Twenty's marketplace.

## Troubleshooting

See the [troubleshooting guide](https://docs.twenty.com/developers/extend/apps/getting-started/troubleshooting) or ask on [Discord](https://discord.gg/cx5n4Jzs57).
