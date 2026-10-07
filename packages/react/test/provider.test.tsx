// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { SkaveloProvider, SkaveloLauncher, useSkavelo } from '../src/index';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// No network in tests: config requests just hang, which is fine for mounting.
vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

const widgets = () => document.querySelectorAll('#skavelo-root').length;

afterEach(() => { document.body.innerHTML = ''; });

describe('SkaveloProvider', () => {
  it('renders on the server without touching the browser', () => {
    expect(renderToString(<SkaveloProvider agentId="a"><p>app</p></SkaveloProvider>)).toContain('app');
  });

  it('shows exactly one widget under strict mode, and removes it on unmount', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => {
      root.render(<StrictMode><SkaveloProvider agentId="11111111-1111-1111-1111-111111111111"><p>app</p></SkaveloProvider></StrictMode>);
    });
    expect(widgets()).toBe(1);
    await act(async () => { root.unmount(); });
    expect(widgets()).toBe(0);
  });

  it('gives children the widget once it is ready', async () => {
    let ready = false;
    function Child() {
      ready = useSkavelo().isReady;
      return <SkaveloLauncher label="Help" />;
    }
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => {
      root.render(<SkaveloProvider agentId="22222222-2222-2222-2222-222222222222"><Child /></SkaveloProvider>);
    });
    expect(ready).toBe(true);
    expect(el.querySelector('button')?.textContent).toBe('Help');
    await act(async () => { root.unmount(); });
  });
});
