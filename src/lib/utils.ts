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
