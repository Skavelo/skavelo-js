import type { ThemeCfg, FeedbackRating, Suggestion, HistoryItem, HistoryMessage } from '../types';

const FONT = `'Instrument Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif`;

const WIDGET_CSS = `
  :host { all: initial; }

  .sk-dock, .sk-callout {
    --sk-surface: #FFFFFF;
    --sk-subtle: #F4F4F5;
    --sk-line: #E4E4E7;
    --sk-text: #18181B;
    --sk-text-2: #52525B;
    --sk-text-3: #A1A1AA;
    --sk-shadow: 0 1px 2px rgba(24,24,27,.06), 0 12px 32px rgba(24,24,27,.14), 0 32px 64px -12px rgba(24,24,27,.20);
    /* The button and floating suggestions sit straight on the page, so they need a firmer lift than the panel. */
    --sk-float: 0 0 0 1px rgba(24,24,27,.04), 0 2px 6px rgba(24,24,27,.08), 0 0 40px rgba(24,24,27,.12), 0 24px 56px -10px rgba(24,24,27,.24);
    /* What sits on the page itself (the button, the input bar, floating suggestions) carries the
       accent at its edge and a glow in it, so it stands out on busy, pale and dark pages alike. */
    --sk-edge: color-mix(in srgb, var(--sk-accent) 55%, var(--sk-line));
    --sk-glow: 0 0 0 3px color-mix(in srgb, var(--sk-accent) 12%, transparent), 0 6px 28px -2px color-mix(in srgb, var(--sk-accent) 38%, transparent);
    font-family: ${FONT};
    color: var(--sk-text);
    -webkit-font-smoothing: antialiased;
  }
  .sk-dock {
    position: fixed;
    z-index: 2147483645;
    display: flex;
    flex-direction: column;
    pointer-events: none;
  }
  .sk-dock *, .sk-dock *::before, .sk-dock *::after, .sk-callout, .sk-callout * { box-sizing: border-box; }
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

  /* Pill. Everything scales with --sk-launch, the launcher height (52px at the default size). */
  .sk-pill {
    --sk-launch: 52px;
    position: relative;
    isolation: isolate;
    display: inline-flex;
    align-items: center;
    gap: calc(var(--sk-launch) * .19);
    height: var(--sk-launch);
    padding: 0 calc(var(--sk-launch) * .35) 0 calc(var(--sk-launch) * .27);
    border-radius: calc(var(--sk-launch) * .27);
    border: 1.5px solid var(--sk-edge);
    /* Solid, so the glow behind it stays a halo instead of tinting the button. */
    background: var(--sk-surface);
    box-shadow: var(--sk-glow), var(--sk-float);
    font-size: clamp(13px, calc(var(--sk-launch) * .29), 19px);
    font-weight: 500;
    color: var(--sk-text-2);
    animation: sk-in 220ms cubic-bezier(.2,.8,.2,1);
    transition: transform 140ms cubic-bezier(.2,.8,.2,1), color 140ms ease;
  }
  /* Icon only: a circle. The text stays in the button, out of sight, as its name for screen readers. */
  .sk-pill--icon { width: var(--sk-launch); padding: 0; justify-content: center; border-radius: 999px; }
  .sk-pill--icon .sk-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .sk-pill::before {
    content: '';
    position: absolute;
    inset: -16px -10px;
    z-index: -1;
    border-radius: 999px;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--sk-accent) 40%, transparent), transparent);
    filter: blur(12px);
    opacity: .6;
    transition: opacity 220ms ease;
  }
  /* The button's own fill, over the glow: the pill is its own stacking layer, so the glow would
     otherwise be painted over its background and tint it. */
  .sk-pill::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    background: var(--sk-surface);
  }
  .sk-pill:hover::before, .sk-pill:focus-visible::before { opacity: 1; }
  /* Glow switched off in Appearance: a plain edge and shadow, no accent halo. The colours are reset
     with the light and dark ones further down, which would otherwise bring the glow back. */
  .sk-noglow .sk-pill::before { display: none; }
  .sk-noglow .sk-pill, .sk-noglow .sk-composer, .sk-noglow .sk-chip { border-width: 1px; }
  .sk-noglow .sk-chip { border-color: var(--sk-line); }
  .sk-pill--intro::before { animation: sk-glow 1.6s ease-in-out 2; }
  .sk-pill:hover { transform: translateY(-1px); color: var(--sk-text); }
  .sk-pill:active { transform: translateY(0) scale(.98); }
  @keyframes sk-glow { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }

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
    border: 1.5px solid var(--sk-edge);
    background: color-mix(in srgb, var(--sk-surface) 94%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: var(--sk-glow), var(--sk-shadow);
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
    border: 1.5px solid color-mix(in srgb, var(--sk-accent) 40%, var(--sk-line));
    background: var(--sk-surface);
    color: var(--sk-text);
    font-size: 14px;
    line-height: 1.3;
    text-align: left;
    box-shadow: var(--sk-float);
    transition: border-color 120ms ease, background 120ms ease;
  }
  .sk-chip:hover { border-color: var(--sk-edge); background: var(--sk-subtle); }
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
    /* The height a phone actually shows, without its browser bars; older browsers keep the line above. */
    max-height: min(560px, calc(100dvh - 48px));
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
    height: min(720px, calc(100dvh - 48px));
    max-height: none;
  }
  /* Docked: full height along one side, over the page, so the visitor works beside it. Only where
     there's room for the app next to it (DOCK_MEDIA); smaller screens keep the floating panel. */
  @media (min-width: 900px) and (min-height: 500px) {
    .sk-dock.sk-docked { top: 12px !important; bottom: 12px !important; width: 400px; transform: none; align-items: stretch; }
    .sk-dock.sk-docked-right { right: 12px !important; left: auto !important; }
    .sk-dock.sk-docked-left { left: 12px !important; right: auto !important; }
    .sk-docked .sk-panel { flex: 1; width: 100%; height: auto; max-height: none; }
  }
  .sk-head { position: relative; }
  .sk-more-menu {
    position: absolute;
    top: calc(100% - 6px);
    right: 12px;
    z-index: 2;
    min-width: 180px;
    padding: 4px;
    border-radius: 12px;
    border: 1px solid var(--sk-line);
    background: var(--sk-surface);
    box-shadow: var(--sk-shadow);
  }
  .sk-more-menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 13.5px;
    color: var(--sk-text);
    text-align: left;
  }
  .sk-more-menu button:hover, .sk-more-menu button:focus-visible { background: var(--sk-subtle); outline: none; }
  .sk-more-menu svg { color: var(--sk-text-2); flex-shrink: 0; }
  /* On a phone, a walkthrough step is a compact card at the bottom, so the page and the control it
     points at stay in view above it. */
  /* 639px: below CALLOUT_MIN_VIEWPORT, where steps show in the panel instead of beside the control.
     A phone on its side is wide but short, and gets the same compact card. */
  @media (max-width: 639px), (max-height: 500px) {
    /* Unless they expanded it: then they asked for the room. */
    .sk-panel:not(.sk-expanded):has(.sk-step:not([hidden])) { height: auto; max-height: min(60dvh, 420px); }
    .sk-panel:not(.sk-expanded):has(.sk-step:not([hidden])) .sk-body { flex: 0 1 auto; }
  }
  /* So short that the follow-up box would push Back and Next out of sight: the step comes first. */
  @media (max-height: 500px) {
    .sk-panel:not(.sk-expanded):has(.sk-step:not([hidden])) { max-height: calc(100dvh - 24px); }
    .sk-panel:has(.sk-step:not([hidden])) .sk-ask, .sk-panel:has(.sk-step:not([hidden])) .sk-notice { display: none; }
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

  /* A verified user's past conversations. */
  .sk-history { padding: 14px 12px 18px; }
  .sk-history-label { padding: 0 8px 6px; font-size: 12px; color: var(--sk-text-3); }
  .sk-history-empty { padding: 4px 8px; font-size: 14px; color: var(--sk-text-2); }
  .sk-hist-row { display: flex; align-items: center; gap: 4px; border-radius: 10px; }
  .sk-hist-row:hover, .sk-hist-row:focus-within { background: var(--sk-subtle); }
  .sk-hist-open { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 9px 8px; text-align: left; }
  .sk-hist-title { font-size: 14px; color: var(--sk-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sk-hist-when { font-size: 12px; color: var(--sk-text-3); }
  .sk-hist-row .sk-hist-remove { opacity: 0; }
  .sk-hist-row:hover .sk-hist-remove, .sk-hist-row:focus-within .sk-hist-remove { opacity: 1; }
  @media (hover: none) { .sk-hist-row .sk-hist-remove { opacity: 1; } }
  .sk-hist-confirm { flex: 1; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 8px; font-size: 13.5px; color: var(--sk-text-2); }
  .sk-hist-confirm span { flex: 1 1 140px; }
  .sk-hist-confirm button { padding: 5px 10px; border-radius: 8px; font-size: 13px; font-weight: 500; }
  .sk-hist-confirm .sk-hist-yes { background: var(--sk-text); color: var(--sk-surface); }
  .sk-hist-confirm .sk-hist-no:hover { background: var(--sk-line); }
  .sk-chip--resume { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; }
  .sk-chip--resume svg { flex-shrink: 0; color: var(--sk-text-2); }
  .sk-chip--resume span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sk-messages { display: flex; flex-direction: column; gap: 18px; padding: 18px 20px; }
  .sk-msg { font-size: 14.5px; line-height: 1.55; overflow-wrap: anywhere; }
  .sk-msg p { margin: 0 0 8px; }
  .sk-msg p:last-child { margin-bottom: 0; }
  .sk-msg strong { font-weight: 600; }
  .sk-msg a { color: inherit; text-decoration: underline; text-decoration-color: var(--sk-accent); text-underline-offset: 2px; font-weight: 500; }
  .sk-msg a:hover { text-decoration-thickness: 2px; }
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
  /* iPhone browsers zoom the whole page into a field with text under 16px when it's tapped, and
     stay zoomed, so the site scrolls sideways. On touch screens every widget field is 16px. */
  @media (pointer: coarse) {
    input.sk-field, .sk-composer input, .sk-handoff-form input, .sk-handoff-form textarea { font-size: 16px; }
  }
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
  .sk-step-heading { margin-bottom: 4px; font-size: 15px; font-weight: 600; line-height: 1.4; }
  .sk-step-text { font-size: 15px; line-height: 1.55; }
  .sk-step-text strong { font-weight: 600; }
  .sk-step-details { margin-top: 6px; font-size: 13.5px; line-height: 1.5; color: var(--sk-text-2); }
  .sk-step-note { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: var(--sk-subtle); font-size: 13.5px; line-height: 1.5; color: var(--sk-text-2); }
  .sk-note-text strong { font-weight: 600; color: var(--sk-text); }
  .sk-note-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .sk-note-btn { padding: 5px 10px; border: 1px solid var(--sk-line); border-radius: 8px; background: var(--sk-surface); font-size: 13px; color: var(--sk-text); }
  .sk-note-btn:hover { border-color: color-mix(in srgb, var(--sk-text) 25%, var(--sk-line)); }
  /* Before a walkthrough nobody asked for: what it does, and a choice to start it. */
  .sk-intro { padding: 18px 20px 14px; }
  .sk-intro-name { font-size: 15px; font-weight: 600; line-height: 1.4; }
  .sk-intro-text { margin-top: 6px; font-size: 14px; line-height: 1.5; color: var(--sk-text-2); }
  .sk-intro-count { margin-top: 8px; font-size: 13px; color: var(--sk-text-3); }
  .sk-intro-nav { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--sk-line); }
  .sk-step-nav {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 14px;
    padding: 14px 0 10px;
    border-top: 1px solid var(--sk-line);
  }
  /* In the panel, Back and Next stay in view when a long step has to scroll. */
  .sk-panel .sk-step-nav { position: sticky; bottom: 0; background: var(--sk-surface); }
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

  /* Callout: the step beside the control it points at, like a tour guide standing next to it. */
  .sk-callout {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2147483645;
    width: min(340px, calc(100vw - 24px));
    padding: 14px 14px 4px 16px;
    border: 1px solid var(--sk-line);
    border-radius: 14px;
    background: var(--sk-surface);
    box-shadow: var(--sk-float);
    /* The host lets clicks through to the page; the card itself must take them. */
    pointer-events: auto;
    animation: sk-in 200ms cubic-bezier(.2,.8,.2,1);
  }
  .sk-callout[hidden] { display: none; }
  .sk-co-close {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    color: var(--sk-text-3);
  }
  .sk-co-close:hover { background: var(--sk-subtle); color: var(--sk-text); }
  .sk-co-body > :first-child { padding-right: 26px; }
  .sk-co-heading { margin-bottom: 4px; font-size: 14.5px; font-weight: 600; line-height: 1.4; }
  .sk-co-text { font-size: 14px; line-height: 1.5; }
  .sk-co-text p, .sk-co-details p { margin: 0; }
  .sk-co-text strong { font-weight: 600; }
  .sk-co-details { margin-top: 6px; font-size: 13px; line-height: 1.5; color: var(--sk-text-2); }
  .sk-callout .sk-step-nav { gap: 2px; margin-top: 12px; padding: 8px 0 6px; }
  .sk-callout .sk-count { font-size: 13px; }
  .sk-callout .sk-nav-btn { padding: 5px 7px; font-size: 13.5px; }
  .sk-co-ask { color: var(--sk-text-3); }
  /* The notch on the side facing the control. A turned square: two of its borders form the point. */
  .sk-co-arrow {
    position: absolute;
    width: 12px;
    height: 12px;
    margin: -6px 0 0 -6px;
    border: 1px solid var(--sk-line);
    background: var(--sk-surface);
    transform: rotate(45deg);
  }
  .sk-co-arrow[data-side="top"] { top: 0; border-right-color: transparent; border-bottom-color: transparent; }
  .sk-co-arrow[data-side="bottom"] { top: 100%; border-left-color: transparent; border-top-color: transparent; }
  .sk-co-arrow[data-side="left"] { left: 0; border-top-color: transparent; border-right-color: transparent; }
  .sk-co-arrow[data-side="right"] { left: 100%; border-bottom-color: transparent; border-left-color: transparent; }

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

  .sk-notice {
    margin: -4px 0 0;
    padding: 0 16px 10px;
    text-align: center;
    font-size: 12px;
    line-height: 1.4;
    color: var(--sk-text-3);
  }
  .sk-notice a { color: inherit; text-decoration: underline; text-underline-offset: 2px; white-space: nowrap; }
  .sk-notice a:hover { color: var(--sk-text-2); }
  /* A phone: a little smaller and closer to the edges, so the line and its link stay on one line. */
  @media (max-width: 419px) {
    .sk-notice { padding: 0 12px 10px; font-size: 11px; }
  }

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

  .sk-dock.sk-dark, .sk-callout.sk-dark {
    --sk-surface: #1C1C1F;
    --sk-subtle: #27272A;
    --sk-line: #34343A;
    --sk-text: #F4F4F5;
    --sk-text-2: #C4C4CC;
    --sk-text-3: #85858F;
    --sk-shadow: 0 1px 2px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.45), 0 32px 64px -12px rgba(0,0,0,.55);
      --sk-float: 0 2px 6px rgba(0,0,0,.45), 0 0 40px rgba(0,0,0,.5), 0 24px 56px -10px rgba(0,0,0,.65);
    /* A dark shadow disappears on a dark page; the accent glow does the lifting there. */
    --sk-edge: color-mix(in srgb, var(--sk-accent) 70%, var(--sk-line));
    --sk-glow: 0 0 0 3px color-mix(in srgb, var(--sk-accent) 20%, transparent), 0 0 32px 2px color-mix(in srgb, var(--sk-accent) 45%, transparent);
  }
  @media (prefers-color-scheme: dark) {
    .sk-dock:not(.sk-light), .sk-callout:not(.sk-light) {
      --sk-surface: #1C1C1F;
      --sk-subtle: #27272A;
      --sk-line: #34343A;
      --sk-text: #F4F4F5;
      --sk-text-2: #C4C4CC;
      --sk-text-3: #85858F;
      --sk-shadow: 0 1px 2px rgba(0,0,0,.4), 0 12px 32px rgba(0,0,0,.45), 0 32px 64px -12px rgba(0,0,0,.55);
      --sk-float: 0 2px 6px rgba(0,0,0,.45), 0 0 40px rgba(0,0,0,.5), 0 24px 56px -10px rgba(0,0,0,.65);
      --sk-edge: color-mix(in srgb, var(--sk-accent) 70%, var(--sk-line));
      --sk-glow: 0 0 0 3px color-mix(in srgb, var(--sk-accent) 20%, transparent), 0 0 32px 2px color-mix(in srgb, var(--sk-accent) 45%, transparent);
    }
  }

  /* Dashboard preview: sits inside its frame instead of the viewport. */
  .sk-dock.sk-preview { position: absolute; z-index: 1; }
  .sk-preview .sk-panel { max-height: calc(100% - 24px); }
  .sk-dock.sk-noglow { --sk-edge: var(--sk-line); --sk-glow: 0 0 #0000; }
  @media (prefers-color-scheme: dark) { .sk-dock.sk-noglow { --sk-edge: var(--sk-line); --sk-glow: 0 0 #0000; } }

  @media (prefers-reduced-motion: reduce) {
    .sk-dock *, .sk-dock *::before, .sk-callout { animation: none !important; transition: none !important; }
    .sk-l-route { stroke-dashoffset: 0; }
  }
`;

