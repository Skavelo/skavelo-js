// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { Skavelo } from './index';

describe('on the server', () => {
  it('init does nothing instead of throwing, so server rendering never breaks', async () => {
    const sk = Skavelo.init({ agentId: 'a' });
    expect(() => { sk.identify({ id: 'u' }); sk.open(); sk.close(); sk.destroy(); }).not.toThrow();
    await expect(sk.ask('hi')).resolves.toBeUndefined();
    expect(() => Skavelo.identify({ id: 'u' })).not.toThrow();
  });
});
