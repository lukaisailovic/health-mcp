import { spawn } from 'node:child_process';
import { platform } from 'node:os';

const launchers: Record<string, { cmd: string; args: (url: string) => string[] }> = {
  darwin: { cmd: 'open', args: (url) => [url] },
  win32: { cmd: 'cmd', args: (url) => ['/c', 'start', '', url] },
};

const defaultLauncher = { cmd: 'xdg-open', args: (url: string) => [url] };

export const openBrowser = (url: string): void => {
  const launcher = launchers[platform()] ?? defaultLauncher;
  const child = spawn(launcher.cmd, launcher.args(url), {
    stdio: 'ignore',
    detached: true,
  });
  child.on('error', () => {});
  child.unref();
};
