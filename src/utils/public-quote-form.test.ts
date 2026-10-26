import { describe, expect, it } from 'vitest';

import { readFormField, readNameField } from 'src/utils/public-quote-form';

describe('readFormField', () => {
  it('reads a body the server already parsed', () => {
    expect(readFormField({ body: { declineReason: ' Too expensive ' } }, 'declineReason', 100)).toBe(
      'Too expensive',
    );
  });

  it('reads a raw urlencoded body', () => {
    expect(
      readFormField({ body: null, rawBody: 'acceptedByName=Samira+Hadid&x=1' }, 'acceptedByName', 100),
    ).toBe('Samira Hadid');
    expect(readFormField({ body: 'declineReason=Went%20another%20way' }, 'declineReason', 100)).toBe(
      'Went another way',
    );
  });

  it('decodes a base64 body', () => {
    const rawBody = Buffer.from('acceptedByName=Theo').toString('base64');

    expect(readFormField({ body: null, rawBody, isBase64Encoded: true }, 'acceptedByName', 100)).toBe('Theo');
  });

  it('treats missing or blank values as no answer, and caps the length', () => {
    expect(readFormField({ body: null }, 'acceptedByName', 100)).toBeNull();
    expect(readFormField({ body: { acceptedByName: '   ' } }, 'acceptedByName', 100)).toBeNull();
    expect(readFormField({ body: { acceptedByName: 42 } }, 'acceptedByName', 100)).toBeNull();
    expect(readFormField({ body: { declineReason: 'x'.repeat(50) } }, 'declineReason', 10)).toBe('x'.repeat(10));
  });
});

describe('readNameField', () => {
  it('keeps a name on one line', () => {
    expect(readNameField({ body: { acceptedByName: 'Samira \n  Hadid' } }, 'acceptedByName', 120)).toBe(
      'Samira Hadid',
    );
  });
});
