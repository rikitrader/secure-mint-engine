/**
 * SecureMint Engine - Sentry Error Tracking
 * Error monitoring and performance tracking
 */

import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { Request, Response, NextFunction } from 'express';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const sentryConfig: Sentry.NodeOptions = {
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version || '1.0.0',

  // Performance Monitoring
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),

  // Integrations
  integrations: [
    new ProfilingIntegration(),
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express(),
    new Sentry.Integrations.Postgres(),
    new Sentry.Integrations.GraphQL(),
  ],

  // Before send hook for filtering
  beforeSend(event, hint) {
    // Filter out expected errors
    const error = hint.originalException;
    if (error instanceof Error) {
      // Don't send rate limit errors
      if (error.message.includes('Rate limit exceeded')) {
        return null;
      }
      // Don't send validation errors
      if (error.name === 'ValidationError') {
        return null;
      }
    }
    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    'Non-Error promise rejection captured',
    'ResizeObserver loop limit exceeded',
    /^Network request failed$/,
  ],

  // Scrub sensitive data
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'http') {
      // Remove authorization headers
      if (breadcrumb.data?.headers) {
        delete breadcrumb.data.headers.authorization;
        delete breadcrumb.data.headers['x-api-key'];
      }
    }
    return breadcrumb;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export function initSentry(): void {
  if (!process.env.SENTRY_DSN) {
    console.log('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init(sentryConfig);
  console.log('Sentry error tracking initialized');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CAPTURING
// ═══════════════════════════════════════════════════════════════════════════════

export interface ErrorContext {
  user?: {
    address?: string;
    apiKey?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  level?: Sentry.SeverityLevel;
}

export function captureError(error: Error, context?: ErrorContext): string {
  Sentry.withScope((scope) => {
    if (context?.user) {
      scope.setUser({
        id: context.user.address,
        username: context.user.apiKey ? `api:${context.user.apiKey.slice(0, 8)}` : undefined,
      });
    }

    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    if (context?.level) {
      scope.setLevel(context.level);
    }
  });

  return Sentry.captureException(error);
}

export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Omit<ErrorContext, 'level'>
): string {
  Sentry.withScope((scope) => {
    if (context?.user) {
      scope.setUser({ id: context.user.address });
    }
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
  });

  return Sentry.captureMessage(message, level);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECUREMINT SPECIFIC ERRORS
// ═══════════════════════════════════════════════════════════════════════════════

export function captureInvariantViolation(
  invariantId: string,
  details: {
    currentValue: string;
    threshold: string;
    timestamp: number;
  }
): string {
  return captureMessage(`Invariant violation: ${invariantId}`, 'error', {
    tags: {
      'securemint.invariant': invariantId,
      'securemint.type': 'invariant_violation',
    },
    extra: details,
  });
}

export function captureOracleStale(
  oracleAddress: string,
  lastUpdate: number,
  threshold: number
): string {
  return captureMessage('Oracle data is stale', 'warning', {
    tags: {
      'securemint.type': 'oracle_stale',
      'securemint.oracle': oracleAddress,
    },
    extra: {
      lastUpdate,
      threshold,
      staleDuration: Date.now() / 1000 - lastUpdate,
    },
  });
}

export function captureMintFailure(
  recipient: string,
  amount: string,
  reason: string,
  error?: Error
): string {
  if (error) {
    return captureError(error, {
      tags: {
        'securemint.type': 'mint_failure',
        'securemint.reason': reason,
      },
      extra: {
        recipient,
        amount,
        reason,
      },
    });
  }

  return captureMessage(`Mint failed: ${reason}`, 'warning', {
    tags: {
      'securemint.type': 'mint_failure',
      'securemint.reason': reason,
    },
    extra: {
      recipient,
      amount,
    },
  });
}

export function captureEmergencyEscalation(
  fromLevel: number,
  toLevel: number,
  triggeredBy: string
): string {
  return captureMessage(`Emergency level escalated: ${fromLevel} -> ${toLevel}`, 'warning', {
    tags: {
      'securemint.type': 'emergency_escalation',
      'securemint.from_level': String(fromLevel),
      'securemint.to_level': String(toLevel),
    },
    extra: {
      fromLevel,
      toLevel,
      triggeredBy,
      timestamp: Date.now(),
    },
  });
}

export function captureContractError(
  contract: string,
  method: string,
  error: Error,
  txData?: any
): string {
  return captureError(error, {
    tags: {
      'securemint.type': 'contract_error',
      'securemint.contract': contract,
      'securemint.method': method,
    },
    extra: {
      contract,
      method,
      txData,
    },
    level: 'error',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

export const sentryRequestHandler = Sentry.Handlers.requestHandler({
  user: ['address'],
  ip: true,
  request: ['method', 'url', 'query_string', 'headers'],
});

export const sentryTracingHandler = Sentry.Handlers.tracingHandler();

export const sentryErrorHandler = Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    // Only report 500 errors
    return !error.status || error.status >= 500;
  },
});

// Custom error handler with SecureMint context
export function secureMintErrorHandler() {
  return (err: any, req: Request, res: Response, next: NextFunction) => {
    // Add SecureMint specific context
    Sentry.withScope((scope) => {
      // Add user context from auth
      if (req.user) {
        scope.setUser({
          id: (req.user as any).address,
          username: (req.user as any).apiKeyId,
        });
      }

      // Add request context
      scope.setTag('endpoint', `${req.method} ${req.path}`);
      scope.setExtra('body', req.body);
      scope.setExtra('query', req.query);
      scope.setExtra('params', req.params);

      // Categorize error
      if (err.code) {
        scope.setTag('error.code', err.code);
      }

      Sentry.captureException(err);
    });

    next(err);
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

export function startTransaction(
  name: string,
  op: string,
  data?: Record<string, any>
): Sentry.Transaction {
  const transaction = Sentry.startTransaction({
    name,
    op,
    data,
  });

  Sentry.getCurrentHub().configureScope((scope) => {
    scope.setSpan(transaction);
  });

  return transaction;
}

export function startSpan(
  transaction: Sentry.Transaction,
  op: string,
  description: string
): Sentry.Span {
  return transaction.startChild({
    op,
    description,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export function setUserContext(address: string, extra?: Record<string, any>): void {
  Sentry.setUser({
    id: address,
    ...extra,
  });
}

export function clearUserContext(): void {
  Sentry.setUser(null);
}

export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, any>,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════════

export async function checkSentryHealth(): Promise<boolean> {
  try {
    // Send a test event to verify connectivity
    const eventId = Sentry.captureMessage('Health check', 'debug');
    return !!eventId;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  initSentry,
  captureError,
  captureMessage,
  captureInvariantViolation,
  captureOracleStale,
  captureMintFailure,
  captureEmergencyEscalation,
  captureContractError,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  secureMintErrorHandler,
  startTransaction,
  startSpan,
  setUserContext,
  clearUserContext,
  addBreadcrumb,
  checkSentryHealth,
};
