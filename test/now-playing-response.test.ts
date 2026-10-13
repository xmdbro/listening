import assert from "node:assert/strict";
import test from "node:test";
import { createNowPlayingResponse } from "../api/now-playing";

test("requests a username only when neither a selected account nor a server default exists", async () => {
  const originalUsername = process.env.LASTFM_USERNAME;
  const originalApiKey = process.env.LASTFM_API_KEY;
  const originalFetch = globalThis.fetch;
  try {
    process.env.LASTFM_USERNAME = "";
    process.env.LASTFM_API_KEY = "test-key";
    const missing = await createNowPlayingResponse(new Request("https://example.com/api/now-playing"));
    assert.equal(missing.status, 503);
    const missingPayload = await missing.json();
    assert.equal(missingPayload.requiresUsername, true);
    assert.equal(missingPayload.serverDefaultUsername, null);

    globalThis.fetch = (async () => Response.json({ recenttracks: { track: [] } })) as typeof fetch;
    const selected = await createNowPlayingResponse(new Request("https://example.com/api/now-playing?user=response-test-user"));
    assert.equal(selected.status, 200);
    const selectedPayload = await selected.json();
    assert.equal(selectedPayload.username, "response-test-user");
    assert.equal(selectedPayload.serverDefaultUsername, null);

    process.env.LASTFM_USERNAME = "  response-test-default  ";
    const fallback = await createNowPlayingResponse(new Request("https://example.com/api/now-playing"));
    assert.equal(fallback.status, 200);
    const fallbackPayload = await fallback.json();
    assert.equal(fallbackPayload.username, "response-test-default");
    assert.equal(fallbackPayload.serverDefaultUsername, "response-test-default");

    delete process.env.LASTFM_API_KEY;
    process.env.LASTFM_USERNAME = "response-test-unconfigured";
    const unconfigured = await createNowPlayingResponse(new Request("https://example.com/api/now-playing"));
    assert.equal(unconfigured.status, 503);
    const unconfiguredPayload = await unconfigured.json();
    assert.equal(unconfiguredPayload.requiresUsername, false);
    assert.equal(unconfiguredPayload.serverDefaultUsername, "response-test-unconfigured");

    process.env.LASTFM_USERNAME = "";
    const missingBoth = await createNowPlayingResponse(new Request("https://example.com/api/now-playing"));
    assert.equal((await missingBoth.json()).requiresUsername, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUsername === undefined) delete process.env.LASTFM_USERNAME;
    else process.env.LASTFM_USERNAME = originalUsername;
    if (originalApiKey === undefined) delete process.env.LASTFM_API_KEY;
    else process.env.LASTFM_API_KEY = originalApiKey;
  }
});
