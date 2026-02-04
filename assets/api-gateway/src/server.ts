/**
 * SecureMint Engine - API Gateway
 * REST/GraphQL API layer for SDK operations
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';
import { authMiddleware } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';
import { errorHandler } from './middleware/errorHandler';

// Routes
import { mintRoutes } from './routes/mint';
import { burnRoutes } from './routes/burn';
import { oracleRoutes } from './routes/oracle';
import { treasuryRoutes } from './routes/treasury';
import { bridgeRoutes } from './routes/bridge';
import { complianceRoutes } from './routes/compliance';
import { healthRoutes } from './routes/health';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const config = {
  port: parseInt(process.env.PORT || '3000'),
  env: process.env.NODE_ENV || 'development',
  rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3001'],
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  jwtSecret: process.env.JWT_SECRET || 'development-secret',
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS APP SETUP
// ═══════════════════════════════════════════════════════════════════════════════

async function createApp(): Promise<Express> {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: config.env === 'production' ? undefined : false,
  }));

  // CORS
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
  }));

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Custom middleware
  app.use(loggingMiddleware);

  // Health check (no auth required)
  app.use('/health', healthRoutes);

  // API routes (auth required)
  app.use('/api/mint', authMiddleware, mintRoutes);
  app.use('/api/burn', authMiddleware, burnRoutes);
  app.use('/api/oracle', authMiddleware, oracleRoutes);
  app.use('/api/treasury', authMiddleware, treasuryRoutes);
  app.use('/api/bridge', authMiddleware, bridgeRoutes);
  app.use('/api/compliance', authMiddleware, complianceRoutes);

  // GraphQL setup with security hardening (SEC-007)
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  const apolloServer = new ApolloServer({
    schema,
    introspection: config.env !== 'production',
    plugins: [
      {
        async serverWillStart() {
          return {
            async drainServer() {
              // Cleanup subscriptions
            },
          };
        },
      },
      // SEC-007: Additional introspection protection plugin
      {
        async requestDidStart() {
          return {
            async didResolveOperation({ request, document }) {
              if (config.env === 'production') {
                // Check for introspection queries
                const isIntrospection = request.operationName === 'IntrospectionQuery' ||
                  (document?.definitions || []).some((def: any) =>
                    def.kind === 'OperationDefinition' &&
                    def.selectionSet?.selections?.some((sel: any) =>
                      sel.kind === 'Field' && sel.name?.value === '__schema'
                    )
                  );

                if (isIntrospection) {
                  throw new Error('GraphQL introspection is disabled in production');
                }
              }
            },
          };
        },
      },
    ],
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    cors<cors.CorsRequest>({ origin: config.corsOrigins }),
    express.json(),
    expressMiddleware(apolloServer, {
      context: async ({ req }) => ({
        user: (req as any).user,
        rpcUrl: config.rpcUrl,
      }),
    })
  );

  // Error handling
  app.use(errorHandler);

  return app;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════════════════════════════

async function startServer() {
  const app = await createApp();
  const httpServer = createServer(app);

  // WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const schema = makeExecutableSchema({ typeDefs, resolvers });
  useServer({ schema }, wsServer);

  httpServer.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           SecureMint API Gateway Started                      ║
╠═══════════════════════════════════════════════════════════════╣
║  REST API:    http://localhost:${config.port}/api              ║
║  GraphQL:     http://localhost:${config.port}/graphql          ║
║  Health:      http://localhost:${config.port}/health           ║
║  Environment: ${config.env.padEnd(44)}║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

startServer().catch(console.error);

export { createApp };
