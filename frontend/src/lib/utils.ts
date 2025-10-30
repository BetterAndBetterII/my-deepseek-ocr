import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export function formatNumber(n: number | null | undefined) {
  if (n == null || isNaN(Number(n))) return "0";
  return new Intl.NumberFormat().format(Number(n));
}

export function formatBytes(bytes: number | null | undefined) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function parseDateAssumeUTC(input: string | number | Date): Date {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  const s = String(input);
  // If string already has timezone (Z or ±HH:MM) then use native parse
  if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)) return new Date(s);
  // Otherwise, assume UTC ISO-like string without timezone (e.g. 2025-10-30T14:21:59.148484)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/);
  if (m) {
    const [_, Y, Mo, D, H, Mi, S, frac] = m;
    const year = Number(Y);
    const month = Number(Mo) - 1;
    const day = Number(D);
    const hour = Number(H);
    const minute = Number(Mi);
    const sec = Number(S);
    const ms = frac ? Number((frac + '000').slice(0, 3)) : 0; // keep milliseconds
    return new Date(Date.UTC(year, month, day, hour, minute, sec, ms));
  }
  // Fallback
  return new Date(s);
}

export function formatRelativeZH(input: string | number | Date) {
  const d = parseDateAssumeUTC(input);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 1) return "刚刚";
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}天前`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}个月前`;
  const year = Math.floor(month / 12);
  return `${year}年前`;
}