const ICONS = {
  compose: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
  more: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
  history: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  dockRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M14 4v16"/></svg>',
  dockLeft: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M10 4v16"/></svg>',
  float: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><rect x="11" y="11" width="7" height="6" rx="1.2"/></svg>',
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

/**
 * Whether the page is light or dark: the color-scheme it declares, else its background. Null when
 * it can't tell, which leaves the visitor's device setting to decide.
 */
export function pageScheme(): 'light' | 'dark' | null {
  const root = document.documentElement;
  const declared = getComputedStyle(root).colorScheme.trim();
  if (declared === 'light' || declared === 'only light') return 'light';
  if (declared === 'dark' || declared === 'only dark') return 'dark';
  for (const el of [document.body, root]) {
    if (!el) continue;
    const rgba = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)?.map(Number);
    if (!rgba || rgba.length < 3 || (rgba.length > 3 && rgba[3] < 0.5)) continue;
    const [r, g, b] = rgba;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5 ? 'dark' : 'light';
  }
  // No background anywhere: the browser paints white unless the page allows dark.
  return /dark/.test(declared) ? null : 'light';
}

const LAUNCHER_SIZES: Record<string, number> = { sm: 44, md: 52, lg: 60, xl: 68 };

/** Launcher height in pixels from a preset or a number; dashboard settings arrive as strings like "64". */
export function launcherHeight(size: ThemeCfg['size'] | string | undefined): number {
  if (size === undefined || size === '') return LAUNCHER_SIZES.md;
  if (typeof size === 'string' && size in LAUNCHER_SIZES) return LAUNCHER_SIZES[size];
  const px = Number(size);
  return Number.isFinite(px) ? Math.min(96, Math.max(32, Math.round(px))) : LAUNCHER_SIZES.md;
}

