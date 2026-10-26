// Reads one field from the client's form post (accept or decline). Depending on the server, the
// body arrives parsed into an object or as the raw urlencoded string, possibly base64-encoded.

type FormEvent = {
  body: unknown;
  rawBody?: string;
  isBase64Encoded?: boolean;
};

const fromRawBody = (event: FormEvent, name: string) => {
  const raw = event.rawBody ?? (typeof event.body === 'string' ? event.body : null);

  if (!raw) {
    return null;
  }

  const text = event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;

  return new URLSearchParams(text).get(name);
};

export const readFormField = (event: FormEvent, name: string, maxLength: number) => {
  const parsed =
    event.body !== null && typeof event.body === 'object'
      ? (event.body as Record<string, unknown>)[name]
      : undefined;
  const value = typeof parsed === 'string' ? parsed : fromRawBody(event, name);
  const trimmed = value?.trim() ?? '';

  return trimmed === '' ? null : trimmed.slice(0, maxLength);
};

// Names are one line: collapse runs of spaces and line breaks someone pasted in.
export const readNameField = (event: FormEvent, name: string, maxLength: number) =>
  readFormField(event, name, maxLength * 2)?.replace(/\s+/g, ' ').slice(0, maxLength) ?? null;
