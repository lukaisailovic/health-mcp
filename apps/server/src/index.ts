#!/usr/bin/env node
import {
  type Config,
  ConfigError,
  enforceSecurityInvariants,
  helpText,
  parseConfig,
} from './config.js';
import { openDb } from './db/client.js';
import { runMigrations } from './db/migrations.js';
import { runDoctor } from './doctor.js';
import { runExport } from './export.js';
import { createHonoApp } from './http.js';
import { runImportUsda } from './import-usda.js';
import { createLogger } from './logger.js';
import { HealthMcpServer } from './mcp/server.js';
import { startStdioServer } from './mcp/stdio.js';
import { buildAllTools } from './mcp/tools/index.js';
import { createMcpRouter } from './mcp/transport.js';
import { startScheduler } from './scheduler.js';
import { startHttpServer } from './start-http.js';
import { VERSION } from './version.js';
import { AuthStore } from './wearables/auth-store.js';
import { initRegistry } from './wearables/registry.js';

const resolveConfig = (argv: string[]): Config => {
  try {
    const config = parseConfig(argv);
    enforceSecurityInvariants(config);
    return config;
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`config error: ${err.message}\n`);
      process.exit(2);
    }
    throw err;
  }
};

const main = async () => {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(helpText());
    return;
  }
  if (argv.includes('--version')) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  const config = resolveConfig(argv);

  const logger = createLogger(config.logLevel, config.stdio);
  const db = openDb({ path: config.dbPath, allowInsecure: config.allowInsecureDb, logger });

  if (config.subcommand === 'migrate') {
    const result = runMigrations(db, logger);
    process.stdout.write(`${JSON.stringify({ applied: result.applied })}\n`);
    db.close();
    return;
  }

  if (config.subcommand === 'doctor') {
    await runDoctor({ config, db, logger });
    db.close();
    return;
  }

  if (config.subcommand === 'export') {
    const out = config.subcommandArgs[0];
    if (!out) {
      process.stderr.write('export: requires output path\n');
      process.exit(2);
    }
    runExport({ db, outPath: out, includeRaw: config.exportIncludeRaw });
    db.close();
    return;
  }

  if (config.subcommand === 'import-usda') {
    const path = config.subcommandArgs[0];
    if (!path) {
      process.stderr.write('import-usda: requires JSON file path\n');
      process.exit(2);
    }
    if (config.autoMigrate) runMigrations(db, logger);
    const result = runImportUsda({ db, logger, path });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    db.close();
    return;
  }

  if (config.autoMigrate) {
    runMigrations(db, logger);
  }

  const authStore = new AuthStore({
    authDir: config.dataDir,
    allowInsecure: config.allowInsecureAuth,
  });

  const ctx = { db, logger, config, authStore };
  initRegistry(ctx);

  const tools = buildAllTools();
  const createMcpServer = (): HealthMcpServer => {
    const server = new HealthMcpServer({ tools, ctx });
    server.attach();
    return server;
  };

  const startAvailabilityTimer = (getServers: () => HealthMcpServer[]): void => {
    const timer = setInterval(() => {
      for (const server of getServers()) {
        try {
          server.reevaluateAvailability();
        } catch (err) {
          logger.warn('reevaluate availability failed', { error: (err as Error).message });
        }
      }
    }, 30_000);
    timer.unref();
  };

  if (config.stdio) {
    const health = createMcpServer();
    startAvailabilityTimer(() => [health]);
    await startStdioServer(health, logger);
    return;
  }

  const app = createHonoApp({ config, logger, ctx, sdkVersion: '1.x' });
  const router = createMcpRouter({ createServer: createMcpServer, token: config.token, logger });
  startAvailabilityTimer(router.activeServers);
  const stop = await startHttpServer({ app, mcpHandler: router.handle, config, logger });

  const scheduler = startScheduler(ctx, config.whoopSyncCron, logger);

  const shutdown = async () => {
    logger.info('shutting down');
    scheduler.stop();
    await stop();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main().catch((err) => {
  process.stderr.write(`fatal: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
