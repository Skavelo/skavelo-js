import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { SkaveloCfg, SkavelEvent, UserContext } from '../../../src/types';
import { Skavelo, type SkaveloWidget } from '../../../src/index';

// ─── Context ────────────────────────────────────────────────────────────────

interface SkaveloContextValue {
  /** The widget, once started. null during server rendering and the first render. */
  sk: SkaveloWidget | null;
  isReady: boolean;
  open: () => void;
  close: () => void;
  ask: (question: string) => void;
}

const SkaveloContext = createContext<SkaveloContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export type SkaveloProviderProps = SkaveloCfg & {
  children?: React.ReactNode;
  /** @deprecated Pass the settings as props instead: <SkaveloProvider agentId="…">. */
  cfg?: SkaveloCfg;
};

/**
 * Starts Skavelo once for your app. Put it at the root, around everything.
 *
 * @example
 * ```tsx
 * <SkaveloProvider agentId="…" user={currentUser && { id: currentUser.id, plan: currentUser.plan }}>
 *   <App />
 * </SkaveloProvider>
 * ```
 */
export function SkaveloProvider({ children, cfg, ...props }: SkaveloProviderProps) {
  const settings: SkaveloCfg = { ...cfg, ...props };
  const [sk, setSk] = useState<SkaveloWidget | null>(null);
  const latest = useRef(settings);
  latest.current = settings;

  // Effects only run in the browser, so this is safe with server rendering (Next.js, Remix).
  useEffect(() => {
    let instance: SkaveloWidget | null = null;
    try {
      instance = Skavelo.init(latest.current);
      setSk(instance);
    } catch (err) {
      console.error('[Skavelo] Failed to start:', err);
    }
    // Removes the widget when the provider unmounts or the agent changes.
    return () => {
      instance?.destroy();
      setSk(null);
    };
  }, [settings.agentId, settings.workspaceId, settings.apiUrl]);

  // Tell Skavelo whenever the signed-in user, or what you know about them, changes.
  const userKey = settings.user ? JSON.stringify(settings.user) : '';
  useEffect(() => {
    if (sk && latest.current.user?.id) sk.identify(latest.current.user);
  }, [sk, userKey]);

  const value: SkaveloContextValue = {
    sk,
    isReady: !!sk,
    open: () => { sk?.open(); },
    close: () => { sk?.close(); },
    ask: (q: string) => { sk?.ask(q); },
  };
  return <SkaveloContext.Provider value={value}>{children}</SkaveloContext.Provider>;
}

/** @deprecated Misspelled early name; use SkaveloProvider. */
export const SkaveloPovider = SkaveloProvider;

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Open the widget, ask a question for the user, or check it's ready, from any component inside
 * `<SkaveloProvider>`.
 *
 * @example
 * ```tsx
 * const { ask } = useSkavelo();
 * <button onClick={() => ask('How do I export invoices?')}>Help with exports</button>
 * ```
 */
export function useSkavelo(): SkaveloContextValue {
  const ctx = useContext(SkaveloContext);
  if (!ctx) throw new Error('useSkavelo must be used inside <SkaveloProvider>');
  return ctx;
}

/**
 * Run code when something happens in the widget. The handler doesn't need to be memoized.
 *
 * @example
 * ```tsx
 * useSkaveloEvent('walkthrough_complete', ({ workflowId }) => analytics.track('guide_done', { workflowId }));
 * ```
 */
export function useSkaveloEvent<T extends SkavelEvent['type']>(
  event: T,
  handler: (e: Extract<SkavelEvent, { type: T }>) => void,
) {
  const { sk } = useSkavelo();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!sk) return;
    const stable = (e: Extract<SkavelEvent, { type: T }>) => handlerRef.current(e);
    sk.on(event, stable);
    return () => { sk.off(event, stable); };
  }, [sk, event]);
}

/** @deprecated Use useSkaveloEvent. */
export const useSkavelEvent = useSkaveloEvent;

// ─── Components ──────────────────────────────────────────────────────────────

export interface SkaveloLauncherProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
}

/**
 * Your own button that opens the widget, for a "Help" item in your navigation. Renders nothing
 * until the widget is ready, so it doesn't flash during hydration.
 */
export function SkaveloLauncher({ label = 'Get help', ...props }: SkaveloLauncherProps) {
  const { open, isReady } = useSkavelo();
  if (!isReady) return null;
  return (
    <button type="button" onClick={open} {...props}>
      {label}
    </button>
  );
}

/** @deprecated Use SkaveloLauncher. */
export const SkavelLauncher = SkaveloLauncher;

export interface SkaveloIdentifyProps {
  user: UserContext;
}

/**
 * Identifies the signed-in user from anywhere inside the provider, for apps that only know the
 * user deep in the tree. Passing `user` to SkaveloProvider does the same thing.
 */
export function SkaveloIdentify({ user }: SkaveloIdentifyProps) {
  const { sk } = useSkavelo();
  const key = JSON.stringify(user);
  useEffect(() => {
    if (sk && user.id) sk.identify(user);
  }, [sk, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** @deprecated Use SkaveloIdentify. */
export const SkavelIdentify = SkaveloIdentify;

export type { SkaveloCfg, UserContext, SkavelEvent, EventHandler } from '../../../src/types';
export type { SkaveloWidget } from '../../../src/index';
