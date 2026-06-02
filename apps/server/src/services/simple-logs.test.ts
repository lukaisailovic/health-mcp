import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, makeTestCtx } from '../test-utils.js';
import { listWeight, logWeight, recordProviderWeight } from './simple-logs.js';

let ctx: ReturnType<typeof makeTestCtx>;
beforeEach(() => {
  ctx = makeTestCtx();
});
afterEach(() => closeCtx(ctx));

describe('recordProviderWeight', () => {
  it('writes one provider weight per day and skips same-day duplicates', () => {
    const first = recordProviderWeight(ctx, { kg: 80.2, source: 'whoop' });
    expect(first.recorded).toBe(true);

    const second = recordProviderWeight(ctx, { kg: 80.4, source: 'whoop' });
    expect(second.recorded).toBe(false);

    const whoopRows = listWeight(ctx, { date: first.date }).filter((w) => w.source === 'whoop');
    expect(whoopRows).toHaveLength(1);
    expect(whoopRows[0]?.kg).toBe(80.2);
  });

  it('coexists with manual entries without clobbering them', () => {
    recordProviderWeight(ctx, { kg: 79, source: 'whoop' });
    const manual = logWeight(ctx, { kg: 78.5 });
    expect(manual.source).toBe('manual');

    const rows = listWeight(ctx, { date: manual.date });
    expect(rows.filter((w) => w.source === 'whoop')).toHaveLength(1);
    expect(rows.filter((w) => w.source === 'manual')).toHaveLength(1);
  });
});
