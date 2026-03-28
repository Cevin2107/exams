import { format, differenceInSeconds, isBefore, isValid } from "date-fns";
import { vi } from "date-fns/locale";

/**
 * Format date wrapper utilizing date-fns with Vietnamese locale.
 */
export function formatVietnamTime(date: Date, formatStr: string = "HH:mm · dd/MM/yyyy") {
  if (!isValid(date)) return null;
  return format(date, formatStr, { locale: vi });
}

export function formatRemainingTime(remainingSeconds: number) {
  if (remainingSeconds <= 0) return null;
  
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  
  const parts: string[] = [];
  if (days) parts.push(`${days} ngày`);
  if (hours) parts.push(`${hours} giờ`);
  if (minutes) parts.push(`${minutes} phút`);
  if (!days && seconds) parts.push(`${Math.floor(seconds)} giây`);
  
  return parts.length ? parts.join(" ") : "Đã hết hạn";
}

export function formatDigitalClock(seconds: number) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

export function isUrgentWarning(targetDate: Date | string, now: Date | number = Date.now()) {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  if (!isValid(target)) return false;
  
  const diffInSecs = differenceInSeconds(target, typeof now === 'number' ? new Date(now) : now);
  // Urgent if less than 24 hours (86400 seconds)
  return diffInSecs > 0 && diffInSecs < 86400;
}

export function isOverdueFunc(targetDate: Date | string, now: Date | number = Date.now()) {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  if (!isValid(target)) return false;
  
  return isBefore(target, typeof now === 'number' ? new Date(now) : now);
}
