import { describe, expect, it } from 'vitest';
import { ConfigError, enforceSecurityInvariants, parseConfig } from './config.js';

describe('config', () => {
  it('defaults to loopback host and HTTP port 7777', () => {
    const c = parseConfig([]);
    expect(c.host).toBe('127.0.0.1');
    expect(c.port).toBe(7777);
  });

  it('--stdio toggles stdio mode', () => {
    const c = parseConfig(['--stdio']);
    expect(c.stdio).toBe(true);
  });

  it('rejects off-loopback host without a token', () => {
    const c = parseConfig(['--host', '0.0.0.0']);
    expect(() => enforceSecurityInvariants(c)).toThrow(ConfigError);
  });

  it('rejects short/low-entropy token', () => {
    const c = parseConfig([
      '--host',
      '0.0.0.0',
      '--token',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ]);
    expect(() => enforceSecurityInvariants(c)).toThrow(ConfigError);
  });

  it('accepts strong token on off-loopback host', () => {
    const strong = `${'x'.repeat(8) + 'Q'.repeat(8)}wo!Zk1Pm5bg9TfRq`;
    expect(strong.length).toBeGreaterThanOrEqual(32);
    const c = parseConfig(['--host', '0.0.0.0', '--token', strong]);
    expect(() => enforceSecurityInvariants(c)).not.toThrow();
  });

  it('--data-dir relocates dbPath', () => {
    const c = parseConfig(['--data-dir', '/custom/storage']);
    expect(c.dataDir).toBe('/custom/storage');
    expect(c.dbPath).toBe('/custom/storage/data.db');
  });
});
