/**
 * SecureMint Engine - OpenTelemetry Tracing
 * Distributed tracing and observability setup
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode, Span, SpanKind } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const serviceName = process.env.OTEL_SERVICE_NAME || 'securemint-api';
const serviceVersion = process.env.npm_package_version || '1.0.0';
const environment = process.env.NODE_ENV || 'development';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

// ═══════════════════════════════════════════════════════════════════════════════
// OPENTELEMETRY SDK SETUP
// ═══════════════════════════════════════════════════════════════════════════════

const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]: serviceName,
  [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  'service.namespace': 'securemint',
  'service.instance.id': process.env.HOSTNAME || `${serviceName}-${process.pid}`,
});

const traceExporter = new OTLPTraceExporter({
  url: `${otlpEndpoint}/v1/traces`,
  headers: {
    'x-api-key': process.env.OTEL_API_KEY || '',
  },
});

const metricExporter = new OTLPMetricExporter({
  url: `${otlpEndpoint}/v1/metrics`,
  headers: {
    'x-api-key': process.env.OTEL_API_KEY || '',
  },
});

const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000, // Export every 60 seconds
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingPaths: ['/health', '/metrics'],
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-redis': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-graphql': {
        enabled: true,
        mergeItems: true,
      },
    }),
  ],
  textMapPropagator: new W3CTraceContextPropagator(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export function initTracing(): void {
  if (process.env.OTEL_ENABLED === 'false') {
    console.log('OpenTelemetry tracing is disabled');
    return;
  }

  sdk.start();
  console.log('OpenTelemetry tracing initialized');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('OpenTelemetry shut down'))
      .catch((error) => console.error('Error shutting down OpenTelemetry', error));
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACER
// ═══════════════════════════════════════════════════════════════════════════════

export const tracer = trace.getTracer(serviceName, serviceVersion);

// ═══════════════════════════════════════════════════════════════════════════════
// SPAN HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface SpanOptions {
  kind?: SpanKind;
  attributes?: Record<string, string | number | boolean>;
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: SpanOptions
): Promise<T> {
  return tracer.startActiveSpan(
    name,
    {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes,
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error: any) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

export function createSpan(name: string, options?: SpanOptions): Span {
  return tracer.startSpan(name, {
    kind: options?.kind || SpanKind.INTERNAL,
    attributes: options?.attributes,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM ATTRIBUTES
// ═══════════════════════════════════════════════════════════════════════════════

export const SecureMintAttributes = {
  // Token operations
  TOKEN_ADDRESS: 'securemint.token.address',
  TOKEN_AMOUNT: 'securemint.token.amount',
  TOKEN_RECIPIENT: 'securemint.token.recipient',

  // Oracle operations
  ORACLE_ADDRESS: 'securemint.oracle.address',
  ORACLE_ROUND_ID: 'securemint.oracle.round_id',
  ORACLE_VALUE: 'securemint.oracle.value',

  // Mint operations
  MINT_AMOUNT: 'securemint.mint.amount',
  MINT_RECIPIENT: 'securemint.mint.recipient',
  MINT_SUCCESS: 'securemint.mint.success',
  MINT_REASON: 'securemint.mint.reason',

  // Invariants
  INVARIANT_ID: 'securemint.invariant.id',
  INVARIANT_PASSED: 'securemint.invariant.passed',

  // Emergency
  EMERGENCY_LEVEL: 'securemint.emergency.level',

  // User context
  USER_ADDRESS: 'securemint.user.address',
  USER_API_KEY: 'securemint.user.api_key',

  // Transaction
  TX_HASH: 'securemint.tx.hash',
  TX_GAS_USED: 'securemint.tx.gas_used',
  TX_BLOCK_NUMBER: 'securemint.tx.block_number',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// TRACED OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function tracedMintSimulation(
  recipient: string,
  amount: string,
  fn: () => Promise<any>
): Promise<any> {
  return withSpan(
    'mint.simulate',
    async (span) => {
      span.setAttribute(SecureMintAttributes.MINT_RECIPIENT, recipient);
      span.setAttribute(SecureMintAttributes.MINT_AMOUNT, amount);

      const result = await fn();

      span.setAttribute(SecureMintAttributes.MINT_SUCCESS, result.success);
      if (result.reason) {
        span.setAttribute(SecureMintAttributes.MINT_REASON, result.reason);
      }

      return result;
    },
    { kind: SpanKind.INTERNAL }
  );
}

export async function tracedOracleRead(
  oracleAddress: string,
  fn: () => Promise<any>
): Promise<any> {
  return withSpan(
    'oracle.read',
    async (span) => {
      span.setAttribute(SecureMintAttributes.ORACLE_ADDRESS, oracleAddress);

      const result = await fn();

      if (result.roundId) {
        span.setAttribute(SecureMintAttributes.ORACLE_ROUND_ID, result.roundId);
      }
      if (result.value) {
        span.setAttribute(SecureMintAttributes.ORACLE_VALUE, result.value);
      }

      return result;
    },
    { kind: SpanKind.CLIENT }
  );
}

export async function tracedInvariantCheck(
  invariantId: string,
  fn: () => Promise<boolean>
): Promise<boolean> {
  return withSpan(
    'invariant.check',
    async (span) => {
      span.setAttribute(SecureMintAttributes.INVARIANT_ID, invariantId);

      const passed = await fn();

      span.setAttribute(SecureMintAttributes.INVARIANT_PASSED, passed);

      return passed;
    },
    { kind: SpanKind.INTERNAL }
  );
}

export async function tracedContractCall(
  contractAddress: string,
  method: string,
  fn: () => Promise<any>
): Promise<any> {
  return withSpan(
    `contract.${method}`,
    async (span) => {
      span.setAttribute('contract.address', contractAddress);
      span.setAttribute('contract.method', method);

      const result = await fn();

      if (result.hash) {
        span.setAttribute(SecureMintAttributes.TX_HASH, result.hash);
      }

      return result;
    },
    { kind: SpanKind.CLIENT }
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT PROPAGATION
// ═══════════════════════════════════════════════════════════════════════════════

export function getCurrentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  return span?.spanContext().traceId;
}

export function getCurrentSpanId(): string | undefined {
  const span = trace.getActiveSpan();
  return span?.spanContext().spanId;
}

export function addEventToCurrentSpan(name: string, attributes?: Record<string, any>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

export function setCurrentSpanAttribute(key: string, value: string | number | boolean): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute(key, value);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

import { Request, Response, NextFunction } from 'express';

export function tracingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const span = trace.getActiveSpan();

    if (span) {
      // Add request attributes
      span.setAttribute('http.request_id', req.headers['x-request-id'] as string || '');
      span.setAttribute('http.user_agent', req.headers['user-agent'] || '');

      // Add trace ID to response headers
      res.setHeader('X-Trace-ID', span.spanContext().traceId);

      // Capture response status
      res.on('finish', () => {
        span.setAttribute('http.status_code', res.statusCode);
      });
    }

    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  initTracing,
  tracer,
  withSpan,
  createSpan,
  SecureMintAttributes,
  tracedMintSimulation,
  tracedOracleRead,
  tracedInvariantCheck,
  tracedContractCall,
  getCurrentTraceId,
  getCurrentSpanId,
  addEventToCurrentSpan,
  setCurrentSpanAttribute,
  tracingMiddleware,
};
