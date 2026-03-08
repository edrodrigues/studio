import { removeAccents } from './utils';

export interface DetectedPlaceholder {
  originalText: string;    // "<NOME_DO_CONTRATANTE>"
  normalizedKey: string;   // "NOME DO CONTRATANTE"
  format: 'angle' | 'double_brace' | 'bracket';
  position: { start: number; end: number };
}

const PLACEHOLDER_PATTERNS = [
  { regex: /<([^>]+)>/g, format: 'angle' as const },           // <NOME>
  { regex: /\{\{([^}]+)\}\}/g, format: 'double_brace' as const }, // {{NOME}}
  { regex: /\[([^\]]+)\]/g, format: 'bracket' as const }          // [NOME]
];

/**
 * Normalizes a placeholder name by converting to uppercase, removing accents,
 * and replacing underscores/hyphens with spaces.
 */
export function normalizePlaceholderKey(key: string): string {
  if (!key) return '';
  
  // Remove accents
  let normalized = removeAccents(key);
  
  // Convert to uppercase
  normalized = normalized.toUpperCase();
  
  // Replace underscores and hyphens with spaces
  normalized = normalized.replace(/[_-]/g, ' ');
  
  // Remove multiple spaces and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Detects placeholders in a given string content based on multiple formats.
 */
export function detectPlaceholders(content: string): DetectedPlaceholder[] {
  if (!content) return [];
  
  const detected: DetectedPlaceholder[] = [];
  
  for (const { regex, format } of PLACEHOLDER_PATTERNS) {
    // Reset regex lastIndex just in case
    regex.lastIndex = 0;
    
    let match;
    while ((match = regex.exec(content)) !== null) {
      const originalText = match[0];
      const rawKey = match[1];
      
      detected.push({
        originalText,
        normalizedKey: normalizePlaceholderKey(rawKey),
        format,
        position: {
          start: match.index,
          end: match.index + originalText.length
        }
      });
    }
  }
  
  // Sort by position
  return detected.sort((a, b) => a.position.start - b.position.start);
}

/**
 * Returns a unique list of normalized placeholder keys.
 */
export function getUniquePlaceholderKeys(placeholders: DetectedPlaceholder[]): string[] {
  const keys = placeholders.map(p => p.normalizedKey);
  return Array.from(new Set(keys));
}
