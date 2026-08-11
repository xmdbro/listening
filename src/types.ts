export interface Track {
  name: string;
  artist: string;
  album: string;
  url: string;
  imageUrl: string;
  playedAt: string | null;
}

export interface NowPlayingData {
  username: string;
  isPlaying: boolean;
  scrobbles: number | null;
  artistScrobbles: number | null;
  trackScrobbles: number | null;
  track: Track | null;
  updatedAt: string;
}

export interface WeatherData {
  label: string;
  symbol: string;
  icon: string;
  temperature: number;
  apparentTemperature: number;
  unit: string;
}