/** invoiceId → "Invoice id", for the action card. */
function labelFor(key: string): string {
  const words = key.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/**
 * Links in an answer: [Billing](/settings/billing), a full address, or a bare one on the same site
 * as the page, like app.example.com on example.com. Anything else (a file name, "Node.js") stays text.
 */
const LINK =
  /\[([^\]\n]+)\]\(((?:https?:\/\/|\/)[^\s)]*)\)|\b(https?:\/\/[^\s<>"'`]*[^\s<>"'`.,;:!?)])|\b((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"'`]*[^\s<>"'`.,;:!?)])?)/gi;

/** The link's address, or null when it isn't a web address or, written bare, isn't this site's. */
function linkHref(raw: string, bare: boolean): URL | null {
  try {
    const url = new URL(bare ? `https://${raw}` : raw, location.origin);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (bare && siteOf(url.hostname) !== siteOf(location.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

// app.example.com and example.com are the same site; the last two labels are enough here.
const siteOf = (host: string) => host.split('.').slice(-2).join('.');

/**
 * Turns links into placeholders before escaping, so an address is never mangled by the escaping or
 * the bold and code rules, then puts them back as anchors. Pages on this site open in place;
 * others open in a new tab.
 */
function withLinks(text: string, render: (plain: string) => string): string {
  const anchors: string[] = [];
  const marked = text.replace(LINK, (whole, label: string | undefined, md: string | undefined, full: string | undefined, bare: string | undefined, at: number) => {
    // The domain of an email address isn't a link.
    if (bare && at > 0 && /[@\w.-]/.test(text[at - 1])) return whole;
    const url = linkHref(md ?? full ?? bare ?? '', !!bare);
    if (!url) return whole;
    const external = url.origin !== location.origin;
    anchors.push(
      `<a href="${escapeHtml(url.href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(label ?? whole)}</a>`,
    );
    return `\u0000${anchors.length - 1}\u0000`;
  });
  return render(marked).replace(/\u0000(\d+)\u0000/g, (_, i: string) => anchors[Number(i)]);
}

/** Minimal, escape-first markdown: paragraphs, line breaks, **bold**, `code` and links. */
export function renderText(text: string): string {
  return withLinks(text.trim(), (plain) =>
    escapeHtml(plain)
      .split(/\n{2,}/)
      .map((para) => `<p>${para
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>')}</p>`)
      .join(''),
  );
}

/** **bold** and `code` only, for one line inside other text. */
function renderInline(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
}

const CONTROL_WORDS = 'field|button|tab|link|menu|option|box|checkbox|toggle|switch|dropdown|section|icon|card|list';

/**
 * What a step points at, from its instruction: "Enter your domain in the **Domain** field." gives
 * "the **Domain** field", "Click **Add Domain**." gives "**Add Domain**". Null when nothing is named.
 */
export function missingName(instruction: string): string | null {
  const m = instruction.match(new RegExp(`\\*\\*(.+?)\\*\\*(?:\\s+(${CONTROL_WORDS})\\b)?`, 'i'));
  if (!m) return null;
  return m[2] ? `the **${m[1]}** ${m[2].toLowerCase()}` : `**${m[1]}**`;
}

/** The question "Ask about it" fills in. */
export function missingQuestion(instruction: string): string {
  const what = missingName(instruction);
  if (what) return `Where do I find ${what.replace(/\*\*/g, '')}?`;
  const plain = instruction.replace(/\*\*/g, '').replace(/\.$/, '').trim();
  return `I can't find where to do this: ${plain}. Where is it?`;
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
  /** History: the list was opened, a past conversation picked, one removed, or a new chat started. */
  onHistoryOpen?: () => void;
  onResume?: (conversationId: string) => void;
  onRemove?: (conversationId: string) => void;
  onNewChat?: () => void;
}

export interface StepDisplay {
  title: string;
  instruction: string;
  /** Optional heading and explanation the team or learning wrote for this step. */
  heading?: string;
  details?: string;
  stepIndex: number;
  total: number;
  found: boolean;
  /** The control the step points at. The step then shows beside it, where there's room. */
  anchor?: Element | null;
  /** The control isn't there yet, and it's too soon to say it can't be found (the page may still be changing). */
  pending?: boolean;
}

/** Below this width a callout would cover most of the screen, so steps stay in the panel. */
const CALLOUT_MIN_VIEWPORT = 640;
/** Wide and tall enough for a docked panel with the app still usable beside it. Matches the CSS. */
const DOCK_MEDIA = '(min-width: 900px) and (min-height: 500px)';
const PANEL_KEY = '_sk_panel';
export type PanelSide = 'left' | 'right';
/** How long a missing control may stay missing (the page is changing) before the step moves to the panel. */
const CALLOUT_GRACE_MS = 1200;

export type View = 'pill' | 'composer' | 'panel';

/** Theme plus the plan-controlled branding flag, which customers can't set from code. */
export type AppliedTheme = ThemeCfg & { branding?: boolean };

export const DEFAULT_DISCLAIMER = 'AI can make mistakes. Check important details.';

/** A link the team set, only when it's a full https address. */
function httpsUrl(value: string | undefined): string | null {
  try {
    const url = value ? new URL(value.trim()) : null;
    return url?.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

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
  private introEl: HTMLDivElement;
  private introDone: ((start: boolean) => void) | null = null;
  private askInput: HTMLInputElement;
  private askBtn: HTMLButtonElement;
  private thinkingEl: HTMLElement | null = null;
  private view: View = 'pill';
  /** The first view after the dashboard settings arrive has been chosen. */
  private started = false;
  private loading = false;
  private hasConversation = false;
  /** On a phone, the step card moved to the top so it doesn't cover the control. */
  private dockTop = false;
  private dockMovedAt = -1;
  private clearTimer = 0;
  private icon: string | undefined;
  private title = 'Help';
  private theme: AppliedTheme = {};
  private scheme: 'light' | 'dark' | null = null;
  /** What the page itself looks like, followed while no scheme is forced. */
  private pageScheme: 'light' | 'dark' | null = null;
  private schemeFrame = 0;
  private schemeObserver: MutationObserver | null = null;
  private schemeMedia: MediaQueryList | null = null;
  private schemeUpdate: (() => void) | null = null;
  private preview: boolean;
  private answerEls = new Map<string, HTMLElement>();
  /** A verified user's past conversations; null when there's no history for this visitor. */
  private history: HistoryItem[] | null = null;
  private historyEl!: HTMLElement;
  private callout: HTMLDivElement;
  private calloutAnchor: Element | null = null;
  private calloutFrame = 0;
  private calloutKey = '';
  private calloutGrace = 0;
  /** The walkthrough step on screen, if any, and where it shows. */
  private step: StepDisplay | null = null;
  private stepPlace: 'callout' | 'panel' = 'panel';
  /** The visitor opened the panel during this step, to ask something. It stays open until they move on. */
  private stepInPanel = false;
  /** The side the visitor docked the panel to, or 'float'; null until they choose, so the team's default applies. */
  private panelChoice: PanelSide | 'float' | null = null;
  private dockMedia: MediaQueryList | null = null;
  private dockMediaChange: (() => void) | null = null;
  private outsideMenu: ((e: Event) => void) | null = null;

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
          <button class="sk-icon-btn sk-new-btn" type="button" aria-label="New chat" title="New chat" hidden>${ICONS.compose}</button>
          <button class="sk-icon-btn sk-history-btn" type="button" aria-label="Your conversations" title="Your conversations" aria-pressed="false" hidden>${ICONS.history}</button>
          <button class="sk-icon-btn sk-more-btn" type="button" aria-label="More options" title="More options" aria-haspopup="menu" aria-expanded="false">${ICONS.more}</button>
          <button class="sk-icon-btn sk-panel-close" type="button" aria-label="Close">${ICONS.close}</button>
          <div class="sk-more-menu" role="menu" aria-label="More options" hidden>
            <button type="button" role="menuitem" data-action="expand">${ICONS.expand}<span>Expand</span></button>
            <button type="button" role="menuitem" data-side="left">${ICONS.dockLeft}<span>Dock to the left</span></button>
            <button type="button" role="menuitem" data-side="right">${ICONS.dockRight}<span>Dock to the right</span></button>
            <button type="button" role="menuitem" data-side="float">${ICONS.float}<span>Float</span></button>
          </div>
        </div>
        <div class="sk-body">
          <div class="sk-messages" aria-live="polite"></div>
          <div class="sk-history" hidden>
            <div class="sk-history-label">Recent</div>
            <div class="sk-history-list" role="list"></div>
          </div>
          <div class="sk-intro" hidden>
            <div class="sk-intro-name"></div>
            <div class="sk-intro-text"></div>
            <div class="sk-intro-count"></div>
            <div class="sk-intro-nav">
              <button class="sk-nav-btn sk-intro-later" type="button"><span>Not now</span></button>
              <button class="sk-nav-btn sk-nav-btn--next sk-intro-start" type="button"><span>Start</span>${ICONS.arrowRight}</button>
            </div>
          </div>
          <div class="sk-step" hidden>
            <div class="sk-step-heading" hidden></div>
            <div class="sk-step-text"></div>
            <div class="sk-step-details" hidden></div>
            <div class="sk-step-note" hidden>
              <div class="sk-note-text"></div>
              <div class="sk-note-actions">
                <button class="sk-note-btn sk-note-back" type="button"></button>
                <button class="sk-note-btn sk-note-ask" type="button">Ask about it</button>
              </div>
            </div>
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
        <p class="sk-notice"><span class="sk-notice-text"></span> <a class="sk-notice-link" target="_blank" rel="noopener noreferrer" hidden>Learn more</a></p>
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
    this.introEl = $('.sk-intro');
    this.historyEl = $('.sk-history');
    this.askInput = $('.sk-ask input');
    this.askBtn = $('.sk-ask button');

    this.applyTheme(theme ?? {});
    if (!this.preview) this.followPage();

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
    this.setupMoreMenu();
    $('.sk-history-btn').addEventListener('click', () => {
      if (this.historyEl.hidden) this.showHistory();
      else this.showMessages();
    });
    $('.sk-new-btn').addEventListener('click', () => {
      if (this.events.onNewChat) this.events.onNewChat();
      else this.clearConversation();
    });
    $('.sk-back').addEventListener('click', () => this.events.onStepBack());
    $('.sk-note-back').addEventListener('click', () => this.events.onStepBack());
    $('.sk-note-ask').addEventListener('click', () => {
      // Filled in, not sent: the visitor can add what they see before asking.
      if (this.step) this.askInput.value = missingQuestion(this.step.instruction);
      this.askInput.focus();
    });
    $('.sk-next').addEventListener('click', () => this.events.onStepNext());
    $('.sk-intro-start').addEventListener('click', () => this.answerIntro(true));
    $('.sk-intro-later').addEventListener('click', () => this.answerIntro(false));
    // Pointing at a suggestion, focusing the input or typing usually comes seconds before a question.
    for (const type of ['pointerenter', 'focusin', 'input'] as const) {
      this.dock.addEventListener(type, () => this.events.onIntent?.(), { passive: true });
    }
    this.dock.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.view !== 'pill') this.close();
    });

    shadowRoot.appendChild(this.dock);

    // Outside the dock: a centred dock is shifted with a transform, which would carry a fixed child with it.
    this.callout = document.createElement('div');
    this.callout.className = 'sk-callout';
    this.callout.setAttribute('role', 'dialog');
    this.callout.hidden = true;
    this.callout.innerHTML = `
      <span class="sk-co-arrow" aria-hidden="true"></span>
      <button class="sk-co-close" type="button" aria-label="End walkthrough">${ICONS.closeSmall}</button>
      <div class="sk-co-body" aria-live="polite">
        <div class="sk-co-heading" hidden></div>
        <div class="sk-co-text"></div>
        <div class="sk-co-details" hidden></div>
      </div>
      <div class="sk-step-nav">
        <span class="sk-stepmark" aria-hidden="true"></span>
        <span class="sk-count"></span>
        <button class="sk-nav-btn sk-co-ask" type="button" aria-label="Ask a question about this step">Ask</button>
        <button class="sk-nav-btn sk-co-back" type="button">${ICONS.arrowLeft}<span>Back</span></button>
        <button class="sk-nav-btn sk-nav-btn--next sk-co-next" type="button"><span>Next</span>${ICONS.arrowRight}</button>
      </div>
    `;
    const co = <T extends Element>(sel: string) => this.callout.querySelector(sel) as T;
    co('.sk-co-close').addEventListener('click', () => this.endFromCallout());
    co('.sk-co-ask').addEventListener('click', () => this.open());
    co('.sk-co-back').addEventListener('click', () => this.events.onStepBack());
    co('.sk-co-next').addEventListener('click', () => this.events.onStepNext());
    this.callout.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.endFromCallout();
    });
    shadowRoot.appendChild(this.callout);
    this.applyTheme(this.theme);
  }

  // ─── Views ────────────────────────────────────────────────────────────────

  open() {
    // During a walkthrough the panel brings the step back with the question box; the walkthrough stays put.
    if (this.step && this.stepPlace === 'callout') {
      this.stepInPanel = true;
      this.placeStep('panel');
      this.events.onOpen();
      return;
    }
    this.setView(this.hasConversation ? 'panel' : 'composer');
    this.events.onOpen();
  }

  close() {
    if (this.view === 'pill') return;
    // Opened to ask during a step: closing goes back to the callout rather than ending the walkthrough.
    if (this.step && this.stepInPanel) {
      this.stepInPanel = false;
      if (this.calloutFor(this.step)) {
        this.placeStep('callout');
        return;
      }
    }
    // Put away once, the question bar stops opening by itself for the rest of the visit.
    if (this.view === 'composer' && this.theme.start === 'input') {
      try { sessionStorage.setItem('_sk_input_off', '1'); } catch {}
    }
    this.setView('pill');
    this.events.onClose();
  }

  private setView(view: View, focus = true) {
    // Closing the panel during an introduction counts as Not now.
    if (view !== 'panel' && this.introDone) this.answerIntro(false);
    const opening = view === 'panel' && this.view !== 'panel';
    this.view = view;
    this.pill.hidden = view !== 'pill';
    this.composer.hidden = view !== 'composer';
    this.panel.hidden = view !== 'panel';
    this.applyDock();
    // Opening the widget answers a nudge either way.
    if (view !== 'pill') { this.nudgeItem = null; clearTimeout(this.nudgeTimer); }
    this.renderSuggestions();
    // Reopened, it shows the latest message, not wherever it was scrolled to while hidden.
    if (opening && this.stepEl.hidden) requestAnimationFrame(() => this.scrollToEnd());
    // A preview inside the dashboard must never pull focus away from the settings form.
    if (this.preview || !focus) return;
    // On a phone, focusing raises the keyboard over the input bar at the bottom before it can be
    // seen; there the visitor taps the field, and the browser brings it into view above the keyboard.
    const touch = !!window.matchMedia?.('(pointer: coarse)').matches;
    if (view === 'composer' && !touch) this.composerInput.focus();
    if (view === 'panel' && !touch) this.askInput.focus();
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

  /** An offer is showing over the launcher right now. */
  get nudging(): boolean {
    return !!this.nudgeItem;
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
    // Above the question bar, the latest past conversation, to pick up where they left off.
    const recent = this.view === 'composer' && !this.hasConversation ? this.history?.[0] : undefined;
    const show = !this.hasConversation && (this.view === 'composer' || float) && (this.suggestions.length > 0 || !!recent);
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
    if (recent) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'sk-chip sk-chip--resume';
      chip.setAttribute('role', 'listitem');
      chip.setAttribute('aria-label', `Continue your conversation: ${recent.title}`);
      const label = document.createElement('span');
      label.textContent = `Continue: ${recent.title}`;
      chip.innerHTML = ICONS.history;
      chip.append(label);
      chip.addEventListener('click', () => this.events.onResume?.(recent.id));
      chips.unshift(chip);
    }
    this.suggestEl.replaceChildren(...chips);
  }

  /** Hides the whole widget, for pages or visitors its targeting rules leave out. */
  setHidden(hidden: boolean) {
    this.dock.hidden = hidden;
    if (hidden) this.hideCallout();
    else if (this.step && this.stepPlace === 'callout') this.placeStep('callout');
  }

  /** Shows a question as asked and puts the panel in its loading state. */
  showQuestion(q: string) {
    this.hasConversation = true;
    // Asked from the history list: back to the conversation, where the answer goes.
    if (!this.historyEl.hidden) this.showMessages();
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
    this.historyEl.hidden = true;
    this.stepEl.hidden = false;

    this.introEl.hidden = true;
    const heading = this.stepEl.querySelector('.sk-step-heading') as HTMLElement;
    heading.textContent = step.heading ?? '';
    heading.hidden = !step.heading;
    (this.stepEl.querySelector('.sk-step-text') as HTMLElement).innerHTML = renderText(step.instruction);
    const details = this.stepEl.querySelector('.sk-step-details') as HTMLElement;
    details.innerHTML = step.details ? renderText(step.details) : '';
    details.hidden = !step.details;
    // Nothing to point at, here or through an earlier step: say so, and offer a way forward.
    const note = this.stepEl.querySelector('.sk-step-note') as HTMLElement;
    note.hidden = step.found || !!step.pending;
    if (!step.found) {
      const what = missingName(step.instruction);
      (note.querySelector('.sk-note-text') as HTMLElement).innerHTML =
        what ? `I can't find ${renderInline(what)} on this screen.` : "I can't find where this step happens on this screen.";
      const back = note.querySelector('.sk-note-back') as HTMLButtonElement;
      back.hidden = step.stepIndex === 0;
      back.textContent = `Back to step ${step.stepIndex}`;
    }
    (this.stepEl.querySelector('.sk-count') as HTMLElement).textContent = `${step.stepIndex + 1} of ${step.total}`;
    (this.stepEl.querySelector('.sk-back') as HTMLButtonElement).disabled = step.stepIndex === 0;
    (this.stepEl.querySelector('.sk-next span') as HTMLElement).textContent =
      step.stepIndex + 1 === step.total ? 'Done' : 'Next';

    // A new step goes back beside its control, even if the visitor had the panel open to ask.
    if (step.stepIndex !== this.step?.stepIndex) this.stepInPanel = false;
    this.step = step;
    // An open docked panel floats again for the walkthrough.
    this.applyDock();
    this.fillCallout(step);

    if (this.calloutFor(step)) {
      clearTimeout(this.calloutGrace);
      this.calloutGrace = 0;
      this.placeStep('callout');
    } else if (step.pending && !this.stepInPanel && this.calloutFits()) {
      // Too soon to tell: keep whatever is showing, without pointing anywhere.
      this.callout.style.visibility = 'hidden';
    } else if (this.stepPlace === 'callout' && !this.stepInPanel && this.calloutFits()) {
      // The control is gone for a moment while the page changes. Wait before moving to the panel,
      // so the panel doesn't flash open between two steps.
      this.callout.style.visibility = 'hidden';
      this.calloutGrace ||= window.setTimeout(() => {
        this.calloutGrace = 0;
        if (this.step && !this.calloutFor(this.step)) this.placeStep('panel');
      }, CALLOUT_GRACE_MS);
    } else {
      this.placeStep('panel');
      this.scheduleKeepClear();
    }
  }

  private scheduleKeepClear() {
    clearTimeout(this.clearTimer);
    // After the highlight has scrolled the control into view.
    this.clearTimer = window.setTimeout(() => this.keepStepClear(), 450);
  }

  /**
   * On a phone the step card covers the bottom of the screen, and can sit on top of the control it
   * points at. Scroll the control into the space above the card; when the page can't scroll that
   * far, like a short sign-up form, move the card to the top of the screen instead.
   */
  private keepStepClear() {
    const step = this.step;
    const anchor = step?.anchor;
    if (!step || this.preview || !anchor?.isConnected || this.view !== 'panel' || this.calloutFits()) return;
    const r = anchor.getBoundingClientRect();
    if (!r.width && !r.height) return;
    // Off the side of the screen, like a closed drawer: there's nothing to keep clear.
    if (r.right <= 0 || r.left >= window.innerWidth) return;
    const p = this.panel.getBoundingClientRect();
    const gap = 12;
    if (r.bottom <= p.top - gap || r.top >= p.bottom + gap) return;
    // Scrolling the page doesn't move a control in a fixed menu drawer or a sticky bar; the card moves instead.
    if (!this.dockTop && !staysPut(anchor)) {
      const delta = r.bottom - (p.top - gap * 2);
      const room = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      if (delta > 0 && delta <= room && r.top - delta >= gap) {
        window.scrollBy({ top: delta, behavior: 'smooth' });
        return;
      }
    }
    // Moved once per step, so a control too tall for either side doesn't send the card back and forth.
    if (this.dockMovedAt === step.stepIndex) return;
    this.dockMovedAt = step.stepIndex;
    this.setDockTop(!this.dockTop);
  }

  // ─── Docked panel ─────────────────────────────────────────────────────────

  /**
   * The ⋯ menu in the panel header: Expand (or Exit full size), and where there's room, docking to
   * a side or floating. Keeps the header to New chat, history and Close.
   */
  private setupMoreMenu() {
    const btn = this.dock.querySelector('.sk-more-btn') as HTMLButtonElement;
    const menu = this.dock.querySelector('.sk-more-menu') as HTMLElement;
    if (!this.preview) {
      try {
        const saved = localStorage.getItem(PANEL_KEY);
        if (saved === 'left' || saved === 'right' || saved === 'float') this.panelChoice = saved;
      } catch {
        // Storage can be blocked in private windows.
      }
    }
    const items = () => Array.from(menu.querySelectorAll<HTMLButtonElement>('button'));
    const close = (focusBtn: boolean) => {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus();
    };
    const run = (item: HTMLButtonElement) => {
      if (item.dataset.action === 'expand') {
        this.panel.classList.toggle('sk-expanded');
        this.refreshMore();
      } else this.setPanelSide(item.dataset.side as PanelSide | 'float');
    };
    btn.addEventListener('click', () => {
      if (!menu.hidden) return close(false);
      const shown = this.refreshMore();
      // A single choice is the button itself, like Expand on a phone: no menu to open.
      if (shown.length === 1) return run(shown[0]);
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      shown[0]?.focus();
    });
    menu.addEventListener('click', (e) => {
      const item = (e.target as Element).closest<HTMLButtonElement>('button[role="menuitem"]');
      if (!item) return;
      close(true);
      run(item);
    });
    menu.addEventListener('keydown', (e) => {
      const shown = items().filter((b) => !b.hidden);
      const at = shown.indexOf(e.target as HTMLButtonElement);
      if (e.key === 'Escape') { e.stopPropagation(); close(true); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); shown[(at + 1) % shown.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); shown[(at - 1 + shown.length) % shown.length]?.focus(); }
    });
    this.dock.addEventListener('focusout', (e) => {
      const to = e.relatedTarget as Node | null;
      if (!menu.hidden && to && !menu.contains(to) && to !== btn) close(false);
    });
    // A click anywhere else, on the page or in the panel, puts the menu away.
    this.outsideMenu = (e: Event) => {
      const path = e.composedPath();
      if (!menu.hidden && !path.includes(menu) && !path.includes(btn)) close(false);
    };
    window.addEventListener('pointerdown', this.outsideMenu, true);
    // Back to floating when the window gets too small for a docked panel, and docked again after.
    this.dockMedia = window.matchMedia?.(DOCK_MEDIA) ?? null;
    this.dockMediaChange = () => this.applyDock();
    this.dockMedia?.addEventListener?.('change', this.dockMediaChange);
  }

  /**
   * What the ⋯ menu offers right now. With only one choice, the button becomes that choice, with
   * its icon and name (Expand on a phone), instead of a menu holding a single item.
   */
  private refreshMore(): HTMLButtonElement[] {
    const btn = this.dock.querySelector('.sk-more-btn') as HTMLButtonElement | null;
    const menu = this.dock.querySelector('.sk-more-menu') as HTMLElement | null;
    if (!btn || !menu) return [];
    const side = this.dockedSide();
    const roomToDock = !!(this.dockMedia?.matches ?? window.matchMedia?.(DOCK_MEDIA).matches) && !this.step && !this.introDone;
    const expanded = this.panel.classList.contains('sk-expanded');
    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'));
    for (const b of items) {
      if (b.dataset.action === 'expand') {
        // Docked, the panel already has the full height.
        b.hidden = !!side;
        (b.querySelector('span') as HTMLElement).textContent = expanded ? 'Exit full size' : 'Expand';
      } else {
        // The current choice isn't offered again: docked right offers left and Float.
        b.hidden = !roomToDock || b.dataset.side === (side ?? 'float');
      }
    }
    const shown = items.filter((b) => !b.hidden);
    const single = shown.length === 1 ? shown[0] : null;
    const label = single ? (single.querySelector('span') as HTMLElement).textContent ?? '' : 'More options';
    btn.innerHTML = single ? (single.querySelector('svg')?.outerHTML ?? ICONS.more) : ICONS.more;
    btn.setAttribute('aria-label', label);
    btn.title = label;
    if (single) {
      btn.removeAttribute('aria-haspopup');
      btn.removeAttribute('aria-expanded');
    } else {
      btn.setAttribute('aria-haspopup', 'menu');
      btn.setAttribute('aria-expanded', String(!menu.hidden));
    }
    btn.hidden = !shown.length;
    return shown;
  }

  /** The visitor's choice: docked to a side, or floating. Remembered on this browser. */
  setPanelSide(side: PanelSide | 'float') {
    this.panelChoice = side;
    if (!this.preview) {
      try { localStorage.setItem(PANEL_KEY, side); } catch {}
    }
    if (side !== 'float') this.panel.classList.remove('sk-expanded');
    this.applyDock();
  }

  /**
   * The side the open panel is docked to right now, or null when it floats. A walkthrough, from its
   * introduction to its last step, always runs the usual way: beside each control, or the compact
   * card on a phone. The visitor's side comes back when it ends.
   */
  private dockedSide(): PanelSide | null {
    const choice = this.panelChoice ?? this.theme.panel ?? 'float';
    if (choice === 'float' || this.step || this.introDone) return null;
    if (!(this.dockMedia?.matches ?? window.matchMedia?.(DOCK_MEDIA).matches)) return null;
    return choice;
  }

  private applyDock() {
    const side = this.view === 'panel' ? this.dockedSide() : null;
    this.dock.classList.toggle('sk-docked', !!side);
    this.dock.classList.toggle('sk-docked-left', side === 'left');
    this.dock.classList.toggle('sk-docked-right', side === 'right');
    // New chat once there's something to start over from, but not mid walkthrough.
    const fresh = this.dock.querySelector('.sk-new-btn') as HTMLElement | null;
    if (fresh) fresh.hidden = !this.hasConversation || !!this.step || !!this.introDone;
    this.refreshMore();
  }

  private setDockTop(top: boolean) {
    this.dockTop = top;
    const offset = `${this.theme.offset ?? 24}px`;
    this.dock.style.top = top ? offset : '';
    this.dock.style.bottom = top ? 'auto' : offset;
  }

  clearStep() {
    clearTimeout(this.clearTimer);
    this.dockMovedAt = -1;
    if (this.dockTop) this.setDockTop(false);
    this.step = null;
    this.stepInPanel = false;
    this.stepPlace = 'panel';
    clearTimeout(this.calloutGrace);
    this.calloutGrace = 0;
    this.hideCallout();
    this.showMessages();
    this.applyDock();
  }

  /** The step shows beside its control: the control is on the page, and the screen is wide enough. */
  private calloutFor(step: StepDisplay): boolean {
    return !!step.anchor?.isConnected && !this.stepInPanel && this.calloutFits();
  }

  private calloutFits(): boolean {
    return !this.preview && window.innerWidth >= CALLOUT_MIN_VIEWPORT;
  }

  private placeStep(place: 'callout' | 'panel') {
    this.stepPlace = place;
    if (place === 'callout' && this.step?.anchor) {
      this.showCallout(this.step.anchor);
      // Down to the launcher, without taking focus from the page the visitor is working in.
      if (this.view !== 'pill') this.setView('pill', false);
    } else {
      this.hideCallout();
      if (this.view !== 'panel') this.setView('panel', this.stepInPanel);
    }
  }

  private fillCallout(step: StepDisplay) {
    const co = <T extends Element>(sel: string) => this.callout.querySelector(sel) as T;
    this.callout.setAttribute('aria-label', step.title);
    const heading = co<HTMLElement>('.sk-co-heading');
    heading.textContent = step.heading ?? '';
    heading.hidden = !step.heading;
    const text = renderText(step.instruction);
    // Redrawn on every page change; rewriting the same text would interrupt screen readers.
    if (co<HTMLElement>('.sk-co-text').innerHTML !== text) co<HTMLElement>('.sk-co-text').innerHTML = text;
    const details = co<HTMLElement>('.sk-co-details');
    const detailsHtml = step.details ? renderText(step.details) : '';
    if (details.innerHTML !== detailsHtml) details.innerHTML = detailsHtml;
    details.hidden = !step.details;
    co<HTMLElement>('.sk-count').textContent = `${step.stepIndex + 1} of ${step.total}`;
    co<HTMLButtonElement>('.sk-co-back').disabled = step.stepIndex === 0;
    co<HTMLElement>('.sk-co-next span').textContent = step.stepIndex + 1 === step.total ? 'Done' : 'Next';
  }

  private showCallout(anchor: Element) {
    this.callout.style.visibility = '';
    if (this.calloutAnchor === anchor && !this.callout.hidden) return;
    this.calloutAnchor = anchor;
    this.calloutKey = '';
    this.callout.hidden = false;
    cancelAnimationFrame(this.calloutFrame);
    // Follows the control every frame, like the highlight, so it moves with scrolling and with
    // controls that slide or grow into place.
    const follow = () => {
      this.positionCallout();
      this.calloutFrame = requestAnimationFrame(follow);
    };
    follow();
  }

  private hideCallout() {
    cancelAnimationFrame(this.calloutFrame);
    this.calloutAnchor = null;
    this.callout.hidden = true;
  }

  /** The cross or Escape on the callout ends the walkthrough, as closing the panel does. */
  private endFromCallout() {
    this.hideCallout();
    this.events.onClose();
  }

  private positionCallout() {
    const anchor = this.calloutAnchor;
    if (!anchor) return;
    const a = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    const w = this.callout.offsetWidth;
    const h = this.callout.offsetHeight;
    const key = [a.top, a.left, a.width, a.height, w, h, vw, vh].map(Math.round).join('|');
    if (key === this.calloutKey) return;
    this.calloutKey = key;

    const place = calloutPlacement(a, { w, h }, { vw, vh }, this.dock.getBoundingClientRect());
    this.callout.style.top = `${Math.round(place.top)}px`;
    this.callout.style.left = `${Math.round(place.left)}px`;
    const arrow = this.callout.querySelector('.sk-co-arrow') as HTMLElement;
    arrow.hidden = !place.side;
    if (place.side) {
      arrow.dataset.side = place.side;
      const vertical = place.side === 'top' || place.side === 'bottom';
      arrow.style.left = vertical ? `${place.arrow}px` : '';
      arrow.style.top = vertical ? '' : `${place.arrow}px`;
    }
  }

  /**
   * Introduces a walkthrough the visitor didn't ask for (started from code or offered): its name,
   * what it does and how many steps, with Start and Not now. done(true) means Start.
   */
  showIntro(intro: { name: string; description?: string; total: number }, done: (start: boolean) => void) {
    this.introDone?.(false);
    this.introDone = done;
    this.titleEl.textContent = 'Walkthrough';
    (this.introEl.querySelector('.sk-intro-name') as HTMLElement).textContent = intro.name;
    const text = this.introEl.querySelector('.sk-intro-text') as HTMLElement;
    text.textContent = intro.description ?? '';
    text.hidden = !intro.description;
    (this.introEl.querySelector('.sk-intro-count') as HTMLElement).textContent =
      intro.total === 1 ? '1 step' : `${intro.total} steps`;
    this.messagesEl.hidden = true;
    this.historyEl.hidden = true;
    this.stepEl.hidden = true;
    this.introEl.hidden = false;
    this.applyDock();
    if (this.view !== 'panel') this.setView('panel');
    (this.introEl.querySelector('.sk-intro-start') as HTMLButtonElement).focus({ preventScroll: true });
  }

  private answerIntro(start: boolean) {
    const done = this.introDone;
    this.introDone = null;
    this.introEl.hidden = true;
    this.applyDock();
    if (!start) {
      this.showMessages();
      if (!this.hasConversation) this.setView('pill');
    }
    done?.(start);
  }

  private showMessages() {
    this.titleEl.textContent = this.title;
    this.stepEl.hidden = true;
    this.introEl.hidden = true;
    this.historyEl.hidden = true;
    this.dock.querySelector('.sk-history-btn')?.setAttribute('aria-pressed', 'false');
    this.messagesEl.hidden = false;
  }

  // ─── History ──────────────────────────────────────────────────────────────

  /** A verified user's past conversations, or null to hide history (anyone else). */
  setHistory(items: HistoryItem[] | null) {
    this.history = items;
    (this.dock.querySelector('.sk-history-btn') as HTMLElement).hidden = !items;
    if (!this.historyEl.hidden) {
      if (items) this.renderHistory();
      else this.showMessages();
    }
    this.renderSuggestions();
  }

  /** The list of past conversations in the panel, with New chat. Not during a walkthrough step. */
  showHistory() {
    if (!this.history || (this.step && !this.stepEl.hidden)) return;
    this.renderHistory();
    this.titleEl.textContent = 'Your conversations';
    this.messagesEl.hidden = true;
    this.stepEl.hidden = true;
    this.introEl.hidden = true;
    this.historyEl.hidden = false;
    this.dock.querySelector('.sk-history-btn')?.setAttribute('aria-pressed', 'true');
    if (this.view !== 'panel') this.setView('panel', false);
    this.bodyEl.scrollTop = 0;
    this.events.onHistoryOpen?.();
  }

  private renderHistory() {
    const list = this.historyEl.querySelector('.sk-history-list') as HTMLElement;
    const label = this.historyEl.querySelector('.sk-history-label') as HTMLElement;
    const items = this.history ?? [];
    label.hidden = !items.length;
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'sk-history-empty';
      empty.textContent = 'Your earlier conversations will show here.';
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...items.map((item) => this.historyRow(item)));
  }

  private historyRow(item: HistoryItem): HTMLElement {
    const row = document.createElement('div');
    row.className = 'sk-hist-row';
    row.setAttribute('role', 'listitem');
    const show = () => {
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'sk-hist-open';
      const title = document.createElement('span');
      title.className = 'sk-hist-title';
      title.textContent = item.title;
      const when = document.createElement('span');
      when.className = 'sk-hist-when';
      when.textContent = whenLabel(item.at);
      open.append(title, when);
      open.addEventListener('click', () => this.events.onResume?.(item.id));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'sk-icon-btn sk-hist-remove';
      remove.setAttribute('aria-label', `Remove "${item.title}" from your history`);
      remove.innerHTML = ICONS.trash;
      remove.addEventListener('click', confirm);
      row.replaceChildren(open, remove);
    };
    // Removing asks once, in place: it can't be undone from here.
    const confirm = () => {
      const box = document.createElement('div');
      box.className = 'sk-hist-confirm';
      const text = document.createElement('span');
      text.textContent = 'Remove from your history?';
      const yes = document.createElement('button');
      yes.type = 'button';
      yes.className = 'sk-hist-yes';
      yes.textContent = 'Remove';
      yes.addEventListener('click', () => this.events.onRemove?.(item.id));
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'sk-hist-no';
      no.textContent = 'Cancel';
      no.addEventListener('click', () => {
        show();
        (row.querySelector('.sk-hist-remove') as HTMLElement | null)?.focus();
      });
      box.append(text, yes, no);
      row.replaceChildren(box);
      no.focus();
    };
    show();
    return row;
  }

  /** Shows a past conversation in the panel, to carry on with. */
  loadConversation(messages: HistoryMessage[]) {
    this.messagesEl.replaceChildren();
    this.answerEls.clear();
    for (const m of messages) {
      if (m.sender === 'user') this.addMessage(m.content, 'user');
      else this.addAnswerMessage(m.content, [], m.id);
    }
    this.hasConversation = true;
    this.showMessages();
    this.setView('panel');
    requestAnimationFrame(() => this.scrollToEnd());
  }

  /** New chat: an empty widget, ready for the first question. */
  clearConversation() {
    this.messagesEl.replaceChildren();
    this.answerEls.clear();
    this.hasConversation = false;
    this.showMessages();
    this.setView('composer');
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

    d.classList.toggle('sk-noglow', theme.glow === false);
    d.classList.remove('sk-pos-center', 'sk-pos-left', 'sk-pos-right');
    d.classList.add(`sk-pos-${position.replace('bottom-', '')}`);
    d.style.bottom = offset;
    if (this.dockTop) this.setDockTop(true);
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
    // The callout sits outside the dock, so it takes the same colours explicitly.
    if (this.callout) {
      [...vars, '--sk-accent'].forEach((v) => {
        const value = d.style.getPropertyValue(v);
        if (value) this.callout.style.setProperty(v, value);
        else this.callout.style.removeProperty(v);
      });
    }

    this.icon = theme.icon || undefined;
    d.querySelectorAll('.sk-brand').forEach((el) => { el.innerHTML = this.brandIcon(20); });
    // The launcher's icon grows with it, and fills more of the button when it stands alone.
    const height = launcherHeight(theme.size);
    const iconOnly = theme.launcher === 'icon';
    this.pill.style.setProperty('--sk-launch', `${height}px`);
    this.pill.classList.toggle('sk-pill--icon', iconOnly);
    this.pill.querySelector('.sk-brand')!.innerHTML = this.brandIcon(Math.round(height * (iconOnly ? .46 : .385)));
    (d.querySelector('.sk-label') as HTMLElement).textContent = theme.label || 'Get help';
    this.title = theme.title || 'Help';
    if (this.stepEl.hidden) this.titleEl.textContent = this.title;
    (d.querySelector('.sk-foot') as HTMLElement).hidden = theme.branding === false;

    // The line saying answers come from AI, in the team's words, with their link when it's https.
    const notice = d.querySelector('.sk-notice') as HTMLElement;
    notice.hidden = theme.disclaimer === false;
    (notice.querySelector('.sk-notice-text') as HTMLElement).textContent =
      theme.disclaimerText?.trim() || DEFAULT_DISCLAIMER;
    const link = notice.querySelector('.sk-notice-link') as HTMLAnchorElement;
    const url = httpsUrl(theme.disclaimerUrl);
    link.hidden = !url;
    if (url) link.href = url;
    else link.removeAttribute('href');
    this.applyDock();
  }

  /** Forces light or dark (dashboard preview); null matches the page again. */
  setScheme(scheme: 'light' | 'dark' | null) {
    this.scheme = scheme;
    this.paintScheme(scheme ?? this.pageScheme);
  }

  /**
   * Light or dark to match the page it's on, not the visitor's device: a light app opened on a
   * phone in dark mode gets a light widget. Follows the page when it switches theme.
   */
  private followPage() {
    const update = () => {
      cancelAnimationFrame(this.schemeFrame);
      this.schemeFrame = requestAnimationFrame(() => {
        const next = pageScheme();
        if (next === this.pageScheme) return;
        this.pageScheme = next;
        if (!this.scheme) this.paintScheme(next);
      });
    };
    update();
    this.schemeObserver = new MutationObserver(update);
    for (const el of [document.documentElement, document.body]) {
      if (el) this.schemeObserver.observe(el, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-mode', 'data-color-scheme'] });
    }
    this.schemeMedia = window.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
    this.schemeMedia?.addEventListener?.('change', update);
    this.schemeUpdate = update;
  }

  private paintScheme(scheme: 'light' | 'dark' | null) {
    for (const el of [this.dock, this.callout]) {
      el.classList.toggle('sk-light', scheme === 'light');
      el.classList.toggle('sk-dark', scheme === 'dark');
    }
    this.applyTheme(this.theme);
  }

  /** Hides the widget until its dashboard settings arrive, so visitors don't see the default look flash. */
  setReady(ready: boolean) {
    this.dock.style.visibility = ready ? '' : 'hidden';
    if (ready && !this.started) {
      this.started = true;
      this.showStart();
    }
  }

  /** Opens the question bar on load when the theme starts with it, unless the visitor closed it this visit. */
  private showStart() {
    if (this.preview || this.theme.start !== 'input' || this.view !== 'pill' || this.step) return;
    try { if (sessionStorage.getItem('_sk_input_off') === '1') return; } catch {}
    // Not the visitor opening it, so no open event, and the page keeps its focus.
    this.setView('composer', false);
  }

  showView(view: View, focus = true) {
    if (view === 'panel') this.hasConversation = true;
    this.setView(view, focus);
  }

  /** Where the guide cursor sets off from: the top of the launcher or input bar, on screen. */
  originPoint(): { x: number; y: number } | null {
    const r = this.dock.getBoundingClientRect();
    return r.width ? { x: r.left + r.width / 2, y: r.top } : null;
  }

  /** Opens the panel on its last message after a walkthrough ends. */
  showEnding() {
    this.showView('panel', false);
    requestAnimationFrame(() => this.scrollToEnd());
  }

  private looksDark(): boolean {
    if (this.theme.background) return isDark(this.theme.background);
    const scheme = this.scheme ?? this.pageScheme;
    if (scheme) return scheme === 'dark';
    return !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  }

  destroy() {
    clearTimeout(this.clearTimer);
    if (this.dockMediaChange) this.dockMedia?.removeEventListener?.('change', this.dockMediaChange);
    if (this.outsideMenu) window.removeEventListener('pointerdown', this.outsideMenu, true);
    cancelAnimationFrame(this.schemeFrame);
    this.schemeObserver?.disconnect();
    if (this.schemeUpdate) this.schemeMedia?.removeEventListener?.('change', this.schemeUpdate);
    clearTimeout(this.floatTimer);
    clearTimeout(this.calloutGrace);
    this.hideCallout();
    this.dock.remove();
    this.callout.remove();
  }
}

