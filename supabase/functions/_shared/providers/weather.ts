/** The next 48 hours at one point: what the worker caches per weather cell (`fetchedAt` is the cache's own column). */
export interface WeatherForecast {
  rainNext48hMm: number;
  maxTempNext48hC: number;
}

export interface WeatherProvider {
  /**
   * The forecast at a weather-cell centre (never a home or zone centre), with `timeZone` the cell's IANA tz.
   * Rejects on any failure; the caller logs and skips the cell.
   */
  forecast(lat: number, lng: number, timeZone: string): Promise<WeatherForecast>;
}

/** Dry and mild: changes no schedule. */
export const FAKE_WEATHER: WeatherForecast = Object.freeze({
  rainNext48hMm: 0,
  maxTempNext48hC: 18,
});

/** For local stacks and tests only (selection refuses it elsewhere). */
export function fakeWeatherProvider(summary: WeatherForecast = FAKE_WEATHER): WeatherProvider {
  return { forecast: () => Promise.resolve({ ...summary }) };
}
