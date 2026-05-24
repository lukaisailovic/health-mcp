export class Mutex {
  private chain: Promise<unknown> = Promise.resolve();
  async run<T>(fn: () => Promise<T> | T): Promise<T> {
    const next = this.chain.then(() => fn());
    this.chain = next.catch(() => undefined);
    return next;
  }
}
