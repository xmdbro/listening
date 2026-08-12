import assert from "node:assert/strict";
import test from "node:test";
import { createWeatherResponse } from "../api/weather";

test("rejects missing or blank weather coordinates", async () => {
  const missing = await createWeatherResponse(
    new Request("http://localhost/api/weather")
  );
  const blank = await createWeatherResponse(
    new Request("http://localhost/api/weather?lat=&lon=%20")
  );

  assert.equal(missing.status, 400);
  assert.equal(blank.status, 400);
  assert.deepEqual(await missing.json(), {
    error: "Location coordinates are invalid."
  });
});
