import { SessionType } from '@prisma/client';
import { DateTime } from 'luxon';
import type { AppEnv } from '../config/env.js';

export interface ConfiguredSessionTime {
  sessionType: SessionType;
  hour: number;
}

export function getNowInZone(timeZone: string): DateTime {
  return DateTime.now().setZone(timeZone);
}

export function toDateKey(dateTime: DateTime): string {
  return dateTime.toISODate() ?? dateTime.toFormat('yyyy-MM-dd');
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function getConfiguredSessionTimes(env: AppEnv): ConfiguredSessionTime[] {
  return [
    { sessionType: SessionType.MORNING, hour: env.SESSION_MORNING_HOUR },
    { sessionType: SessionType.AFTERNOON, hour: env.SESSION_AFTERNOON_HOUR },
    { sessionType: SessionType.EVENING, hour: env.SESSION_EVENING_HOUR }
  ];
}

export function buildSessionStart(dateKey: string, hour: number, timeZone: string): Date {
  return DateTime.fromISO(dateKey, { zone: timeZone }).set({ hour, minute: 0, second: 0, millisecond: 0 }).toUTC().toJSDate();
}

export function toDateOnly(dateKey: string, timeZone: string): Date {
  return DateTime.fromISO(dateKey, { zone: timeZone }).startOf('day').toUTC().toJSDate();
}

export function formatSessionLabel(dateKey: string, sessionType: SessionType): string {
  return `${sessionType.toLowerCase()} session on ${dateKey}`;
}
