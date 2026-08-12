# Listening

A self-hosted fullscreen Last.fm now-playing display with artwork, local weather, listening statistics, and embeddable status endpoints. Made in spite because Last.fm's `/now` profile endpoint is a premium only feature, and is... pretty bad... for the lack of a better word.

<p align="center">
  <img src="./.github/docs/demo.gif" alt="Listening demo" width="90%">
  <br>
  <br>
  <a href="https://listening-xmdb.vercel.app/">
    <img src="https://listening-xmdb.vercel.app/now.svg?name=Lance" alt="Lance's now playing status">
  </a>
</p>

## Overview

Listening follows the current or most recently scrobbled track from a configured Last.fm account. It displays the album cover, track and artist names, total scrobbles, and personal artist and track play counts.

When Spotify credentials are available, Spotify supplies the album artwork and artist photo. The artist photo is used as the default fullscreen background, falling back to the album cover when necessary. Colors extracted from the cover are brightened and applied to the track and artist text.

Time, weather, and extended listening information are visible by default. Display preferences are stored locally in the visitor's browser.

## Controls

The controls appear briefly when the page opens and reappear when the bottom-left corner is hovered.

| Key | Action |
| --- | --- |
| `w` | Toggle local weather |
| `t` | Toggle time and date |  
| `e` | Toggle extended Last.fm information |
| `h` | Toggle the control menu |
| `s` | Open or close Listening preferences |
| `Esc` | Close Listening preferences |

Press `s` to open the preferences panel. Changes are applied after selecting *Save preferences* and persist in local storage.

Available preferences include:

- A display name for the fullscreen listening label. This does not change the tracked Last.fm account.
- Artist, album, or solid-black backgrounds.
- Background blur toggle.
- Custom longitude and latitude for the weather.
- 24-hour time, weekday, and seconds toggle display.

## Configuration

Copy `./.env.example` to `./.env` and fill out the services you want to use. Only Last.fm is required for playback data.

```env
LASTFM_API_KEY=replace-with-your-lastfm-api-key
LASTFM_USERNAME=replace-with-your-lastfm-username

SPOTIFY_CLIENT_ID=replace-with-your-spotify-client-id
SPOTIFY_CLIENT_SECRET=replace-with-your-spotify-client-secret

OPENWEATHERMAP_API_KEY=replace-with-your-openweathermap-api-key
```

## Endpoints

Listening exposes several routes for websites, profile READMEs, and other integrations. They are intentionally not linked from the fullscreen display.

| Route | Description |
| --- | --- |
| `/api/now-playing` | Normalized current or recent listening data as JSON |
| `/api/weather?lat=14.56&lon=121.00` | Cached OpenWeatherMap conditions for a location |
| `/api/card` | Artwork-backed now-playing SVG |
| `/now.svg` | Short alias for the SVG card |
| `/now.svg?name=Lance` | SVG card with a public display-name override |

The `name` query parameter only changes the label rendered in that card. It never changes `LASTFM_USERNAME` or the account being tracked. URL-encode names containing spaces.

Example GitHub profile embed:

## API requirements

### Last.fm

Track metadata and personal listening statistics come from the [Last.fm API](https://www.last.fm/api). Create a [Last.fm API account](https://www.last.fm/api/account/create) and configure its API key and the username to track.

The Last.fm shared secret and callback URL are not used. Listening checks for playback changes every seven seconds while the tab is visible and refreshes immediately when the tab regains focus. The current playback response is cached server-side for five seconds.

### Spotify artwork

Album covers and artist photos are provided by the [Spotify Web API](https://developer.spotify.com/documentation/web-api).

Listening uses the Client Credentials flow. It does not require an end-user login, authorization callback, or refresh token. If the Spotify dashboard requires a redirect URI while creating the application, `http://127.0.0.1:3000/callback` is okay because Listening does not visit it.

Spotify is optional. Without it, the Last.fm album image is used for the cover and as the background fallback. Access tokens renew automatically, and complete artwork results are cached for six hours.

### Weather

Weather comes from the [OpenWeatherMap Current Weather API](https://openweathermap.org/current).

By default, the browser requests location once per page session and reuses those coordinates. A custom latitude and longitude can be saved in Listening preferences instead. Weather results refresh every ten minutes and are cached in browser storage, the running server instance, and HTTP caches.

## Attribution

Listening's visual language is heavily inspired by [Descent](https://github.com/JasonPuglisi/descent) by Jason Puglisi. Listening is written independently.

Music data is provided by [Last.fm](https://www.last.fm/), artwork by [Spotify](https://spotify.com/) when configured, and weather data by [OpenWeatherMap](https://openweathermap.org/). The Last.fm favicon and interface mark use the Font Awesome Free icon.

## Development

Listening requires Node.js 22.

```sh
npm ci
npm run check
npm run dev
```

`npm run check` runs the complete test suite, TypeScript validation, and a production build.

## Moving forward

As things stand right now, this is primarily a self-hosted service. The tracked Last.fm username remains a deployment setting, while visitors can customize the public display name locally. Supporting multiple tracked users would require a different persistence and hosting model.

Spotify or Apple Music playback integrations may also be explored for people who do not use Last.fm.

Pull requests are welcome.
