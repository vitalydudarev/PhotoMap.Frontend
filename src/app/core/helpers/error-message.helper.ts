import {HttpErrorResponse} from '@angular/common/http';

import {ApiException} from '../../shared/models/photomap-backend.swagger';

/** The body of an ASP.NET Core error response (RFC 9457 problem details), validation errors included. */
interface ProblemDetails {
  title?: string;
  detail?: string;
  errors?: Record<string, string[]>;
}

// A reason longer than this is most likely a stack trace or an HTML error page, of no use in a toast.
const MAX_REASON_LENGTH = 300;

/**
 * `message`, followed by why the request failed when the error says so: the server's problem details or text,
 * or the fact that the server could not be reached at all.
 */
export function errorMessage(message: string, error: unknown): string {
  const reason = reasonOf(error);

  return reason ? `${message} ${withFullStop(reason)}` : message;
}

function reasonOf(error: unknown): string | undefined {
  const isHttpError = error instanceof HttpErrorResponse;

  // The generated clients read error bodies as text and wrap them in an ApiException.
  if (!isHttpError && !(error instanceof ApiException)) {
    return undefined;
  }

  // No status means the request never got a response: the server is down, unreachable or refused CORS.
  if (error.status === 0) {
    return 'The server could not be reached.';
  }

  return isHttpError
    ? (fromBody(error.error) ?? describeStatus(error.status, error.statusText))
    : (fromBody(parseJson(error.response)) ?? describeStatus(error.status));
}

function fromBody(body: unknown): string | undefined {
  if (typeof body === 'string') {
    return fromText(body);
  }

  if (!body || typeof body !== 'object') {
    return undefined;
  }

  // HttpClient could not parse the body as the JSON it was labelled as; the raw text is kept alongside.
  if ('text' in body && typeof body.text === 'string') {
    return fromText(body.text);
  }

  const problem = body as ProblemDetails;
  const validationErrors = Object.values(problem.errors ?? {}).flat();

  if (validationErrors.length > 0) {
    return validationErrors.map(withFullStop).join(' ');
  }

  return problem.detail || problem.title || undefined;
}

function fromText(text: string): string | undefined {
  const parsed = parseJson(text);

  if (parsed !== text) {
    return fromBody(parsed);
  }

  const trimmed = text.trim();

  return trimmed && trimmed.length <= MAX_REASON_LENGTH && !trimmed.startsWith('<') ? trimmed : undefined;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function describeStatus(status: number, statusText?: string): string {
  return statusText && statusText !== 'OK' ? `The server responded ${status} ${statusText}.` : `The server responded ${status}.`;
}

function withFullStop(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}
