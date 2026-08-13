import assert from "node:assert/strict";
import test from "node:test";
import {
  customWeatherCoordinates,
  defaultPreferences,
  loadPreferences,
  validateWeatherCoordinates,
  type Preferences
} from "../src/preferences";
import { validateLastFmUsername } from "../src/lastfm-user";

test("loads saved settings while preserving defaults for missing values", () => {
  const preferences = loadPreferences({
    getItem: (key) => key === "listening:settings:v1"
      ? JSON.stringify({
          backgroundType: "album",
          displayName: "Lance",
          lastFmUsername: "xmdb",
          showWeekday: true
        })
      : null
  });

  assert.equal(preferences.backgroundType, "album");
  assert.equal(preferences.displayName, "Lance");
  assert.equal(preferences.lastFmUsername, "xmdb");
  assert.equal(preferences.showWeekday, true);
  assert.equal(preferences.weather, true);
});

test("migrates the original display toggles", () => {
  const preferences = loadPreferences({
    getItem: (key) => key === "listening:features"
      ? JSON.stringify({ weather: false, time: false, extended: true })
      : null
  });

  assert.equal(preferences.weather, false);
  assert.equal(preferences.time, false);
  assert.equal(preferences.extended, true);
  assert.equal(preferences.backgroundType, "artist");
  assert.equal(preferences.lastFmUsername, "");
});

test("validates optional Last.fm usernames", () => {
  assert.equal(validateLastFmUsername(""), null);
  assert.equal(validateLastFmUsername("xMdb"), null);
  assert.match(validateLastFmUsername("x".repeat(65)) ?? "", /64 characters/i);
  assert.match(validateLastFmUsername("name\nnext") ?? "", /control characters/i);
});

test("accepts paired coordinates and rejects partial coordinates", () => {
  const custom: Preferences = {
    ...defaultPreferences,
    weatherLatitude: "14.56",
    weatherLongitude: "121.00"
  };
  assert.deepEqual(customWeatherCoordinates(custom), { latitude: 14.56, longitude: 121 });
  assert.equal(validateWeatherCoordinates(custom), null);

  const partial = { ...custom, weatherLongitude: "" };
  assert.match(validateWeatherCoordinates(partial) ?? "", /both coordinates/i);
});
