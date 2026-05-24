import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Logger } from '../logger.js';
import type { HealthMcpServer } from './server.js';

export const startStdioServer = async (health: HealthMcpServer, logger: Logger): Promise<void> => {
  const transport = new StdioServerTransport();
  await health.underlying().connect(transport);
  logger.info('stdio transport connected');
  await new Promise<void>((resolve) => {
    const onClose = () => resolve();
    process.stdin.on('close', onClose);
    process.on('SIGINT', onClose);
    process.on('SIGTERM', onClose);
  });
};
