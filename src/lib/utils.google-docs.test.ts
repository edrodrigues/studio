import { describe, it, expect } from 'vitest';
import { extractGoogleDocId } from './utils';

describe('extractGoogleDocId', () => {
  it('should extract ID from a standard Google Doc link', () => {
    const link = 'https://docs.google.com/document/d/1abc123_XYZ-789/edit';
    expect(extractGoogleDocId(link)).toBe('1abc123_XYZ-789');
  });

  it('should extract ID from a link with multiple parameters', () => {
    const link = 'https://docs.google.com/document/d/1-a_b_c_1_2_3/edit?usp=sharing&authuser=0';
    expect(extractGoogleDocId(link)).toBe('1-a_b_c_1_2_3');
  });

  it('should return the ID if it is already a valid ID string', () => {
    const id = '1abc123_XYZ-789012345';
    expect(extractGoogleDocId(id)).toBe(id);
  });

  it('should return null for invalid links', () => {
    const link = 'https://google.com/search?q=something';
    expect(extractGoogleDocId(link)).toBeNull();
  });

  it('should return null for empty or undefined input', () => {
    expect(extractGoogleDocId('')).toBeNull();
    // @ts-ignore
    expect(extractGoogleDocId(null)).toBeNull();
  });

  it('should handle links without trailing slash after ID', () => {
    const link = 'https://docs.google.com/document/d/some-id-here';
    expect(extractGoogleDocId(link)).toBe('some-id-here');
  });
});
