import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
