/**
 * The script-tag loader, published as cdn.skavelo.com/skavelo.js. It's tiny and cached briefly;
 * the widget itself lives at a versioned address that never changes, so browsers keep it for a
 * year, and a new release reaches everyone as soon as this loader points to it.
 *
 * Until the widget arrives, `Skavelo` here is a stand-in: init() returns a widget that remembers
 * what's asked of it (identify, open, on, ask...) and passes it all on once the real one exists.
 * So the install snippet, Google Tag Manager and the preview bookmark work exactly as before.
 */

/** Replaced at build time: the widget's path next to this loader, like "0.1.0/skavelo.js". */
declare const __SK_BUNDLE__: string;

type Call = [method: string, args: unknown[], settle?: (v: unknown) => void, fail?: (e: unknown) => void];
interface Widget {
  [method: string]: (...args: unknown[]) => unknown;
}
interface Api {
  init(cfg: unknown): unknown;
  identify(user: unknown): void;
}

const METHODS = ['identify', 'open', 'close', 'ask', 'startWorkflow', 'event', 'on', 'off', 'destroy'];
const w = window as unknown as { Skavelo?: Api & { __loader?: true } };

if (!w.Skavelo) {
  const script = document.currentScript as HTMLScriptElement | null;
  const here = script?.src ? script.src.slice(0, script.src.lastIndexOf('/') + 1) : 'https://cdn.skavelo.com/';
  let real: Api | null = null;
  const pendingIdentify: unknown[] = [];
  const stand: { cfg: unknown; calls: Call[]; widget: Widget | null; proxy: Widget }[] = [];

  /** Stands in for one widget: remembers calls until the real widget exists, then forwards them. */
  const standIn = (cfg: unknown) => {
    const entry = { cfg, calls: [] as Call[], widget: null as Widget | null, proxy: {} as Widget };
    for (const m of METHODS) {
      entry.proxy[m] = (...args: unknown[]) => {
        if (entry.widget) return entry.widget[m](...args);
        if (m === 'ask') return new Promise((settle, fail) => entry.calls.push([m, args, settle, fail]));
        entry.calls.push([m, args]);
        return m === 'destroy' ? undefined : entry.proxy;
      };
    }
    stand.push(entry);
    return entry.proxy;
  };

  const ready = () => {
    real = w.Skavelo && !w.Skavelo.__loader ? w.Skavelo : null;
    if (!real) return;
    for (const user of pendingIdentify) real.identify(user);
    for (const entry of stand) {
      // A widget removed before it arrived is never started.
      if (entry.calls.some(([m]) => m === 'destroy')) continue;
      entry.widget = real.init(entry.cfg) as Widget;
      for (const [m, args, settle, fail] of entry.calls) {
        try {
          const out = entry.widget[m](...args);
          settle?.(out);
        } catch (err) {
          if (fail) fail(err);
          else console.error('[Skavelo]', err);
        }
      }
      entry.calls = [];
    }
  };

  w.Skavelo = {
    __loader: true,
    init: (cfg: unknown) => (real ? real.init(cfg) : standIn(cfg)),
    identify: (user: unknown) => {
      if (real) real.identify(user);
      else pendingIdentify.push(user);
    },
  };

  const bundle = document.createElement('script');
  bundle.src = here + __SK_BUNDLE__;
  bundle.async = true;
  bundle.onload = ready;
  bundle.onerror = () => console.warn(`[Skavelo] The widget couldn't be loaded from ${bundle.src}.`);
  (document.head || document.documentElement).appendChild(bundle);
}
