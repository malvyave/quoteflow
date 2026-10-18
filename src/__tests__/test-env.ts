// Defaults for running tests against the local dev server started with `yarn twenty docker:start`.
// The key is the public API key of the seeded demo workspace in Twenty's dev image: it is signed
// with that image's own secret and is not valid on any real server. CI passes its own values.
const LOCAL_DEV_API_URL = 'http://localhost:2020';
const LOCAL_DEV_DEMO_WORKSPACE_API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyMDIwMjAyMC0xYzI1LTRkMDItYmYyNS02YWVjY2Y3ZWE0MTkiLCJ0eXBlIjoiQVBJX0tFWSIsIndvcmtzcGFjZUlkIjoiMjAyMDIwMjAtMWMyNS00ZDAyLWJmMjUtNmFlY2NmN2VhNDE5IiwiaWF0IjoxNzM1Njg5NjAwLCJleHAiOjQ4OTE0NDk2MDAsImp0aSI6IjIwMjAyMDIwLWY0MDEtNGQ4YS1hNzMxLTY0ZDAwN2MyN2JhZCJ9.bfQjfyN0NEtTCLE_xPyNcwonDzlSXFoP8kdCQTdnuDc';

export const applyTestEnvDefaults = () => {
  process.env.TWENTY_API_URL ??= LOCAL_DEV_API_URL;
  process.env.TWENTY_API_KEY ??= LOCAL_DEV_DEMO_WORKSPACE_API_KEY;

  return { apiUrl: process.env.TWENTY_API_URL, apiKey: process.env.TWENTY_API_KEY };
};
