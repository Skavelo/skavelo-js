import { describe, expect, it, vi } from 'vitest';
import { CHAT_TOOLS, findChatTool, openChatTool } from './chat-tools';

const win = (globals: Record<string, unknown>) => globals as unknown as Window;

describe('findChatTool', () => {
  it('finds nothing on a page without a support chat', () => {
    expect(findChatTool(win({}))).toBeNull();
  });

  it('finds each supported tool by the global its snippet defines', () => {
    const pages: Record<string, Record<string, unknown>> = {
      intercom: { Intercom: () => {} },
      zendesk: { zE: () => {} },
      hubspot: { HubSpotConversations: { widget: { open: () => {} } } },
      crisp: { $crisp: [] },
      freshchat: { fcWidget: { open: () => {} } },
      helpscout: { Beacon: () => {} },
      drift: { drift: { on: () => {} } },
      livechat: { LiveChatWidget: { call: () => {} } },
      tawk: { Tawk_API: { maximize: () => {} } },
      chatway: { $chatway: { sendMessage: () => {} } },
      tidio: { tidioChatApi: { open: () => {} } },
    };
    for (const tool of CHAT_TOOLS) expect(findChatTool(win(pages[tool.id]))?.id).toBe(tool.id);
    expect(Object.keys(pages).sort()).toEqual([...new Set(CHAT_TOOLS.map((t) => t.id))].sort());
  });

  it('treats a global that throws when read as absent', () => {
    const w = {};
    Object.defineProperty(w, 'Intercom', { get() { throw new Error('boom'); } });
    expect(findChatTool(win(w))).toBeNull();
  });
});

describe('openChatTool', () => {
  it('puts the question in Intercom\'s message box', () => {
    const Intercom = vi.fn();
    const w = win({ Intercom });
    expect(openChatTool(findChatTool(w)!, 'Need help with exports', w)).toBe(true);
    expect(Intercom).toHaveBeenCalledWith('showNewMessage', 'Need help with exports');
  });

  it('opens Crisp and fills its message box', () => {
    const $crisp: unknown[] = [];
    const w = win({ $crisp });
    openChatTool(findChatTool(w)!, 'Hello', w);
    expect($crisp).toEqual([['do', 'chat:open'], ['set', 'message:text', ['Hello']]]);
  });

  it('opens Zendesk whichever widget version the site runs', () => {
    const zE = vi.fn((kind: string) => { if (kind === 'messenger') throw new Error('not messaging'); });
    const w = win({ zE });
    expect(openChatTool(findChatTool(w)!, 'Hi', w)).toBe(true);
    expect(zE).toHaveBeenCalledWith('webWidget', 'open');
  });

  it('loads HubSpot first when it has not loaded yet', () => {
    const widget = { status: () => ({ loaded: false }), load: vi.fn(), open: vi.fn() };
    const w = win({ HubSpotConversations: { widget } });
    openChatTool(findChatTool(w)!, 'Hi', w);
    expect(widget.load).toHaveBeenCalled();
    expect(widget.open).toHaveBeenCalled();
  });

  it('sends the question through Chatway', () => {
    const $chatway = { sendMessage: vi.fn(), openChatwayWidget: vi.fn() };
    const w = win({ $chatway });
    const tool = findChatTool(w)!;
    expect(tool.delivers).toBe('send');
    expect(openChatTool(tool, 'Need help with exports', w)).toBe(true);
    expect($chatway.sendMessage).toHaveBeenCalledWith('Need help with exports');
    expect($chatway.openChatwayWidget).not.toHaveBeenCalled();
  });

  it('falls back to opening Chatway when sendMessage is missing', () => {
    const $chatway = { isChatwayLoaded: vi.fn(() => true), openChatwayWidget: vi.fn() };
    const w = win({ $chatway });
    const tool = findChatTool(w)!;
    expect(tool.id).toBe('chatway');
    expect(tool.delivers).toBe('none');
    expect(openChatTool(tool, 'Hi', w)).toBe(true);
    expect($chatway.openChatwayWidget).toHaveBeenCalledTimes(1);
  });

  it('reports failure while Chatway is still loading, so email can take over', () => {
    const $chatway = { isChatwayLoaded: () => false, openChatwayWidget: vi.fn() };
    const w = win({ $chatway });
    expect(openChatTool(findChatTool(w)!, 'Hi', w)).toBe(false);
    expect($chatway.openChatwayWidget).not.toHaveBeenCalled();
  });

  it('reports failure instead of throwing when the tool breaks', () => {
    const w = win({ Intercom: () => { throw new Error('not booted'); } });
    expect(openChatTool(findChatTool(w)!, 'Hi', w)).toBe(false);
  });
});
