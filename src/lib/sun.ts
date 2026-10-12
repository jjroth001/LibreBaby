/**
 * Sunrise and sunset for a calendar date and place, computed on the phone (the "Almanac
 * for Computers" sunrise equation, accurate to a minute or two) — no network, so a
 * location never has to leave the device.
 */

const RAD = Math.PI / 180;
/** Sun's center 50′ below the horizon: refraction + the sun's radius ("official" sunrise). */
const ZENITH = 90.833;

export type SunTimes =
  | { kind: 'normal'; sunrise: number; sunset: number }
  /** Polar day or polar night: the sun doesn't cross the horizon that day. */
  | { kind: 'always-up' | 'always-down' };

function dayOfYear(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000);
}

const normalize = (value: number, range: number) => ((value % range) + range) % range;

/** UTC hour of the event on that date, or a polar marker. */
function eventHour(n: number, lat: number, lon: number, rising: boolean) {
  const lngHour = lon / 15;
  const t = n + ((rising ? 6 : 18) - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  const L = normalize(M + 1.916 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 282.634, 360);
  let RA = normalize(Math.atan(0.91764 * Math.tan(L * RAD)) / RAD, 360);
  RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
  const sinDec = 0.39782 * Math.sin(L * RAD);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH =
    (Math.cos(ZENITH * RAD) - sinDec * Math.sin(lat * RAD)) / (cosDec * Math.cos(lat * RAD));
  if (cosH > 1) return 'always-down' as const;
  if (cosH < -1) return 'always-up' as const;
  const H = (rising ? 360 - Math.acos(cosH) / RAD : Math.acos(cosH) / RAD) / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  return normalize(T - lngHour, 24);
}

/**
 * Sun times for the given *local calendar date* at lat/lon (degrees, east and north
 * positive). Returned instants are unix ms; `localNoonUtc` (the place's solar noon) keeps
 * events on the right day when the UTC date differs from the local one.
 */
export function sunTimes(
  year: number,
  month: number,
  day: number,
  lat: number,
  lon: number,
): SunTimes {
  const n = dayOfYear(year, month, day);
  const rise = eventHour(n, lat, lon, true);
  const set = eventHour(n, lat, lon, false);
  if (typeof rise === 'string') return { kind: rise };
  if (typeof set === 'string') return { kind: set };

  // Solar noon for this longitude, in UTC ms; pick each event's instant nearest the right side of it.
  const solarNoon = Date.UTC(year, month - 1, day, 12) - (lon / 15) * 3_600_000;
  const at = (hour: number, before: boolean) => {
    const base = Date.UTC(year, month - 1, day) + hour * 3_600_000;
    const options = [base - 86_400_000, base, base + 86_400_000];
    // Sunrise is the instant within 12h before solar noon; sunset within 12h after.
    return (
      options.find((ms) =>
        before
          ? ms <= solarNoon && ms > solarNoon - 12 * 3_600_000
          : ms >= solarNoon && ms < solarNoon + 12 * 3_600_000,
      ) ?? base
    );
  };
  return { kind: 'normal', sunrise: at(rise, true), sunset: at(set, false) };
}
