import * as Sentry from "@sentry/nextjs";

type LogContext = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /token|secret|password|authorization|signature|api[_-]?key|webhook/i;

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
};

const sanitizeContext = (context: LogContext = {}) => {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : value,
    ]),
  );
};

const writeConsole = (
  level: "info" | "warn" | "error",
  message: string,
  context?: LogContext,
  error?: unknown,
) => {
  const payload = {
    ...sanitizeContext(context),
    ...(error ? { error: serializeError(error) } : {}),
  };

  console[level](message, payload);
};

const writeSentryLog = (
  level: "info" | "warn" | "error",
  message: string,
  context?: LogContext,
) => {
  const payload = sanitizeContext(context);

  if (level === "info") {
    Sentry.logger.info(message, payload);
    return;
  }

  if (level === "warn") {
    Sentry.logger.warn(message, payload);
    return;
  }

  Sentry.logger.error(message, payload);
};

export const captureError = (error: unknown, context?: LogContext) => {
  const safeContext = sanitizeContext(context);

  Sentry.withScope((scope) => {
    Object.entries(safeContext).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    Sentry.captureException(error);
  });
};

export const logger = {
  info(message: string, context?: LogContext) {
    writeConsole("info", message, context);
    writeSentryLog("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    writeConsole("warn", message, context);
    writeSentryLog("warn", message, context);
  },
  error(message: string, error?: unknown, context?: LogContext) {
    writeConsole("error", message, context, error);
    writeSentryLog("error", message, context);

    if (error) {
      captureError(error, {
        ...context,
        logMessage: message,
      });
    }
  },
};
