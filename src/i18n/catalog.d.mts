export function parsePack(source: string, name: string): Record<string, string>;
export function validatePair(base: Record<string, string>, translated: Record<string, string>, name: string): void;
export function formatMessage(message: string, values?: Record<string, string | number>): string;
