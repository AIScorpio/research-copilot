/**
 * Timezone utilities - Fixed to Beijing Time (UTC+8)
 * All date operations use Beijing Time as anchor
 * 
 * This ensures consistency across all deployment environments:
 * - Local development (any timezone)
 * - Vercel deployment (UTC)
 * - Any other cloud platform
 */

const ANCHOR_TIMEZONE = 'Asia/Shanghai';

/**
 * Get current time in Beijing Time (UTC+8)
 * Returns a Date object representing Beijing Time
 */
export function getBeijingNow(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: ANCHOR_TIMEZONE }));
}

/**
 * Get date code (YYYY-MM-DD) in Beijing Time
 * @param date Optional date, defaults to now
 */
export function getBeijingDateCode(date?: Date): string {
  const d = date 
    ? new Date(date.toLocaleString('en-US', { timeZone: ANCHOR_TIMEZONE }))
    : getBeijingNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Get start and end of a Beijing Time day in UTC (for database queries)
 * @param dateCode Format: "2026-03-22"
 * @returns { startUTC: Date, endUTC: Date }
 * 
 * Example: 
 *   Input: "2026-03-22"
 *   Output: { 
 *     startUTC: 2026-03-21T16:00:00Z,  // Beijing 3/22 00:00 in UTC
 *     endUTC: 2026-03-22T16:00:00Z     // Beijing 3/23 00:00 in UTC
 *   }
 */
export function getBeijingDayRange(dateCode: string): { startUTC: Date; endUTC: Date } {
  const [year, month, day] = dateCode.split('-').map(Number);
  
  // Beijing is UTC+8, so we subtract 8 hours to get UTC
  const startUTC = new Date(Date.UTC(year, month - 1, day, -8, 0, 0));
  const endUTC = new Date(Date.UTC(year, month - 1, day + 1, -8, 0, 0));
  
  return { startUTC, endUTC };
}

/**
 * Check if a UTC timestamp falls within a Beijing Time day
 */
export function isInBeijingDay(timestampUTC: Date, dateCode: string): boolean {
  const { startUTC, endUTC } = getBeijingDayRange(dateCode);
  return timestampUTC >= startUTC && timestampUTC < endUTC;
}

/**
 * Convert UTC timestamp to Beijing Time display string
 */
export function formatBeijingTime(dateUTC: Date): string {
  return dateUTC.toLocaleString('zh-CN', { 
    timeZone: ANCHOR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format date code for display with timezone label
 */
export function formatDateWithTimezone(dateCode: string): string {
  return `${dateCode}（北京时间）`;
}