type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * Where the callout goes for a control: below it, else above, else to its right or left, keeping
 * clear of the screen edges and of the widget's launcher. side is the callout edge facing the
 * control (where the notch goes), and arrow is the notch's offset along that edge. With no room
 * anywhere it sits below the control, kept on screen, without a notch.
 */
export function calloutPlacement(
  a: { top: number; left: number; right: number; bottom: number; width: number; height: number },
  size: { w: number; h: number },
  view: { vw: number; vh: number },
  avoid?: { top: number; left: number; right: number; bottom: number; width: number; height: number },
): { top: number; left: number; side: Side | null; arrow: number } {
  const GAP = 16;
  const EDGE = 12;
  const { w, h } = size;
  const { vw, vh } = view;
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
  const x = clamp(a.left + a.width / 2 - w / 2, EDGE, vw - w - EDGE);
  const y = clamp(a.top + a.height / 2 - h / 2, EDGE, vh - h - EDGE);
  const along = (start: number, centre: number, length: number) => clamp(centre - start, 18, length - 18);

  // A control with no size (inside a closed menu) has nowhere to point: wait above the launcher.
  if (!a.width && !a.height) {
    const top = avoid?.height ? avoid.top - h - EDGE : vh - h - EDGE;
    return { top: clamp(top, EDGE, vh - h - EDGE), left: clamp((vw - w) / 2, EDGE, vw - w - EDGE), side: null, arrow: 0 };
  }

  const options: { top: number; left: number; side: Side; arrow: number }[] = [
    { top: a.bottom + GAP, left: x, side: 'top', arrow: along(x, a.left + a.width / 2, w) },
    { top: a.top - GAP - h, left: x, side: 'bottom', arrow: along(x, a.left + a.width / 2, w) },
    { top: y, left: a.right + GAP, side: 'left', arrow: along(y, a.top + a.height / 2, h) },
    { top: y, left: a.left - GAP - w, side: 'right', arrow: along(y, a.top + a.height / 2, h) },
  ];
  const onScreen = (o: { top: number; left: number }) =>
    o.top >= EDGE && o.top + h <= vh - EDGE && o.left >= EDGE && o.left + w <= vw - EDGE;
  const clear = (o: { top: number; left: number }) =>
    !avoid?.width || o.left + w <= avoid.left || o.left >= avoid.right || o.top + h <= avoid.top || o.top >= avoid.bottom;
  const pick = options.find((o) => onScreen(o) && clear(o)) ?? options.find(onScreen);
  if (pick) return pick;
  return { top: clamp(a.bottom + GAP, EDGE, vh - h - EDGE), left: x, side: null, arrow: 0 };
}

/** In something fixed or sticky, like a phone's menu drawer: it stays where it is when the page scrolls. */
function staysPut(el: Element): boolean {
  for (let node: Element | null = el; node && node !== document.documentElement; node = node.parentElement) {
    const { position } = window.getComputedStyle(node);
    if (position === 'fixed' || position === 'sticky') return true;
  }
  return false;
}

/** When a past conversation was: "Today", "Yesterday", "3 days ago", then a date like 12 Nov. */
export function whenLabel(iso: string, now = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return at.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(at.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}
