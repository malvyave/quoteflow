import { runTwenty } from './run-twenty';

function validateEnv(): { apiUrl: string; apiKey: string } {
  const apiUrl = process.env.TWENTY_API_URL;
  const apiKey = process.env.TWENTY_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error(
      'TWENTY_API_URL and TWENTY_API_KEY must be set.\n' +
        'Start a local server: yarn twenty docker:start\n' +
        'Or set them in vitest env config.',
    );
  }

  return { apiUrl, apiKey };
}

async function checkServer(apiUrl: string) {
  let response: Response;

  try {
    response = await fetch(`${apiUrl}/healthz`);
  } catch {
    throw new Error(
      `Twenty server is not reachable at ${apiUrl}. ` +
        'Make sure the server is running before executing integration tests.',
    );
  }

  if (!response.ok) {
    throw new Error(`Server at ${apiUrl} returned ${response.status}`);
  }
}

// Uninstalling deletes the app's objects and every quote in the workspace. CI runs against a
// throwaway server, so it reinstalls from scratch. Anywhere else the tests use the app as
// installed and keep your data, unless TWENTY_TEST_FRESH_INSTALL=1 asks for a clean install.
const shouldReuseInstall = () =>
  process.env.CI !== 'true' && process.env.TWENTY_TEST_FRESH_INSTALL !== '1';

export async function setup() {
  const { apiUrl } = validateEnv();

  await checkServer(apiUrl);

  if (shouldReuseInstall()) {
    return;
  }

  await runTwenty(['app', 'uninstall', '--yes']);

  const result = await runTwenty(['app', 'apply', '--create']);

  if (!result.ok) {
    throw new Error(
      `App apply failed: ${result.error.code} ${result.error.message}`,
    );
  }
}

export async function teardown() {
  if (shouldReuseInstall()) {
    return;
  }

  const result = await runTwenty(['app', 'uninstall', '--yes']);

  if (!result.ok) {
    console.warn(`App uninstall failed: ${result.error.message}`);
  }
}
