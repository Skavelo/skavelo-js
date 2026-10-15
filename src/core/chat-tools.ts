/**
 * Support chat widgets a customer may already run on their site. Handing a conversation to a
 * person opens theirs instead of asking them to wire anything up. What happens to the visitor's
 * question depends on what the tool's API allows: it's typed into the message box (prefill),
 * sent for them (send), or the chat just opens and the widget copies it for pasting (none).
 *
 * Each check only looks at the global the tool's own snippet defines, and every call is guarded:
 * these are other companies' scripts, and a broken one must never break the widget.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Win = Window & Record<string, any>;

export interface ChatTool {
  id: string;
  name: string;
  /** What happens to the visitor's question. */
  delivers: 'prefill' | 'send' | 'none';
  present(w: Win): boolean;
  open(w: Win, text: string): void;
}

const fn = (v: unknown): v is (...args: any[]) => any => typeof v === 'function';

/** In the order they're tried; a site rarely runs more than one. */
export const CHAT_TOOLS: ChatTool[] = [
  {
    id: 'intercom',
    name: 'Intercom',
    delivers: 'prefill',
    present: (w) => fn(w.Intercom),
    open: (w, text) => w.Intercom('showNewMessage', text),
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    delivers: 'none',
    present: (w) => fn(w.zE),
    open: (w) => {
      // Zendesk Messaging and the older Web Widget take different commands; each ignores the other's.
      try { w.zE('messenger', 'open'); } catch { /* not Messaging */ }
      try { w.zE('webWidget', 'open'); } catch { /* not the Web Widget */ }
    },
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    delivers: 'none',
    present: (w) => !!w.HubSpotConversations?.widget,
    open: (w) => {
      const widget = w.HubSpotConversations.widget;
      if (fn(widget.status) && widget.status()?.loaded === false && fn(widget.load)) widget.load();
      widget.open();
    },
  },
  {
    id: 'crisp',
    name: 'Crisp',
    delivers: 'prefill',
    present: (w) => fn(w.$crisp?.push),
    open: (w, text) => {
      w.$crisp.push(['do', 'chat:open']);
      w.$crisp.push(['set', 'message:text', [text]]);
    },
  },
  {
    id: 'freshchat',
    name: 'Freshchat',
    delivers: 'prefill',
    present: (w) => fn(w.fcWidget?.open),
    open: (w, text) => w.fcWidget.open({ replyText: text }),
  },
  {
    id: 'helpscout',
    name: 'Help Scout',
    delivers: 'prefill',
    present: (w) => fn(w.Beacon),
    open: (w, text) => {
      w.Beacon('open');
      w.Beacon('navigate', '/ask/message/');
      w.Beacon('prefill', { text });
    },
  },
  {
    id: 'drift',
    name: 'Drift',
    delivers: 'none',
    present: (w) => fn(w.drift?.api?.openChat) || fn(w.drift?.on),
    open: (w) => {
      if (fn(w.drift.api?.openChat)) w.drift.api.openChat();
      else w.drift.on('ready', (api: any) => api.openChat());
    },
  },
  {
    id: 'livechat',
    name: 'LiveChat',
    delivers: 'none',
    present: (w) => fn(w.LiveChatWidget?.call),
    open: (w) => w.LiveChatWidget.call('maximize'),
  },
  {
    id: 'tawk',
    name: 'Tawk.to',
    delivers: 'none',
    present: (w) => fn(w.Tawk_API?.maximize),
    open: (w) => w.Tawk_API.maximize(),
  },
  {
    // sendMessage isn't in Chatway's docs but is in its widget script: it takes a string, opens
    // the chat and sends it, queuing it if Chatway hasn't finished loading.
    id: 'chatway',
    name: 'Chatway',
    delivers: 'send',
    present: (w) => fn(w.$chatway?.sendMessage),
    open: (w, text) => w.$chatway.sendMessage(text),
  },
  {
    // If sendMessage ever goes away, the documented open still works; the question is copied instead.
    id: 'chatway',
    name: 'Chatway',
    delivers: 'none',
    present: (w) => fn(w.$chatway?.openChatwayWidget),
    open: (w) => {
      if (fn(w.$chatway.isChatwayLoaded) && !w.$chatway.isChatwayLoaded()) throw new Error('Chatway is still loading');
      w.$chatway.openChatwayWidget();
    },
  },
  {
    id: 'tidio',
    name: 'Tidio',
    delivers: 'none',
    present: (w) => fn(w.tidioChatApi?.open),
    open: (w) => {
      if (fn(w.tidioChatApi.show)) w.tidioChatApi.show();
      w.tidioChatApi.open();
    },
  },
];

/** The first support chat on the page, if any. */
export function findChatTool(w: Window = window): ChatTool | null {
  for (const tool of CHAT_TOOLS) {
    try {
      if (tool.present(w as Win)) return tool;
    } catch { /* a half loaded tool counts as absent */ }
  }
  return null;
}

/** Opens the tool with the visitor's message; false if its script threw. */
export function openChatTool(tool: ChatTool, text: string, w: Window = window): boolean {
  try {
    tool.open(w as Win, text);
    return true;
  } catch {
    return false;
  }
}
