import type { AppRole } from '../types';

export const NEW_YORK_TIME_ZONE = 'America/New_York';

const CENTRAL_ISLIP = {
  latitude: 40.7907,
  longitude: -73.2018,
} as const;

const DAY_MS = 86_400_000;
const RAD = Math.PI / 180;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const J0 = 0.0009;
const OBLIQUITY = RAD * 23.4397;
const SUNSET_ANGLE = RAD * -0.833;

const easternPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NEW_YORK_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: '2-digit',
  hourCycle: 'h23',
});

const easternTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NEW_YORK_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

const easternDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: NEW_YORK_TIME_ZONE,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

interface EasternDateParts {
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
}

export interface DashboardGreeting {
  message: string;
  easternTime: string;
  easternDate: string;
  isSabbath: boolean;
}

function toJulian(date: Date): number {
  return date.getTime() / DAY_MS - 0.5 + J1970;
}

function fromJulian(julian: number): Date {
  return new Date((julian + 0.5 - J1970) * DAY_MS);
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function solarMeanAnomaly(days: number): number {
  return RAD * (357.5291 + 0.98560028 * days);
}

function eclipticLongitude(meanAnomaly: number): number {
  const equationOfCenter = RAD * (
    1.9148 * Math.sin(meanAnomaly)
    + 0.02 * Math.sin(2 * meanAnomaly)
    + 0.0003 * Math.sin(3 * meanAnomaly)
  );
  return meanAnomaly + equationOfCenter + RAD * 102.9372 + Math.PI;
}

function declination(longitude: number): number {
  return Math.asin(Math.sin(longitude) * Math.sin(OBLIQUITY));
}

function hourAngle(height: number, latitude: number, solarDeclination: number): number {
  return Math.acos(
    (Math.sin(height) - Math.sin(latitude) * Math.sin(solarDeclination))
    / (Math.cos(latitude) * Math.cos(solarDeclination)),
  );
}

function solarTransitJulian(approximateTransit: number, meanAnomaly: number, longitude: number): number {
  return J2000 + approximateTransit + 0.0053 * Math.sin(meanAnomaly) - 0.0069 * Math.sin(2 * longitude);
}

function centralIslipSunset(year: number, month: number, day: number): Date {
  const dateAtNoonUtc = new Date(Date.UTC(year, month - 1, day, 12));
  const longitudeWest = RAD * -CENTRAL_ISLIP.longitude;
  const latitude = RAD * CENTRAL_ISLIP.latitude;
  const days = toDays(dateAtNoonUtc);
  const cycle = Math.round(days - J0 - longitudeWest / (2 * Math.PI));
  const approximateNoon = J0 + longitudeWest / (2 * Math.PI) + cycle;
  const meanAnomaly = solarMeanAnomaly(approximateNoon);
  const longitude = eclipticLongitude(meanAnomaly);
  const solarDeclination = declination(longitude);
  const sunsetHourAngle = hourAngle(SUNSET_ANGLE, latitude, solarDeclination);
  const approximateSunset = J0 + (sunsetHourAngle + longitudeWest) / (2 * Math.PI) + cycle;

  return fromJulian(solarTransitJulian(approximateSunset, meanAnomaly, longitude));
}

function getEasternParts(date: Date): EasternDateParts {
  const parts = Object.fromEntries(
    easternPartsFormatter
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: parts.weekday,
    hour: Number(parts.hour),
  };
}

export function isSabbathInNewYork(date: Date): boolean {
  const eastern = getEasternParts(date);
  if (eastern.weekday !== 'Fri' && eastern.weekday !== 'Sat') return false;

  const sunset = centralIslipSunset(eastern.year, eastern.month, eastern.day);
  return eastern.weekday === 'Fri'
    ? date.getTime() >= sunset.getTime()
    : date.getTime() < sunset.getTime();
}

function roleLabel(role: AppRole): string {
  if (role === 'administrator') return 'Administrator';
  if (role === 'pastor') return 'Pastor';
  return 'Usher';
}

export function getDashboardGreeting(date: Date, role: AppRole, displayName: string): DashboardGreeting {
  const eastern = getEasternParts(date);
  const isSabbath = isSabbathInNewYork(date);
  const salutation = isSabbath
    ? 'Happy Sabbath'
    : eastern.hour < 12
      ? 'Good morning'
      : eastern.hour < 17
        ? 'Good afternoon'
        : 'Good evening';
  const person = [roleLabel(role), displayName.trim()].filter(Boolean).join(' ');

  return {
    message: `${salutation}, ${person}.`,
    easternTime: easternTimeFormatter.format(date),
    easternDate: easternDateFormatter.format(date),
    isSabbath,
  };
}
