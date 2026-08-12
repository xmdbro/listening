# Listening

A pretty now-playing display for Last.fm, with local weather, time, listening statistics, and embeddable status endpoints.

## Overview

Listening follows the current or most recently scrobbled track from Last.fm. It displays the album cover, track and artist names, total scrobbles, and personal artist and track play counts.

When Spotify credentials are available, Spotify supplies the album artwork and artist photo. The artist photo becomes the fullscreen background; if it is not available, Listening falls back to the selected album cover. Prominent colors from the cover are used throughout the display.

Time, extended listening information, and waether are enabled by default. You may configure this in [App.tsx](src/App.tsx). Weather uses the browser's location and OpenWeatherMap. The cursor and controls fade away when inactive so the display can remain unobtrusive.

## Controls

The controls appear briefly when the page opens and reappear when the bottom-left corner is hovered.

| Key | Action |
| --- | --- |
| `w` | Toggle local weather |
| `t` | Toggle time and date |
| `e` | Toggle extended Last.fm information |
| `h` | Toggle the control menu |

Display preferences are saved in local storage. Returning visitors keep their last selections, while new visitors begin with time, extended information, and weather visible.

## API Requirements

### Last.fm

Track metadata and personal listening statistics are provided by the [Last.fm API](https://www.last.fm/api).

Create a [Last.fm API account](https://www.last.fm/api/account/create) here.

The Last.fm shared secret and callback URL are not used. Listening checks for new playback data every 10 seconds while the page is open. Server-side caching and shared in-flight requests are done to reduce duplicate API calls.

### Spotify (Images)

Album covers and artist photos can be provided by the [Spotify Web API](https://developer.spotify.com/documentation/web-api). 

Listening uses Spotify's Client Credentials flow. It does not require a user login, authorization callback, refresh token, or _Spotify Premium account*_. If Spotify requires a redirect URI while creating the application, a local placeholder such as `http://127.0.0.1:3000/callback` is okay; Listening will not visit it.

> *Not entirely sure if a premium account is required, I haven't tested

Spotify is optional. Without it, the Last.fm album image is used for both the cover and background. Spotify access tokens renew automatically, and complete artwork results are cached for six hours.

### Weather

Weather is provided by the [OpenWeatherMap Current Weather API](https://openweathermap.org/current).

Visitors must allow browser location access before weather can load. Coordinates are rounded before being sent to the server. Weather results are cached for ten minutes in browser storage, the running server instance, and HTTP caches.

## Endpoints

Listening exposes a few routes for external use like websites or profiles. They are intentionally not linked from the fullscreen display.

| Route | Description |
| --- | --- |
| `/api/now-playing` | Normalized current or recent listening data as JSON |
| `/api/weather?lat=14.56&lon=121.00` | Cached OpenWeatherMap data for a location |
| `/api/card` | Artwork-backed now-playing SVG |
| `/now.svg` | Short alias for the SVG card |

Example GitHub profile embed: (this is live)

[![Lance's now playing status](https://listening-xmdb.vercel.app/now.svg)](https://listening-xmdb.vercel.app/)
```md
[![Lance's now playing status](https://listening-xmdb.vercel.app/now.svg)](https://listening-xmdb.vercel.app/)
```

<!-- ## Usage

Install [Node.js 22](https://nodejs.org/). Listening uses Vite, so make sure to restart the server after changing any server-side functions.

```sh
npm install
```

Copy `.env.example` to `.env`, add the API credentials described below, and
start the local server:

```sh
npm run dev
```

Listening is available at [http://localhost:3000](http://localhost:3000) by default. Set `PORT` in `.env` to use a different local port.

## Development

Run the test suite and production build before deploying:

```sh
npm test
npm run build
```

The project uses React 19, TypeScript, Vite, plain CSS, Node.js 22, and Vercel Functions. -->

## Attribution

Listening's visual language is heavily inspired by [Descent](https://github.com/JasonPuglisi/descent) by Jason Puglisi. Listening is written independently and does not include Descent's Philips Hue integration or configuration interface.

Music data is provided by [Last.fm](https://www.last.fm/), artwork by [Spotify](https://spotify.com/) when configured, and weather data by [OpenWeatherMap](https://openweathermap.org/).