// ─── Public config ────────────────────────────────────────────────────────────

export interface SkaveloCfg {
  /** One agent everywhere: the agent ID from its Install page. */
  agentId?: string;
  /**
   * Several agents on one site: the workspace ID from the Install page. Each page shows the agent
   * whose rules (set in the dashboard) match it.
   */
  workspaceId?: string;
  /** The base URL of the Skavelo API, including /api. Defaults to https://api.skavelo.com/api. */
  apiUrl?: string;
  /**
   * Who's signed in, optional. Leave it out on signed out pages; the widget still answers and the
   * conversation is anonymous. Use an opaque or hashed ID, never an email.
   */
  user?: UserContext;
  /** Visual customisation. */
  theme?: ThemeCfg;
  /** How approved actions (skills) call your app. */
  actions?: ActionsCfg;
  /**
   * Shows the real reason when a question is refused (a monthly limit, say) instead of "Help isn't
   * available right now". For your own team's testing, like Skavelo's dashboard preview; leave it
   * off where your users see the widget.
   */
  showLimitReasons?: boolean;
  /**
   * A preview pass from Skavelo's dashboard, set by the "Preview on your app" bookmark. It lets a
   * signed-in team member try the agent on any page, and their questions don't use the plan.
   */
  previewPass?: string;
}

export interface ActionsCfg {
  /**
   * Extra headers for action requests, such as a CSRF token. Called right before each request.
   * Cookies are always sent, so the action runs as the signed-in user.
   */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Where your API lives, if not on the same origin as the page. Default: the page's origin. */
  baseUrl?: string;
}

export interface UserContext {
  /** Your ID for this user. Required. */
  id: string;
  /** Shown to your team in Conversations. Never sent to the AI. */
  name?: string;
  /** Shown to your team in Conversations. Never sent to the AI. */
  email?: string;
  /** Their subscription plan. Answers can take it into account, and Targeting can match it. */
  plan?: string;
  /** Their role in your product, like admin or member. Answers can take it into account. */
  role?: string;
  /** Labels like 'beta' or 'vip', for Targeting rules and filtering Conversations. */
  tags?: string[];
  /** Anything else worth knowing: { company: 'Acme', seats: 12 }. Shown in Conversations and usable in Targeting. */
  traits?: Record<string, string | number | boolean>;
  /**
   * HMAC-SHA256 of id with your identity secret (Settings in Skavelo), computed on your server.
   * Marks the identity as verified so nobody can pose as another user.
   */
  userHash?: string;
  /** Older installs passed extra keys at the top level; they're kept as traits. */
  [key: string]: unknown;
}

/** How a walkthrough marks the element to click. */
export type HighlightStyle = "beacon" | "spotlight" | "trace" | "ring";

export interface ThemeCfg {
  /** Accent / highlight colour in hex. Defaults to the Skavelo claret. */
  accent?: string;
  /**
   * How walkthroughs mark the element to click. Default "beacon": a ring with a pulsing dot.
   * "spotlight" dims the rest of the page, "trace" draws an outline, "ring" is a plain ring.
   */
  highlight?: HighlightStyle;
  /** Widget position on screen. Default "bottom-center". */
  position?: "bottom-center" | "bottom-right" | "bottom-left";
  /** Launcher text. Default "Get help". */
  label?: string;
  /** Image URL used instead of the Skavelo mark in the launcher, input bar and loading state. Square works best. */
  icon?: string;
  /** Header text in the chat panel. Defaults to the agent's name from the dashboard. */
  title?: string;
  /** Panel background as hex. Unset follows the visitor's light or dark mode. */
  background?: string;
  /** Panel text color as hex. Unset is picked to contrast with the background. */
  text?: string;
  /** Pixel offset from the edge. Default 24. */
  offset?: number;
}

// ─── API request / response ───────────────────────────────────────────────────

export interface AskPayload {
  question: string;
  pageUrl: string;
  pageTitle?: string;
  /** Trimmed visible elements on the current page. Never includes input values. */
  elements: ElementDescriptor[];
  conversationId?: string;
  user?: UserContext;
  /** Set when the visitor clicked a suggestion; the server acts on its instruction. */
  suggestionId?: string;
  /** True when "Talk to a person" can show on this page. */
  canHandoff?: boolean;
  /** What the app returned for a lookup Skavelo asked for; finishes the same question. */
  lookup?: LookupResult;
}

export interface LookupResult {
  /** The reply that asked for the lookup. */
  messageId: string;
  /** HTTP status, or 0 when the app couldn't be reached. */
  status: number;
  /** The response, shortened. */
  body: string;
}

export interface ElementDescriptor {
  role: string;
  name?: string;
  text?: string;
  /** Normalised position: 0–1 of viewport width/height */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Whether the element is visible and interactive */
  interactive: boolean;
}

export type ResponseMode = "answer" | "show" | "do" | "look";

export interface AskResponse {
  conversationId: string;
  messageId: string;
  mode: ResponseMode;
  answer?: AnswerPayload;
  /** One sentence before a walkthrough, e.g. "I'll walk you through changing your currency." */
  intro?: string;
  show?: ShowPayload;
  do?: DoPayload;
  /** Skavelo needs the visitor's own data first: run this and ask again with the result. */
  look?: LookPayload;
  /** The agent couldn't help or the visitor asked for a person: offer one under this answer. */
  handoff?: boolean;
}

export interface AnswerPayload {
  text: string;
  sources: AnswerSource[];
}

