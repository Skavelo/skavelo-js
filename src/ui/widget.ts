import type { ThemeCfg, FeedbackRating, Suggestion } from '../types';

const FONT = `'Instrument Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`;

const WIDGET_CSS = `
  :host { all: initial; }

  .sk-dock {
    --sk-surface: #FFFFFF;
    --sk-subtle: #F4F4F5;
    --sk-line: #E4E4E7;
    --sk-text: #18181B;
    --sk-text-2: #52525B;
    --sk-text-3: #A1A1AA;
    --sk-shadow: 0 1px 2px rgba(24,24,27,.06), 0 12px 32px rgba(24,24,27,.14), 0 32px 64px -12px rgba(24,24,27,.20);
    /* The button and floating suggestions sit straight on the page, so they need a firmer lift than the panel. */
    --sk-float: 0 0 0 1px rgba(24,24,27,.04), 0 2px 6px rgba(24,24,27,.08), 0 0 40px rgba(24,24,27,.12), 0 24px 56px -10px rgba(24,24,27,.24);
    position: fixed;
    z-index: 2147483645;
    display: flex;
    flex-direction: column;
    pointer-events: none;
    font-family: ${FONT};
    color: var(--sk-text);
    -webkit-font-smoothing: antialiased;
  }
  .sk-dock *, .sk-dock *::before, .sk-dock *::after { box-sizing: border-box; }
  .sk-dock > * { pointer-events: auto; }
  .sk-dock [hidden], .sk-dock[hidden] { display: none !important; }
  .sk-pos-center { left: 50%; transform: translateX(-50%); align-items: center; }
  .sk-pos-right { align-items: flex-end; }
  .sk-pos-left { align-items: flex-start; }

  button { font: inherit; color: inherit; background: none; border: none; padding: 0; margin: 0; cursor: pointer; }
  button:focus-visible, input:focus-visible { outline: 2px solid var(--sk-accent); outline-offset: 2px; }

  .sk-mark { flex-shrink: 0; color: var(--sk-text); }
  /* Flex, so the logo centres on the text instead of sitting on its baseline. */
  .sk-brand { display: flex; align-items: center; flex-shrink: 0; }
  .sk-brand svg { display: block; }
  .sk-mark .sk-dot { fill: var(--sk-accent); }

  @keyframes sk-in { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }

  /* Pill */
  .sk-pill {
    position: relative;
    isolation: isolate;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    height: 52px;
    padding: 0 18px 0 14px;
    border-radius: 14px;
    border: 1px solid var(--sk-line);
    background: color-mix(in srgb, var(--sk-surface) 92%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: var(--sk-float);
    font-size: 15px;
    font-weight: 500;
    color: var(--sk-text-2);
    animation: sk-in 220ms cubic-bezier(.2,.8,.2,1);
    transition: transform 140ms cubic-bezier(.2,.8,.2,1), color 140ms ease;
  }
  .sk-pill::before {
    content: '';
    position: absolute;
    inset: -16px -10px;
    z-index: -1;
    border-radius: 999px;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--sk-accent) 30%, transparent), transparent);
    filter: blur(12px);
    opacity: .35;
    transition: opacity 220ms ease;
  }
  .sk-pill:hover::before, .sk-pill:focus-visible::before { opacity: 1; }
  .sk-pill--intro::before { animation: sk-glow 1.6s ease-in-out 2; }
  .sk-pill:hover { transform: translateY(-1px); color: var(--sk-text); }
  .sk-pill:active { transform: translateY(0) scale(.98); }
  @keyframes sk-glow { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }

  /* Composer */
  .sk-composer {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    width: min(540px, calc(100vw - 32px));
    height: 52px;
    padding: 0 14px 0 18px;
    border-radius: 16px;
    border: 1px solid var(--sk-line);
    background: color-mix(in srgb, var(--sk-surface) 94%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: var(--sk-shadow);
    animation: sk-in 200ms cubic-bezier(.2,.8,.2,1);
  }
  .sk-composer .sk-mark { color: var(--sk-text-3); }

  /* Suggestions, above the launcher and the input bar until the first question is asked. */
  .sk-suggest { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; max-width: min(540px, calc(100vw - 32px)); pointer-events: none; }
  .sk-suggest > * { pointer-events: auto; }
  .sk-pos-center .sk-suggest { justify-content: center; }
  .sk-pos-right .sk-suggest { justify-content: flex-end; }
  /* Over the launcher they float on the page, so they arrive gently and can be put away. */
  .sk-suggest--float { flex-direction: column; flex-wrap: nowrap; max-width: min(340px, calc(100vw - 32px)); }
  .sk-pos-right .sk-suggest--float { align-items: flex-end; }
  .sk-pos-left .sk-suggest--float { align-items: flex-start; }
  .sk-pos-center .sk-suggest--float { align-items: center; }
  .sk-suggest--float .sk-chip { animation: sk-in 260ms cubic-bezier(.2,.8,.2,1) both; }
  .sk-suggest--float .sk-chip:nth-child(2) { animation-delay: 60ms; }
  .sk-suggest--float .sk-chip:nth-child(3) { animation-delay: 120ms; }
  @media (max-width: 480px) { .sk-suggest--float .sk-chip:nth-child(n+3) { display: none; } }
  /* The top chip carries the close button just outside it, so the chip itself stays aligned. */
  .sk-suggest-row { position: relative; display: flex; }
  .sk-suggest-row .sk-suggest-x { position: absolute; top: 0; bottom: 0; margin: auto 0; left: calc(100% + 6px); }
  .sk-pos-right .sk-suggest-row .sk-suggest-x { left: auto; right: calc(100% + 6px); }
  .sk-suggest-x {
    width: 24px;
    height: 24px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    border: 1px solid var(--sk-line);
    background: var(--sk-surface);
    color: var(--sk-text-2);
    box-shadow: var(--sk-float);
    animation: sk-in 260ms cubic-bezier(.2,.8,.2,1) both;
  }
  .sk-suggest-x:hover { color: var(--sk-text); }
  .sk-chip {
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid var(--sk-line);
    background: var(--sk-surface);
    color: var(--sk-text);
    font-size: 14px;
    line-height: 1.3;
    text-align: left;
    box-shadow: var(--sk-float);
    transition: border-color 120ms ease, background 120ms ease;
  }
  .sk-chip:hover { border-color: color-mix(in srgb, var(--sk-accent) 45%, var(--sk-line)); background: var(--sk-subtle); }
  .sk-composer input { font-size: 16px; }
  .sk-x {
    position: absolute;
    top: -11px;
    right: -11px;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: var(--sk-text-2);
    color: var(--sk-surface);
    display: grid;
    place-items: center;
    box-shadow: 0 2px 6px rgba(0,0,0,.18);
  }

  input.sk-field {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    font-family: inherit;
    font-size: 15px;
    color: var(--sk-text);
  }
  input.sk-field::placeholder { color: color-mix(in srgb, var(--sk-text-3) 55%, var(--sk-text-2)); }
  input.sk-field:focus-visible { outline: none; }

  .sk-icon-btn {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 8px;
    display: grid;
    place-items: center;
    color: var(--sk-text-2);
    transition: background 120ms ease, color 120ms ease;
  }
  .sk-icon-btn:hover { background: var(--sk-subtle); color: var(--sk-text); }

  /* Panel */
  .sk-panel {
    display: flex;
    flex-direction: column;
    width: min(420px, calc(100vw - 32px));
    max-height: min(560px, calc(100vh - 48px));
    border-radius: 18px;
    border: 1px solid var(--sk-line);
    background: var(--sk-surface);
    box-shadow: var(--sk-shadow);
    overflow: hidden;
    animation: sk-in 220ms cubic-bezier(.2,.8,.2,1);
    transition: width 220ms cubic-bezier(.2,.8,.2,1), height 220ms cubic-bezier(.2,.8,.2,1);
  }
  .sk-panel.sk-expanded {
    width: min(720px, calc(100vw - 32px));
    height: min(720px, calc(100vh - 48px));
    max-height: none;
  }
  .sk-head {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 14px 12px 14px 20px;
    border-bottom: 1px solid var(--sk-line);
  }
  .sk-title {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sk-body { flex: 1; min-height: 0; overflow-y: auto; }
  .sk-messages { display: flex; flex-direction: column; gap: 18px; padding: 18px 20px; }
  .sk-msg { font-size: 14.5px; line-height: 1.55; overflow-wrap: anywhere; }
  .sk-msg p { margin: 0 0 8px; }
  .sk-msg p:last-child { margin-bottom: 0; }
  .sk-msg strong { font-weight: 600; }
  .sk-msg code { font-family: ui-monospace, monospace; font-size: .9em; background: var(--sk-subtle); padding: 1px 5px; border-radius: 4px; }
  .sk-msg--user {
    align-self: flex-end;
    max-width: 85%;
    padding: 9px 16px;
    border-radius: 18px;
    background: var(--sk-subtle);
    color: var(--sk-text-2);
  }
  .sk-msg--assistant { align-self: stretch; color: var(--sk-text); }
  .sk-msg--status { color: var(--sk-text-2); font-size: 0.92em; }
  .sk-streaming > p:last-child::after {
    content: '';
    display: inline-block;
    width: 7px;
    height: 1.05em;
    margin-left: 2px;
    vertical-align: -0.15em;
    border-radius: 1px;
    background: var(--sk-accent);
    animation: sk-caret 1s steps(1) infinite;
  }
  @keyframes sk-caret { 50% { opacity: 0; } }

  .sk-sources { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .sk-source {
    font-size: 12px;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--sk-line);
    color: var(--sk-text-2);
    text-decoration: none;
  }
  a.sk-source:hover { border-color: var(--sk-accent); color: var(--sk-accent); }

  .sk-vote { display: flex; gap: 2px; margin-top: 8px; }
  .sk-vote button { width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center; color: var(--sk-text-3); }
  .sk-vote button:hover:not(:disabled) { background: var(--sk-subtle); color: var(--sk-text-2); }
  .sk-vote button[aria-pressed="true"] { color: var(--sk-accent); }
  .sk-vote button:disabled { cursor: default; }
  /* Ratings show on the latest answer; older answers reveal them on hover or focus. */
  .sk-msg--assistant > .sk-vote, .sk-msg--assistant > .sk-rate { opacity: 0; transition: opacity 160ms ease; }
  .sk-msg--assistant.sk-latest > .sk-vote, .sk-msg--assistant.sk-latest > .sk-rate,
  .sk-msg--assistant:hover > .sk-vote, .sk-msg--assistant:hover > .sk-rate,
  .sk-msg--assistant:focus-within > .sk-vote, .sk-msg--assistant:focus-within > .sk-rate,
  .sk-voted { opacity: 1 !important; }
  .sk-rate { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 13px; color: var(--sk-text-3); }
  .sk-rate .sk-vote { margin-top: 0; }
  .sk-replay {
    display: inline-flex; align-items: center; gap: 6px; margin-top: 10px;
    font-size: 13.5px; font-weight: 500; color: var(--sk-text);
    text-decoration: underline; text-decoration-color: var(--sk-line); text-underline-offset: 3px;
  }
  .sk-replay:hover { text-decoration-color: currentColor; }
  .sk-replay svg { width: 14px; height: 14px; color: var(--sk-text-3); }

  /* An action the visitor approves before it runs. */
  .sk-action { margin-top: 10px; padding: 12px 14px; border: 1px solid var(--sk-line); border-radius: 12px; background: var(--sk-subtle); }
  .sk-action-name { font-size: 12px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase; color: var(--sk-text-3); }
  .sk-action-inputs { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 8px 0 0; font-size: 13.5px; }
  .sk-action-inputs dt { color: var(--sk-text-3); }
  .sk-action-inputs dd { margin: 0; color: var(--sk-text); overflow-wrap: anywhere; }
  .sk-action-buttons { display: flex; gap: 8px; margin-top: 12px; }
  .sk-action-buttons button { padding: 7px 14px; border-radius: 8px; font-size: 14px; font-weight: 500; }
  .sk-action-run { background: var(--sk-accent); color: #fff; }
  .sk-action-run:hover:not(:disabled) { filter: brightness(1.08); }
  .sk-action-run:disabled { opacity: .6; cursor: default; }
  .sk-action-cancel { color: var(--sk-text-2); }
  .sk-action-cancel:hover:not(:disabled) { background: var(--sk-line); color: var(--sk-text); }
  .sk-action-status { margin-top: 10px; font-size: 13.5px; color: var(--sk-text-2); }
  .sk-action-status--ok { color: var(--sk-text); }

  /* Handoff: a button under an answer, then the email form or a status line in its place. */
  .sk-handoff { margin-top: 10px; }
  .sk-handoff-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--sk-line); border-radius: 999px; font-size: 13.5px; font-weight: 500; color: var(--sk-text); }
  .sk-handoff-btn:hover:not(:disabled) { background: var(--sk-subtle); }
  .sk-handoff-btn:disabled { opacity: .6; cursor: default; }
  .sk-handoff-form { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--sk-line); border-radius: 12px; background: var(--sk-subtle); }
  .sk-handoff-form label { font-size: 13px; font-weight: 500; color: var(--sk-text-2); }
  .sk-handoff-form input, .sk-handoff-form textarea {
    width: 100%; padding: 8px 10px; border: 1px solid var(--sk-line); border-radius: 8px;
    background: var(--sk-surface); color: var(--sk-text); font: inherit; font-size: 14px; resize: vertical;
  }
  .sk-handoff-form input:focus-visible, .sk-handoff-form textarea:focus-visible { outline: 2px solid var(--sk-accent); outline-offset: 1px; }
  .sk-handoff-form .sk-action-buttons { margin-top: 4px; }
  .sk-handoff-error { font-size: 13px; color: #B42318; }
  .sk-handoff-status { font-size: 13.5px; color: var(--sk-text-2); }

  .sk-icon { flex-shrink: 0; object-fit: contain; border-radius: 4px; }
  .sk-icon-pulse { animation: sk-icon-pulse 1.4s ease-in-out infinite; }
  @keyframes sk-icon-pulse { 0%, 100% { opacity: .45; transform: scale(.92); } 50% { opacity: 1; transform: scale(1); } }

  .sk-thinking { display: flex; align-items: center; gap: 12px; font-size: 15px; color: var(--sk-text-3); }

  /* Loader from the Skavelo motion kit: the route draws, the dot lands, loop every 2s. */
  .sk-loader { flex-shrink: 0; color: var(--sk-text); }
  .sk-loader .sk-dot { fill: var(--sk-accent); }
  .sk-l-start { animation: sk-l-start 2s infinite; }
  .sk-l-route { stroke-dasharray: 77.3; stroke-dashoffset: 77.3; animation: sk-l-route 2s infinite; }
  .sk-l-end { transform-origin: 14.5px 43px; transform-box: view-box; animation: sk-l-end 2s infinite; }
  .sk-l-all { animation: sk-l-all 2s infinite; }
  @keyframes sk-l-start { 0% { opacity: .25; animation-timing-function: cubic-bezier(.2,.8,.2,1); } 6%, 100% { opacity: 1; } }
  @keyframes sk-l-route { 0% { stroke-dashoffset: 77.3; animation-timing-function: cubic-bezier(.2,.8,.2,1); } 50%, 100% { stroke-dashoffset: 0; } }
  @keyframes sk-l-end { 0%, 48% { opacity: 0; transform: scale(.3); animation-timing-function: cubic-bezier(.3,1.4,.6,1); } 62%, 100% { opacity: 1; transform: scale(1); } }
  @keyframes sk-l-all { 0%, 88% { opacity: 1; animation-timing-function: ease-in; } 100% { opacity: 0; } }

  /* Walkthrough */
  .sk-step { padding: 18px 20px 4px; }
  .sk-step-text { font-size: 15px; line-height: 1.55; }
  .sk-step-text strong { font-weight: 600; }
  .sk-step-note { margin-top: 6px; font-size: 13px; color: var(--sk-text-3); }
  .sk-step-nav {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
    padding: 14px 0 10px;
    border-top: 1px solid var(--sk-line);
  }
  /* Step marker: the accent dot from the end of the logo, with a soft halo. */
  .sk-stepmark {
    width: 9px;
    height: 9px;
    flex-shrink: 0;
    margin: 0 4px;
    border-radius: 999px;
    background: var(--sk-accent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--sk-accent) 18%, transparent);
  }
  .sk-count { flex: 1; font-size: 14px; color: var(--sk-text-3); }
  .sk-nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 8px;
    font-size: 14.5px;
    color: var(--sk-text-2);
  }
  .sk-nav-btn:hover:not(:disabled) { background: var(--sk-subtle); color: var(--sk-text); }
  .sk-nav-btn:disabled { opacity: .35; cursor: default; }
  .sk-nav-btn--next { color: var(--sk-text); font-weight: 500; }

  /* Follow-up input */
  .sk-ask {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 16px 16px;
    padding: 6px 6px 6px 16px;
    border: 1px solid var(--sk-line);
    border-radius: 14px;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .sk-ask:focus-within { border-color: color-mix(in srgb, var(--sk-accent) 55%, var(--sk-line)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sk-accent) 14%, transparent); }
  .sk-ask input.sk-field { padding: 8px 0; }
  .sk-ask .sk-icon-btn { width: 34px; height: 34px; border-radius: 999px; background: var(--sk-subtle); }
  .sk-ask .sk-icon-btn:hover { background: var(--sk-line); }

  .sk-foot {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    border-top: 1px solid var(--sk-line);
    background: color-mix(in srgb, var(--sk-subtle) 60%, var(--sk-surface));
    font-size: 12.5px;
    color: var(--sk-text-3);
  }
  .sk-foot strong { font-weight: 600; color: var(--sk-text-2); }
  .sk-foot .sk-mark { color: var(--sk-text-2); }

  .sk-dock.sk-dark {
    --sk-surface: #1C1C1F;
    --sk-subtle: #27272A;
    --sk-line: #34343A;
    --sk-text: #F4F4F5;
    --sk-text-2: #C4C4CC;
    --sk-text-3: #85858F;
    --sk-shadow: 0 1px 2px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.45), 0 32px 64px -12px rgba(0,0,0,.55);
      --sk-float: 0 2px 6px rgba(0,0,0,.45), 0 0 40px rgba(0,0,0,.5), 0 24px 56px -10px rgba(0,0,0,.65);
  }
  @media (prefers-color-scheme: dark) {
    .sk-dock:not(.sk-light) {
      --sk-surface: #1C1C1F;
      --sk-subtle: #27272A;
      --sk-line: #34343A;
      --sk-text: #F4F4F5;
      --sk-text-2: #C4C4CC;
      --sk-text-3: #85858F;
      --sk-shadow: 0 1px 2px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.45), 0 32px 64px -12px rgba(0,0,0,.55);
      --sk-float: 0 2px 6px rgba(0,0,0,.45), 0 0 40px rgba(0,0,0,.5), 0 24px 56px -10px rgba(0,0,0,.65);
    }
  }

  /* Dashboard preview: sits inside its frame instead of the viewport. */
  .sk-dock.sk-preview { position: absolute; z-index: 1; }
  .sk-preview .sk-panel { max-height: calc(100% - 24px); }

  @media (prefers-reduced-motion: reduce) {
    .sk-dock *, .sk-dock *::before { animation: none !important; transition: none !important; }
    .sk-l-route { stroke-dashoffset: 0; }
  }
`;

