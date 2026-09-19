import { ApiError, type ApiLocale } from './response';

export type Notice = string | Error | { key: string };
export class LocalizedError extends Error {
  constructor(public key: string) { super(key); this.name = 'LocalizedError'; }
}

/** 번역된 문자열을 저장하지 않고 표시 시점의 언어로 해석한다. */
export function noticeText(notice: Notice, locale: ApiLocale, translate: (key: string) => string): string {
  if (typeof notice === 'string') return notice;
  if (notice instanceof ApiError) return notice.messages?.[locale] ?? notice.message;
  if (notice instanceof LocalizedError) return translate(notice.key);
  if (notice instanceof Error) return notice.message;
  return translate(notice.key);
}
