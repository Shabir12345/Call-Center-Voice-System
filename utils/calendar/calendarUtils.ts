/**
 * Calendar Utilities
 * 
 * Helper functions for timezone conversion, date formatting, and calendar operations
 */

import { AvailableSlot, AvailabilityQuery, FreeBusyResponse } from '../../types/calendarTypes';

/**
 * Convert date to specific timezone
 */
export function convertToTimezone(date: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');

  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/**
 * Format date for API requests (ISO 8601)
 */
export function formatDateForAPI(date: Date, timezone?: string): string {
  if (timezone) {
    const tzDate = convertToTimezone(date, timezone);
    return tzDate.toISOString();
  }
  return date.toISOString();
}

/**
 * Parse date from API response
 */
export function parseDateFromAPI(dateString: string, timezone?: string): Date {
  const date = new Date(dateString);
  if (timezone) {
    // Adjust for timezone if needed
    return convertToTimezone(date, timezone);
  }
  return date;
}

/**
 * Check if date is within business hours
 */
export function isWithinBusinessHours(
  date: Date,
  businessHours?: { start: string; end: string; daysOfWeek?: number[] }
): boolean {
  if (!businessHours) {
    return true; // No restrictions
  }

  const dayOfWeek = date.getDay();
  if (businessHours.daysOfWeek && !businessHours.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }

  const [startHour, startMinute] = businessHours.start.split(':').map(Number);
  const [endHour, endMinute] = businessHours.end.split(':').map(Number);

  const currentHour = date.getHours();
  const currentMinute = date.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Find available slots from free/busy data
 */
export function findAvailableSlots(
  freeBusy: FreeBusyResponse,
  query: AvailabilityQuery
): AvailableSlot[] {
  const slots: AvailableSlot[] = [];
  const durationMs = query.duration * 60 * 1000;

  // Sort busy periods by start time
  const busyPeriods = [...freeBusy.busy].sort((a, b) => a.start.getTime() - b.start.getTime());

  let currentTime = new Date(query.start);

  while (currentTime.getTime() + durationMs <= query.end.getTime()) {
    const slotEnd = new Date(currentTime.getTime() + durationMs);

    // Check if slot is excluded
    if (query.excludeDates) {
      const isExcluded = query.excludeDates.some(excludedDate => {
        const excludedDay = new Date(excludedDate);
        excludedDay.setHours(0, 0, 0, 0);
        const currentDay = new Date(currentTime);
        currentDay.setHours(0, 0, 0, 0);
        return excludedDay.getTime() === currentDay.getTime();
      });
      if (isExcluded) {
        currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000); // Skip 30 minutes
        continue;
      }
    }

    // Check if slot conflicts with busy periods
    const hasConflict = busyPeriods.some(busy => {
      return (
        (currentTime.getTime() >= busy.start.getTime() && currentTime.getTime() < busy.end.getTime()) ||
        (slotEnd.getTime() > busy.start.getTime() && slotEnd.getTime() <= busy.end.getTime()) ||
        (currentTime.getTime() <= busy.start.getTime() && slotEnd.getTime() >= busy.end.getTime())
      );
    });

    // Check business hours
    const withinHours = isWithinBusinessHours(currentTime, query.businessHours);

    if (!hasConflict && withinHours) {
      slots.push({
        start: new Date(currentTime),
        end: new Date(slotEnd),
        duration: query.duration,
        available: true
      });
    }

    // Move to next potential slot (15-minute increments)
    currentTime = new Date(currentTime.getTime() + 15 * 60 * 1000);
  }

  return slots;
}

/**
 * Check if two time ranges overlap
 */
export function timeRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1.getTime() < end2.getTime() && end1.getTime() > start2.getTime();
}

/**
 * Get default timezone for a provider
 */
export function getDefaultTimezone(provider: 'google' | 'outlook' | 'apple'): string {
  // Try to get user's timezone, fallback to UTC
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`;
}

/**
 * Round time to nearest interval (e.g., 15 minutes)
 */
export function roundToNearestInterval(date: Date, intervalMinutes: number = 15): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.round(minutes / intervalMinutes) * intervalMinutes;
  rounded.setMinutes(roundedMinutes, 0, 0);
  return rounded;
}

/**
 * Get start of day in timezone
 */
export function getStartOfDay(date: Date, timezone?: string): Date {
  const d = timezone ? convertToTimezone(date, timezone) : new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day in timezone
 */
export function getEndOfDay(date: Date, timezone?: string): Date {
  const d = timezone ? convertToTimezone(date, timezone) : new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