const ICONS = {
  replay: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  closeSmall: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  expand: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  chevron: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  arrowUp: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  stop: '<svg width="12" height="12" viewBox="0 0 12 12"><rect width="12" height="12" rx="2" fill="currentColor"/></svg>',
  thumbUp: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.1 21H7"/></svg>',
  thumbDown: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3Zm0 0-4 8a3 3 0 0 1-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.4-8A2 2 0 0 1 5.9 3H17"/></svg>',
  person: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  arrowLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
  arrowRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

function mark(size: number): string {
  const w = Math.round(size * 32 / 44);
  return `<svg class="sk-mark" width="${w}" height="${size}" viewBox="8 6 32 44" aria-hidden="true">
    <circle cx="36" cy="11" r="3" fill="none" stroke="currentColor" stroke-width="2.52"/>
    <path d="M31 11H20A8 8 0 0 0 20 27H28A8 8 0 0 1 28 43H20" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle class="sk-dot" cx="14.5" cy="43" r="4.5"/>
  </svg>`;
}

function loader(size: number): string {
  const w = Math.round(size * 32 / 44);
  return `<svg class="sk-loader" width="${w}" height="${size}" viewBox="8 6 32 44" aria-hidden="true">
    <g class="sk-l-all">
      <circle class="sk-l-start" cx="36" cy="11" r="3" fill="none" stroke="currentColor" stroke-width="2.52"/>
      <path class="sk-l-route" d="M31 11H20A8 8 0 0 0 20 27H28A8 8 0 0 1 28 43H20" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle class="sk-l-end sk-dot" cx="14.5" cy="43" r="4.5"/>
    </g>
  </svg>`;
}

function isDark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

const DEFAULT_ACCENT = { light: '#A3224A', dark: '#E0456F' };

/** invoiceId → "Invoice id", for the action card. */
function labelFor(key: string): string {
  const words = key.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Minimal, escape-first markdown: paragraphs, line breaks, **bold**, `code`. */
function renderText(text: string): string {
  return escapeHtml(text.trim())
    .split(/\n{2,}/)
    .map((para) => `<p>${para
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export interface WidgetEvents {
  /** suggestionId is set when the question came from a suggestion. */
  onAsk: (question: string, suggestionId?: string) => void;
  onStop: () => void;
  onOpen: () => void;
  onClose: () => void;
  onStepNext: () => void;
  onStepBack: () => void;
  onFeedback: (messageId: string, rating: FeedbackRating) => void;
  /** The visitor is about to ask: pointing at the widget, focusing it or typing. */
  onIntent?: () => void;
}

export interface StepDisplay {
  title: string;
  instruction: string;
  stepIndex: number;
  total: number;
  found: boolean;
}

export type View = 'pill' | 'composer' | 'panel';

/** Theme plus the plan-controlled branding flag, which customers can't set from code. */
export type AppliedTheme = ThemeCfg & { branding?: boolean };

/** What the "Talk to a person" click can do next. */
export interface HandoffOffer {
  /** Replace the button with a status line. */
  done(text: string): void;
  /** Put the button back. */
  cancel(): void;
  /** Ask for the visitor's email; send returns an error to show, or null once it went through. */
  askEmail(defaultEmail: string | undefined, send: (email: string, note: string) => Promise<string | null>): void;
}

export class Widget {
  private events: WidgetEvents;
  private dock: HTMLDivElement;
  private pill: HTMLButtonElement;
  private composer: HTMLDivElement;
  private composerInput: HTMLInputElement;
  private suggestEl: HTMLDivElement;
  private suggestions: Suggestion[] = [];
  /** Over the launcher, suggestions wait a moment after the page loads, and stay away once dismissed. */
  private floatReady = false;
  private floatDismissed = false;
  private floatTimer = 0;
  private panel: HTMLDivElement;
  private titleEl: HTMLSpanElement;
  private bodyEl: HTMLDivElement;
  private messagesEl: HTMLDivElement;
  private stepEl: HTMLDivElement;
  private askInput: HTMLInputElement;
  private askBtn: HTMLButtonElement;
  private thinkingEl: HTMLElement | null = null;
  private view: View = 'pill';
  private loading = false;
  private hasConversation = false;
  private icon: string | undefined;
  private title = 'Help';
  private theme: AppliedTheme = {};
  private scheme: 'light' | 'dark' | null = null;
  private preview: boolean;
  private answerEls = new Map<string, HTMLElement>();

  constructor(
    shadowRoot: ShadowRoot,
    theme: AppliedTheme | undefined,
    events: WidgetEvents,
    opts: { preview?: boolean } = {},
  ) {
    this.events = events;
    this.preview = !!opts.preview;

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(WIDGET_CSS);
    shadowRoot.adoptedStyleSheets = [...(shadowRoot.adoptedStyleSheets ?? []), sheet];

    this.dock = document.createElement('div');
    this.dock.className = this.preview ? 'sk-dock sk-preview' : 'sk-dock';

    this.dock.innerHTML = `
      <div class="sk-suggest" role="list" aria-label="Suggestions" hidden></div>

      <button class="sk-pill" type="button" aria-haspopup="dialog"><span class="sk-brand"></span><span class="sk-label"></span></button>

      <div class="sk-composer" hidden>
        <span class="sk-brand"></span>
        <input class="sk-field" type="text" placeholder="Ask a question" aria-label="Ask a question" autocomplete="off" />
        <button class="sk-icon-btn sk-composer-send" type="button" aria-label="Send">${ICONS.chevron}</button>
        <button class="sk-x" type="button" aria-label="Close">${ICONS.closeSmall}</button>
      </div>

      <div class="sk-panel" role="dialog" aria-label="Help" hidden>
        <div class="sk-head">
          <span class="sk-title"></span>
          <button class="sk-icon-btn sk-expand" type="button" aria-label="Expand" aria-pressed="false">${ICONS.expand}</button>
          <button class="sk-icon-btn sk-panel-close" type="button" aria-label="Close">${ICONS.close}</button>
        </div>
        <div class="sk-body">
          <div class="sk-messages" aria-live="polite"></div>
          <div class="sk-step" hidden>
            <div class="sk-step-text"></div>
            <div class="sk-step-note" hidden>This item isn't visible on the current page. It may be on another screen.</div>
            <div class="sk-step-nav">
              <span class="sk-stepmark" aria-hidden="true"></span>
              <span class="sk-count"></span>
              <button class="sk-nav-btn sk-back" type="button">${ICONS.arrowLeft}<span>Back</span></button>
              <button class="sk-nav-btn sk-nav-btn--next sk-next" type="button"><span>Next</span>${ICONS.arrowRight}</button>
            </div>
          </div>
        </div>
        <form class="sk-ask">
          <input class="sk-field" type="text" placeholder="Ask a follow-up" aria-label="Ask a follow-up" autocomplete="off" />
          <button class="sk-icon-btn" type="button" aria-label="Send">${ICONS.arrowUp}</button>
        </form>
        <div class="sk-foot">Powered by ${mark(13)}<strong>Skavelo</strong></div>
      </div>
    `;

    const $ = <T extends Element>(sel: string) => this.dock.querySelector(sel) as T;
    this.pill = $('.sk-pill');
    this.composer = $('.sk-composer');
    this.suggestEl = $('.sk-suggest');
    this.composerInput = $('.sk-composer input');
    this.panel = $('.sk-panel');
    this.titleEl = $('.sk-title');
    this.bodyEl = $('.sk-body');
    this.messagesEl = $('.sk-messages');
    this.stepEl = $('.sk-step');
    this.askInput = $('.sk-ask input');
    this.askBtn = $('.sk-ask button');

    this.applyTheme(theme ?? {});

    // Pulse the glow only the first time the pill appears in this browser session.
    try {
      if (!this.preview && !sessionStorage.getItem('_sk_intro')) {
        sessionStorage.setItem('_sk_intro', '1');
        this.pill.classList.add('sk-pill--intro');
        this.pill.addEventListener('animationend', () => this.pill.classList.remove('sk-pill--intro'), { once: true });
      }
    } catch {}

    this.pill.addEventListener('click', () => this.open());
    $('.sk-x').addEventListener('click', () => this.close());
    $('.sk-panel-close').addEventListener('click', () => this.close());
    $('.sk-composer-send').addEventListener('click', () => this.submit(this.composerInput));
    this.composerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.submit(this.composerInput); }
    });
    // Enter only ever sends; stopping takes a deliberate click so typing ahead can't cancel an answer.
    $<HTMLFormElement>('.sk-ask').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!this.loading) this.submit(this.askInput);
    });
    this.askBtn.addEventListener('click', () => {
      if (this.loading) this.events.onStop();
      else this.submit(this.askInput);
    });
    $('.sk-expand').addEventListener('click', (e) => {
      const expanded = this.panel.classList.toggle('sk-expanded');
      (e.currentTarget as HTMLElement).setAttribute('aria-pressed', String(expanded));
    });
    $('.sk-back').addEventListener('click', () => this.events.onStepBack());
    $('.sk-next').addEventListener('click', () => this.events.onStepNext());
    // Pointing at a suggestion, focusing the input or typing usually comes seconds before a question.
    for (const type of ['pointerenter', 'focusin', 'input'] as const) {
      this.dock.addEventListener(type, () => this.events.onIntent?.(), { passive: true });
    }
    this.dock.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.view !== 'pill') this.close();
    });

    shadowRoot.appendChild(this.dock);
  }

  // ─── Views ────────────────────────────────────────────────────────────────

  open() {
    this.setView(this.hasConversation ? 'panel' : 'composer');
    this.events.onOpen();
  }

  close() {
    if (this.view === 'pill') return;
    this.setView('pill');
    this.events.onClose();
  }

  private setView(view: View) {
    this.view = view;
    this.pill.hidden = view !== 'pill';
    this.composer.hidden = view !== 'composer';
    this.panel.hidden = view !== 'panel';
    // Opening the widget answers a nudge either way.
    if (view !== 'pill') { this.nudgeItem = null; clearTimeout(this.nudgeTimer); }
    this.renderSuggestions();
    // A preview inside the dashboard must never pull focus away from the settings form.
    if (this.preview) return;
    if (view === 'composer') this.composerInput.focus();
    if (view === 'panel') this.askInput.focus();
    if (view === 'pill') this.pill.focus({ preventScroll: true });
  }

  private submit(input: HTMLInputElement) {
    const q = input.value.trim();
    if (!q || this.loading) return;
    input.value = '';
    this.showQuestion(q);
    this.events.onAsk(q);
  }

  /**
   * Suggestions for this page. They show above the launcher without opening anything (up to
   * three, dismissible for the visit), and above the input bar, until someone asks something.
   */
  setSuggestions(suggestions: Suggestion[]) {
    this.suggestions = suggestions.slice(0, 4);
    if (!this.floatReady && !this.floatTimer && this.suggestions.length) {
      // In the dashboard preview they show straight away.
      if (this.preview) this.floatReady = true;
      else this.floatTimer = window.setTimeout(() => { this.floatReady = true; this.renderSuggestions(); }, 1200);
    }
    this.renderSuggestions();
  }

  private nudgeItem: { chip: string; onAccept: () => void; onDismiss: () => void } | null = null;
  private nudgeTimer = 0;

  /**
   * Offers help over the launcher when the visitor seems stuck: one chip with the question, which
   * goes away by itself after a while. Only while the widget is closed.
   */
  nudge(chip: string, onAccept: () => void, onDismiss: () => void): boolean {
    if (this.view !== 'pill' || this.loading) return false;
    this.nudgeItem = { chip, onAccept, onDismiss };
    clearTimeout(this.nudgeTimer);
    this.nudgeTimer = window.setTimeout(() => this.clearNudge(), 25_000);
    this.renderSuggestions();
    return true;
  }

  private clearNudge() {
    clearTimeout(this.nudgeTimer);
    if (!this.nudgeItem) return;
    this.nudgeItem = null;
    this.renderSuggestions();
  }

  private renderNudge(): boolean {
    const n = this.nudgeItem;
    if (!n || this.view !== 'pill') return false;
    this.suggestEl.hidden = false;
    this.suggestEl.classList.add('sk-suggest--float');
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sk-chip';
    chip.setAttribute('role', 'listitem');
    chip.textContent = n.chip;
    chip.addEventListener('click', () => {
      this.nudgeItem = null;
      clearTimeout(this.nudgeTimer);
      n.onAccept();
    });
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'sk-suggest-x';
    x.setAttribute('aria-label', 'No thanks');
    x.innerHTML = ICONS.closeSmall;
    x.addEventListener('click', () => {
      n.onDismiss();
      this.clearNudge();
    });
    const row = document.createElement('div');
    row.className = 'sk-suggest-row';
    row.append(chip, x);
    this.suggestEl.replaceChildren(row);
    return true;
  }

  private renderSuggestions() {
    if (this.renderNudge()) return;
    try { this.floatDismissed ||= sessionStorage.getItem('_sk_suggest_off') === '1'; } catch {}
    const float = this.view === 'pill' && this.floatReady && !this.floatDismissed;
    const show = !this.hasConversation && this.suggestions.length > 0 && (this.view === 'composer' || float);
    this.suggestEl.hidden = !show;
    this.suggestEl.classList.toggle('sk-suggest--float', float);
    if (!show) return;
    const chips: HTMLElement[] = (float ? this.suggestions.slice(0, 3) : this.suggestions).map((s) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'sk-chip';
      chip.setAttribute('role', 'listitem');
      chip.textContent = s.title;
      chip.addEventListener('click', () => {
        if (this.loading) return;
        this.showQuestion(s.title);
        this.events.onAsk(s.title, s.id);
      });
      return chip;
    });
    if (float && chips.length) {
      const x = document.createElement('button');
      x.type = 'button';
      x.className = 'sk-suggest-x';
      x.setAttribute('aria-label', 'Hide suggestions');
      x.innerHTML = ICONS.closeSmall;
      x.addEventListener('click', () => {
        this.floatDismissed = true;
        try { if (!this.preview) sessionStorage.setItem('_sk_suggest_off', '1'); } catch {}
        this.renderSuggestions();
      });
      const row = document.createElement('div');
      row.className = 'sk-suggest-row';
      row.append(chips[0], x);
      chips[0] = row;
    }
    this.suggestEl.replaceChildren(...chips);
  }

  /** Hides the whole widget, for pages or visitors its targeting rules leave out. */
  setHidden(hidden: boolean) {
    this.dock.hidden = hidden;
  }

  /** Shows a question as asked and puts the panel in its loading state. */
  showQuestion(q: string) {
    this.hasConversation = true;
    this.setView('panel');
    this.addMessage(q, 'user');
    this.setLoading(true);
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  addMessage(text: string, role: 'user' | 'assistant') {
    this.hasConversation = true;
    const msg = document.createElement('div');
    msg.className = `sk-msg sk-msg--${role}`;
    msg.innerHTML = renderText(text);
    this.messagesEl.appendChild(msg);
    this.scrollToEnd();
    return msg;
  }

  addAnswerMessage(text: string, sources: { title: string; url?: string }[], messageId?: string) {
    this.decorateAnswer(this.addMessage(text, 'assistant'), sources, messageId);
  }

  /**
   * An assistant message that fills in while the answer streams. The thinking
   * indicator stays until the first words arrive.
   */
  beginStream() {
    let msg: HTMLElement | null = null;
    let text = '';
    const el = () => {
      if (!msg) {
        this.thinkingEl?.remove();
        this.thinkingEl = null;
        msg = document.createElement('div');
        msg.className = 'sk-msg sk-msg--assistant sk-streaming';
        this.messagesEl.appendChild(msg);
        this.hasConversation = true;
      }
      return msg;
    };
    return {
      append: (chunk: string) => {
        text += chunk;
        el().innerHTML = renderText(text);
        this.scrollToEnd();
      },
      get text() { return text; },
      /** The final answer, with sources and rating. */
      complete: (finalText: string, sources: { title: string; url?: string }[], messageId?: string) => {
        const m = el();
        m.classList.remove('sk-streaming');
        m.innerHTML = renderText(finalText || text);
        this.decorateAnswer(m, sources, messageId);
      },
      /** Keep what arrived so far as a plain message. */
      settle: () => { msg?.classList.remove('sk-streaming'); },
      /** A quiet line saying what's being checked, like "Checking your invoices." */
      status: (line: string) => {
        const m = el();
        m.classList.remove('sk-streaming');
        m.classList.add('sk-msg--status');
        m.innerHTML = renderText(line || text);
      },
      discard: () => { msg?.remove(); msg = null; },
    };
  }

  private decorateAnswer(msg: HTMLElement, sources: { title: string; url?: string }[], messageId?: string) {
    if (sources.length > 0) {
      const list = document.createElement('div');
      list.className = 'sk-sources';
      for (const { title, url } of sources) {
        const el = document.createElement(url ? 'a' : 'span');
        el.className = 'sk-source';
        el.textContent = title;
        if (url && el instanceof HTMLAnchorElement) {
          el.href = url;
          el.target = '_blank';
          el.rel = 'noopener noreferrer';
        }
        list.appendChild(el);
      }
      msg.appendChild(list);
    }

    if (messageId) {
      msg.appendChild(this.buildVote(messageId));
      this.markLatest(msg);
      this.answerEls.set(messageId, msg);
    }
    this.scrollToEnd();
  }

  /**
   * An action Skavelo proposes, shown with exactly what it will send. Nothing runs until the
   * visitor clicks Run action; the outcome replaces the buttons.
   */
  addActionCard(action: { summary: string; skillName: string; inputs: Record<string, unknown> }, run: () => Promise<{ ok: boolean; message: string }>, cancel: () => void) {
    const msg = this.addMessage(action.summary, 'assistant');
    const card = document.createElement('div');
    card.className = 'sk-action';
    const rows = Object.entries(action.inputs)
      .map(([k, v]) => `<dt>${escapeHtml(labelFor(k))}</dt><dd>${escapeHtml(String(v))}</dd>`)
      .join('');
    card.innerHTML = `
      <div class="sk-action-name">${escapeHtml(action.skillName)}</div>
      ${rows ? `<dl class="sk-action-inputs">${rows}</dl>` : ''}
      <div class="sk-action-buttons">
        <button type="button" class="sk-action-run">Run action</button>
        <button type="button" class="sk-action-cancel">Cancel</button>
      </div>`;
    msg.appendChild(card);
    const buttons = card.querySelector('.sk-action-buttons') as HTMLElement;
    const runBtn = card.querySelector('.sk-action-run') as HTMLButtonElement;
    const cancelBtn = card.querySelector('.sk-action-cancel') as HTMLButtonElement;
    const finish = (text: string, ok: boolean) => {
      const status = document.createElement('div');
      status.className = `sk-action-status${ok ? ' sk-action-status--ok' : ''}`;
      status.setAttribute('role', 'status');
      status.textContent = text;
      buttons.replaceWith(status);
      this.scrollToEnd();
    };
    runBtn.addEventListener('click', async () => {
      runBtn.disabled = true;
      cancelBtn.disabled = true;
      runBtn.textContent = 'Running…';
      const result = await run();
      finish(result.message, result.ok);
    });
    cancelBtn.addEventListener('click', () => {
      cancel();
      finish('Cancelled. No changes were made.', false);
    });
    this.markLatest(msg);
    this.scrollToEnd();
    if (!this.preview) runBtn.focus({ preventScroll: true });
  }

  /**
   * "Talk to a person" under an answer, or under the last message when there's no id. Only one
   * offer shows at a time. The click hands the caller an offer to finish: a status line, or the
   * email form when the team is reached by email.
   */
  offerHandoff(messageId: string | null, onClick: (offer: HandoffOffer) => void) {
    const msg = messageId ? this.answerEls.get(messageId) : (this.messagesEl.lastElementChild as HTMLElement | null);
    if (!msg || msg.querySelector('.sk-handoff')) return;
    this.messagesEl.querySelectorAll('.sk-handoff:not(.sk-handoff--done)').forEach((el) => el.remove());

    const box = document.createElement('div');
    box.className = 'sk-handoff';
    const showButton = () => {
      box.innerHTML = `<button type="button" class="sk-handoff-btn">${ICONS.person}<span>Talk to a person</span></button>`;
      const btn = box.querySelector('button') as HTMLButtonElement;
      btn.addEventListener('click', () => {
        btn.disabled = true;
        onClick(offer);
      });
    };
    const done = (text: string) => {
      box.classList.add('sk-handoff--done');
      box.innerHTML = '';
      const status = document.createElement('div');
      status.className = 'sk-handoff-status';
      status.setAttribute('role', 'status');
      status.textContent = text;
      box.appendChild(status);
      this.scrollToEnd();
    };
    const offer: HandoffOffer = {
      done,
      cancel: showButton,
      askEmail: (defaultEmail, send) => {
        const id = `sk-handoff-${Math.random().toString(36).slice(2, 8)}`;
        box.innerHTML = `
          <form class="sk-handoff-form" novalidate>
            <label for="${id}">Your email address</label>
            <input id="${id}" type="email" autocomplete="email" placeholder="you@company.com" maxlength="254" />
            <textarea rows="2" maxlength="1000" placeholder="Additional details (optional)" aria-label="Additional details"></textarea>
            <div class="sk-handoff-error" role="alert" hidden></div>
            <div class="sk-action-buttons">
              <button type="submit" class="sk-action-run">Send to the team</button>
              <button type="button" class="sk-action-cancel">Cancel</button>
            </div>
          </form>`;
        const form = box.querySelector('form') as HTMLFormElement;
        const email = form.querySelector('input') as HTMLInputElement;
        const note = form.querySelector('textarea') as HTMLTextAreaElement;
        const error = form.querySelector('.sk-handoff-error') as HTMLElement;
        const submit = form.querySelector('.sk-action-run') as HTMLButtonElement;
        email.value = defaultEmail ?? '';
        const fail = (text: string) => {
          error.textContent = text;
          error.hidden = false;
        };
        form.querySelector('.sk-action-cancel')!.addEventListener('click', showButton);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const address = email.value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return fail('Please enter a valid email address so the team can reply.');
          error.hidden = true;
          submit.disabled = true;
          submit.textContent = 'Sending…';
          const problem = await send(address, note.value.trim());
          if (problem) {
            submit.disabled = false;
            submit.textContent = 'Send to the team';
            return fail(problem);
          }
          done(`Your message has been sent. The team will reply to ${address}.`);
        });
        this.scrollToEnd();
        if (!this.preview) email.focus({ preventScroll: true });
      },
    };

    showButton();
    msg.appendChild(box);
    this.scrollToEnd();
  }

  /**
   * Closing message for a walkthrough, with one rating for the whole thing and a link to go
   * through it again from the first step.
   */
  addCompletion(text: string, messageId?: string, onReplay?: () => void): HTMLElement {
    const msg = this.addMessage(text, 'assistant');
    if (onReplay) {
      const replay = document.createElement('button');
      replay.type = 'button';
      replay.className = 'sk-replay';
      replay.innerHTML = `${ICONS.replay}<span>Show me again</span>`;
      replay.addEventListener('click', onReplay);
      msg.appendChild(replay);
    }
    if (!messageId) {
      this.markLatest(msg);
      this.scrollToEnd();
      return msg;
    }
    const row = document.createElement('div');
    row.className = 'sk-rate';
    row.innerHTML = '<span>Was this helpful?</span>';
    row.appendChild(this.buildVote(messageId));
    msg.appendChild(row);
    this.markLatest(msg);
    this.scrollToEnd();
    return msg;
  }

  /** Brings an earlier message back into view, e.g. the completion a replay was started from. */
  revisit(msg: HTMLElement) {
    this.markLatest(msg);
    msg.scrollIntoView({ block: 'nearest' });
  }

  private markLatest(msg: HTMLElement) {
    this.messagesEl.querySelectorAll('.sk-latest').forEach((el) => el.classList.remove('sk-latest'));
    msg.classList.add('sk-latest');
  }

  private brandIcon(size: number): string {
    return this.icon
      ? `<img class="sk-icon" src="${escapeHtml(this.icon)}" alt="" width="${size}" height="${size}" />`
      : mark(size);
  }

  private loadingIcon(size: number): string {
    return this.icon
      ? `<img class="sk-icon sk-icon-pulse" src="${escapeHtml(this.icon)}" alt="" width="${size}" height="${size}" />`
      : loader(size);
  }

  private buildVote(messageId: string): HTMLDivElement {
    const vote = document.createElement('div');
    vote.className = 'sk-vote';
    this.fillVote(vote, messageId);
    return vote;
  }

  private fillVote(vote: HTMLElement, messageId: string) {
    vote.innerHTML = `
      <button type="button" aria-label="Helpful" aria-pressed="false">${ICONS.thumbUp}</button>
      <button type="button" aria-label="Not helpful" aria-pressed="false">${ICONS.thumbDown}</button>`;
    const [up, down] = Array.from(vote.querySelectorAll('button'));
    const choose = (btn: HTMLButtonElement, rating: FeedbackRating) => {
      btn.setAttribute('aria-pressed', 'true');
      vote.classList.add('sk-voted');
      up.disabled = true;
      down.disabled = true;
      this.events.onFeedback(messageId, rating);
    };
    up.addEventListener('click', () => choose(up, 1));
    down.addEventListener('click', () => choose(down, -1));
  }

  setLoading(loading: boolean) {
    this.loading = loading;
    this.askBtn.innerHTML = loading ? ICONS.stop : ICONS.arrowUp;
    this.askBtn.setAttribute('aria-label', loading ? 'Stop' : 'Send');

    if (loading && !this.thinkingEl) {
      this.showMessages();
      this.thinkingEl = document.createElement('div');
      this.thinkingEl.className = 'sk-thinking';
      this.thinkingEl.setAttribute('role', 'status');
      this.thinkingEl.innerHTML = `${this.loadingIcon(22)}<span>Thinking</span>`;
      this.messagesEl.appendChild(this.thinkingEl);
      this.scrollToEnd();
    } else if (!loading) {
      this.thinkingEl?.remove();
      this.thinkingEl = null;
    }
  }

  // ─── Walkthrough ──────────────────────────────────────────────────────────

  showStep(step: StepDisplay) {
    this.hasConversation = true;
    this.titleEl.textContent = step.title;
    this.messagesEl.hidden = true;
    this.stepEl.hidden = false;

    (this.stepEl.querySelector('.sk-step-text') as HTMLElement).innerHTML = renderText(step.instruction);
    (this.stepEl.querySelector('.sk-step-note') as HTMLElement).hidden = step.found;
    (this.stepEl.querySelector('.sk-count') as HTMLElement).textContent = `${step.stepIndex + 1} of ${step.total}`;
    (this.stepEl.querySelector('.sk-back') as HTMLButtonElement).disabled = step.stepIndex === 0;
    (this.stepEl.querySelector('.sk-next span') as HTMLElement).textContent =
      step.stepIndex + 1 === step.total ? 'Done' : 'Next';

    if (this.view !== 'panel') this.setView('panel');
  }

  clearStep() {
    this.showMessages();
  }

  private showMessages() {
    this.titleEl.textContent = this.title;
    this.stepEl.hidden = true;
    this.messagesEl.hidden = false;
  }

  private scrollToEnd() {
    this.bodyEl.scrollTop = this.bodyEl.scrollHeight;
  }

  // ─── Theming ──────────────────────────────────────────────────────────────

  /** Applies a full theme. Missing fields fall back to defaults. */
  applyTheme(theme: AppliedTheme) {
    this.theme = theme;
    const d = this.dock;
    const position = theme.position ?? 'bottom-center';
    const offset = `${theme.offset ?? 24}px`;

    d.classList.remove('sk-pos-center', 'sk-pos-left', 'sk-pos-right');
    d.classList.add(`sk-pos-${position.replace('bottom-', '')}`);
    d.style.bottom = offset;
    d.style.left = position === 'bottom-left' ? offset : '';
    d.style.right = position === 'bottom-right' ? offset : '';

    // Custom colors: derive the softer shades from background and text so any pair stays readable.
    const vars = ['--sk-surface', '--sk-subtle', '--sk-line', '--sk-text', '--sk-text-2', '--sk-text-3'];
    vars.forEach((v) => d.style.removeProperty(v));
    const bg = theme.background;
    const fg = theme.text ?? (bg ? (isDark(bg) ? '#F4F4F5' : '#18181B') : undefined);
    const surface = bg ?? (fg ? (isDark(fg) ? '#FFFFFF' : '#1C1C1F') : undefined);
    if (surface && fg) {
      d.style.setProperty('--sk-surface', surface);
      d.style.setProperty('--sk-text', fg);
      d.style.setProperty('--sk-subtle', `color-mix(in srgb, ${fg} 6%, ${surface})`);
      d.style.setProperty('--sk-line', `color-mix(in srgb, ${fg} 13%, ${surface})`);
      d.style.setProperty('--sk-text-2', `color-mix(in srgb, ${fg} 74%, ${surface})`);
      d.style.setProperty('--sk-text-3', `color-mix(in srgb, ${fg} 50%, ${surface})`);
    }
    d.style.setProperty('--sk-accent', theme.accent ?? (this.looksDark() ? DEFAULT_ACCENT.dark : DEFAULT_ACCENT.light));

    this.icon = theme.icon || undefined;
    d.querySelectorAll('.sk-brand').forEach((el) => { el.innerHTML = this.brandIcon(20); });
    (d.querySelector('.sk-label') as HTMLElement).textContent = theme.label || 'Get help';
    this.title = theme.title || 'Help';
    if (this.stepEl.hidden) this.titleEl.textContent = this.title;
    (d.querySelector('.sk-foot') as HTMLElement).hidden = theme.branding === false;
  }

  /** Forces light or dark (dashboard preview); null follows the visitor's system setting. */
  setScheme(scheme: 'light' | 'dark' | null) {
    this.scheme = scheme;
    this.dock.classList.toggle('sk-light', scheme === 'light');
    this.dock.classList.toggle('sk-dark', scheme === 'dark');
    this.applyTheme(this.theme);
  }

  /** Hides the widget until its dashboard settings arrive, so visitors don't see the default look flash. */
  setReady(ready: boolean) {
    this.dock.style.visibility = ready ? '' : 'hidden';
  }

  showView(view: View) {
    if (view === 'panel') this.hasConversation = true;
    this.setView(view);
  }

  private looksDark(): boolean {
    if (this.theme.background) return isDark(this.theme.background);
    if (this.scheme) return this.scheme === 'dark';
    return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  }

  destroy() {
    clearTimeout(this.floatTimer);
    this.dock.remove();
  }
}
