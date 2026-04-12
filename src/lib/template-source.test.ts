import { describe, expect, it } from 'vitest';

import { auditTemplateLinks, isFallbackEligibleErrorType } from './template-source';

describe('auditTemplateLinks', () => {
  it('marks templates with original and custom links as ready_with_fallback', () => {
    const audit = auditTemplateLinks(
      'https://docs.google.com/document/d/1originalTemplateId123456/edit',
      'https://docs.google.com/document/d/1projectTemplateId123456/edit'
    );

    expect(audit.health).toBe('ready_with_fallback');
    expect(audit.googleDocLink.status).toBe('available');
    expect(audit.projectDocLink.status).toBe('available');
  });

  it('marks templates with only a custom link as ready_custom', () => {
    const audit = auditTemplateLinks(
      '',
      'https://docs.google.com/document/d/1projectTemplateId123456/edit'
    );

    expect(audit.health).toBe('ready_custom');
    expect(audit.googleDocLink.status).toBe('missing');
    expect(audit.projectDocLink.status).toBe('available');
  });

  it('marks invalid original links as misconfigured', () => {
    const audit = auditTemplateLinks(
      'https://example.com/not-a-google-doc',
      'https://docs.google.com/document/d/1projectTemplateId123456/edit'
    );

    expect(audit.health).toBe('misconfigured');
    expect(audit.googleDocLink.status).toBe('invalid_format');
  });
});

describe('isFallbackEligibleErrorType', () => {
  it('accepts not found and permission denied as fallback-eligible errors', () => {
    expect(isFallbackEligibleErrorType('TEMPLATE_NOT_FOUND')).toBe(true);
    expect(isFallbackEligibleErrorType('PERMISSION_DENIED')).toBe(true);
    expect(isFallbackEligibleErrorType('INVALID_REQUEST')).toBe(false);
  });

  it('accepts invalid template type as fallback-eligible error', () => {
    expect(isFallbackEligibleErrorType('INVALID_TEMPLATE_TYPE')).toBe(true);
  });
});
