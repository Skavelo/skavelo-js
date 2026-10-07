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

export interface ThemeCfg {
  /** Accent / highlight colour in hex. Defaults to the Skavelo claret. */
  accent?: string;
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

export type ResponseMode = "answer" | "show" | "do";

export interface AskResponse {
  conversationId: string;
  messageId: string;
  mode: ResponseMode;
  answer?: AnswerPayload;
  /** One sentence before a walkthrough, e.g. "I'll walk you through changing your currency." */
  intro?: string;
  show?: ShowPayload;
  do?: DoPayload;
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
  steps: ShowStep[];
}

export interface ShowStep {
  id: string;
  order: number;
  instruction: string;
  /** Selector hints from the product map, tried in order */
  locators: Locator[];
  pageUrlPattern?: string;
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

// ─── SDK events ───────────────────────────────────────────────────────────────

export type SkavelEvent =
  | { type: "step"; stepIndex: number; stepInstruction: string; elementFound: boolean }
  | { type: "step_complete"; stepIndex: number }
  | { type: "walkthrough_complete"; workflowId: string }
  | { type: "walkthrough_abandon"; workflowId: string; atStep: number }
  | { type: "answer"; messageId: string }
  | { type: "do_approved"; skillId: string }
  | { type: "do_rejected"; skillId: string }
  | { type: "handoff" }
  | { type: "open" }
  | { type: "close" };

export type EventHandler<T extends SkavelEvent = SkavelEvent> = (event: T) => void;

/** Widget settings saved in the dashboard, served by GET /sdk/config. */
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
}

export interface Targeting {
  pages?: { mode: 'all' | 'only' | 'except'; patterns: string[] };
  audience?: 'everyone' | 'signed_in' | 'signed_out';
  attributes?: { key: string; values: string[] }[];
  devices?: 'all' | 'desktop' | 'mobile';
  rollout?: number;
}

export interface Suggestions {
  default: string[];
  pages: { pattern: string; questions: string[] }[];
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export type FeedbackRating = 1 | -1;

export interface FeedbackPayload {
  messageId: string;
  rating: FeedbackRating;
  correction?: string;
}
