import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely creates a Date object from a value.
 * Returns null if the value is invalid.
 */
export function safeNewDate(value: any): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Checks if a value is a valid date that can be formatted.
 */
export function isValidDate(value: any): boolean {
  if (!value) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

export const fileToDataURI = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Removes accents and special characters from a string.
 */
export function removeAccents(str: string): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalizes placeholder/entity keys for comparisons across extraction,
 * template analysis, and deterministic Google Docs replacements.
 */
export function normalizeTemplateKey(value: string): string {
  return removeAccents(value || '')
    .replace(/[<>{}\[\]()]/g, ' ')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Detects values that still look like unresolved placeholders rather than
 * concrete entity values extracted from project documents.
 */
export function looksLikeTemplatePlaceholderValue(value: unknown, key?: string): boolean {
  const stringValue = String(value ?? '').trim();

  if (!stringValue) {
    return true;
  }

  if (!/[A-Za-z0-9À-ÿ]/.test(stringValue)) {
    return true;
  }

  if (
    /^(<<.+>>|\{\{.+\}\}|\[\[.+\]\]|<[^<>\s][^<>]*>)$/u.test(stringValue) ||
    /^(?:placeholder|campo|variavel|variável)$/iu.test(stringValue)
  ) {
    return true;
  }

  if (key && normalizeTemplateKey(stringValue) === normalizeTemplateKey(key)) {
    return true;
  }

  return false;
}

/**
 * Extracts a Google Doc ID from a shared link.
 * Matches both full links (https://docs.google.com/document/d/ID/edit)
 * and the ID directly.
 */
export function extractGoogleDocId(link: string): string | null {
  if (!link) return null;
  const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  // Check if it's already an ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(link)) return link;
  return null;
}

/**
 * Extracts the document ID from a Google Docs URL.
 * Specifically matches /document/d/ pattern to avoid matching other /d/ segments.
 * @param url A Google Docs URL (e.g., https://docs.google.com/document/d/DOCUMENT_ID/edit)
 * @returns The document ID or null if not found
 */
export function extractDocumentId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}
