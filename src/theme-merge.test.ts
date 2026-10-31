// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { setOnly } from './skavelo';

describe('setOnly', () => {
  it("keeps the dashboard's settings when code leaves a value unset", () => {
    const fromDashboard = { accent: '#2F6BFF', position: 'bottom-right' as const };
    const fromCode = { accent: undefined, icon: '', label: 'Ask us' };
    expect({ ...fromDashboard, ...setOnly(fromCode) }).toEqual({
      accent: '#2F6BFF',
      position: 'bottom-right',
      label: 'Ask us',
    });
  });

  it('lets a value set in code win', () => {
    expect({ accent: '#2F6BFF', ...setOnly({ accent: '#111111' }) }.accent).toBe('#111111');
  });
});