export interface AnswerSource {
  title: string;
  url?: string;
  snippet?: string;
}

export interface ShowPayload {
  workflowId: string;
  /** Workflow name, shown as the walkthrough title. */
  name?: string;
  /** The visitor asked Skavelo to do it: the widget carries out the steps and stops on the last one. */
  fill?: boolean;
  steps: ShowStep[];
}

export interface ShowStep {
  id: string;
  order: number;
  instruction: string;
  /** Selector hints from the product map, tried in order */
  locators: Locator[];
  pageUrlPattern?: string;
  /** With fill: what to enter in this field, from the visitor's own words. */
  value?: string;
}

export interface Locator {
  type: "aria" | "testid" | "text" | "attr" | "css";
  value: string;
  score: number;
}

export interface DoPayload {
  skillId: string;
  skillName: string;
  /** What the action will do, shown to the user before approval. */
  summary: string;
  /** The values filled in, shown to the user before approval. */
  inputs: Record<string, unknown>;
  /** Built by the server from the skill's settings: always a path on the same site. */
  request: { method: string; path: string; body?: Record<string, unknown> };
}

/** A read of the visitor's own data, run from their browser with their session. Never needs approval. */
export interface LookPayload {
  skillId: string;
  skillName: string;
  /** Built by the server: always a GET to a path on the same site. */
  request: { method: "GET"; path: string };
}

// ─── SDK events ───────────────────────────────────────────────────────────────

export type SkavelEvent =
  | { type: "step"; stepIndex: number; stepInstruction: string; elementFound: boolean }
  | { type: "step_complete"; stepIndex: number }
  | { type: "walkthrough_complete"; workflowId: string }
  | { type: "walkthrough_abandon"; workflowId: string; atStep: number }
  /** The visitor chose to go through a finished walkthrough again, from step 1. */
  | { type: "walkthrough_replay"; workflowId: string }
  | { type: "answer"; messageId: string }
  | { type: "do_approved"; skillId: string }
  | { type: "do_rejected"; skillId: string }
  /** Skavelo read the visitor's data with a lookup; ok is false when the app refused or failed. */
  | { type: "lookup"; skillId: string; ok: boolean }
  /** Skavelo offered help because the visitor seemed stuck; accepted is set once they choose. */
  | { type: "stuck"; kind: "disabled" | "error" | "repeat"; question: string; accepted?: boolean }
  | {
      type: "handoff";
      conversationId: string;
      /** Why the visitor was offered a person. */
      reason: HandoffReason;
      /** "chat:intercom" (or another chat tool), "email", or "code" when your code handles it. */
      channel: string;
      /** A short message for your team: what they asked, and on which page. */
      summary: string;
      question?: string;
      pageUrl: string;
    }
  | { type: "open" }
  | { type: "close" };

export type EventHandler<T extends SkavelEvent = SkavelEvent> = (event: T) => void;

/** asked: they asked for a person. unhelpful: they marked an answer unhelpful. no_answer: Skavelo couldn't answer. */
export type HandoffReason = "asked" | "unhelpful" | "no_answer";

/** How the dashboard set handoff up. The team's email address never reaches the browser. */
export interface HandoffConfig {
  /** chat: a support chat on the page, falling back to email. email: the visitor leaves their email. code: only the handoff event fires. */
  method: "chat" | "email" | "code";
  /** Whether an email address is set, so email works as the fallback. */
  email: boolean;
}

/** Widget settings saved in the dashboard, served by GET /sdk/v1/config. */
export interface RemoteConfig {
  id: string;
  name: string;
  appearance: Omit<ThemeCfg, 'offset'>;
  branding: boolean;
  /** Where and to whom the widget shows, set in the dashboard. Countries are checked by the API. */
  targeting?: Targeting;
  /** False when the visitor's country is excluded; the widget stays hidden. */
  available?: boolean;
  suggestions?: Suggestions;
  /** Set when the agent can pass conversations to a person. */
  handoff?: HandoffConfig;
  /** Offer help when the visitor seems stuck. Missing means on. */
  stuckHelp?: boolean;
}

export interface Targeting {
  pages?: { mode: 'all' | 'only' | 'except'; patterns: string[] };
  audience?: 'everyone' | 'signed_in' | 'signed_out';
  attributes?: AttributeRule[];
  devices?: 'all' | 'desktop' | 'mobile';
  rollout?: number;
}

/** plan is trial, or plan is not enterprise. */
export interface AttributeRule {
  key: string;
  op?: 'is' | 'is_not';
  values: string[];
}

/** Where a suggestion shows and to whom. Countries were already checked by the API. */
export interface SuggestionRules {
  /** Allowed site entries like https://app.example.com or https://*.example.com; empty means all. */
  sites?: string[];
  pages?: { mode: 'all' | 'only' | 'except'; patterns: string[] };
  audience?: 'everyone' | 'signed_in' | 'signed_out';
  attributes?: AttributeRule[];
  devices?: 'all' | 'desktop' | 'mobile';
}

/** A prompt on the widget. Clicking it asks the agent to carry out an instruction kept on the server. */
export interface Suggestion {
  id?: string;
  title: string;
  rules?: SuggestionRules;
}

export interface Suggestions {
  items?: Suggestion[];
  /** Older servers sent plain questions: a default set and sets per page. */
  default?: string[];
  pages?: { pattern: string; questions: string[] }[];
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export type FeedbackRating = 1 | -1;

export interface FeedbackPayload {
  messageId: string;
  rating: FeedbackRating;
  correction?: string;
}
