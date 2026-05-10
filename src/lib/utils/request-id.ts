/**
 * Request ID utilities for structured debugging.
 * Generates short, unique request IDs for tracing operations across server and client.
 */

let requestCounter = 0;

/**
 * Generates a unique request ID for the current execution context.
 * Format: timestamp + counter + random suffix
 */
export function generateRequestId(): string {
  requestCounter++;
  const timestamp = Date.now().toString(36);
  const counter = requestCounter.toString(36).padStart(3, '0');
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp}-${counter}-${random}`;
}

/**
 * Creates a structured log entry with request ID context.
 */
export function createDebugContext(requestId: string, module: string) {
  return {
    requestId,
    module,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Logs a structured debug message with request context.
 */
export function debugLog(
  requestId: string,
  module: string,
  message: string,
  data?: Record<string, unknown>
) {
  const prefix = `[${module}] [req:${requestId}]`;
  if (data) {
    console.log(prefix, message, JSON.stringify(data, (key, value) => {
      // Avoid logging sensitive data
      if (key === 'accessToken' || key === 'token' || key === 'password') return '[REDACTED]';
      return value;
    }));
  } else {
    console.log(prefix, message);
  }
}

/**
 * Logs an error with request context, including stack trace if available.
 */
export function debugError(
  requestId: string,
  module: string,
  message: string,
  error: unknown,
  data?: Record<string, unknown>
) {
  const prefix = `[${module}] [req:${requestId}]`;
  const errorInfo = error instanceof Error ? {
    name: error.name,
    message: error.message,
    stack: error.stack,
  } : { message: String(error) };

  console.error(prefix, message, { error: errorInfo, ...data });
}