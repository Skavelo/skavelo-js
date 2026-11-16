// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Widget, whenLabel } from './widget';

const make = () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  const noop = () => {};
  const events = {
    onAsk: noop, onStop: noop, onOpen: noop, onClose: noop, onStepNext: noop, onStepBack: noop, onFeedback: noop,
    onHistoryOpen: vi.fn(), onResume: vi.fn(), onRemove: vi.fn(), onNewChat: vi.fn(),
  };
  const widget = new Widget(root, {}, events);
  const $ = (sel: string) => root.querySelector(sel) as HTMLElement;
  const $$ = (sel: string) => Array.from(root.querySelectorAll(sel)) as HTMLElement[];
  return { widget, $, $$, events };
};

afterEach(() => {
  document.body.innerHTML = '';
  sessionStorage.clear();
});

const ITEMS = [
  { id: 'c1', title: 'How do I cancel my account?', at: new Date().toISOString() },
  { id: 'c2', title: 'Export invoices', at: new Date(Date.now() - 3 * 86_400_000).toISOString() },
];

describe('history', () => {
  it('stays hidden for visitors without history', () => {
    const { widget, $ } = make();
    widget.setHistory(null);
    expect($('.sk-history-btn').hidden).toBe(true);
    widget.showHistory();
    expect($('.sk-history').hidden).toBe(true);
  });

  it('offers the latest conversation above the question bar, and resumes it', () => {
    const { widget, $, events } = make();
    widget.setHistory(ITEMS);
    widget.showView('composer');
    const chip = $('.sk-chip--resume');
    expect(chip.textContent).toBe('Continue: How do I cancel my account?');
    chip.click();
    expect(events.onResume).toHaveBeenCalledWith('c1');
  });

  it('lists past conversations with when they were, and opens one', () => {
    const { widget, $, $$, events } = make();
    widget.setHistory(ITEMS);
    expect($('.sk-history-btn').hidden).toBe(false);
    $('.sk-history-btn').click();
    expect($('.sk-history').hidden).toBe(false);
    expect($('.sk-messages').hidden).toBe(true);
    expect($('.sk-title').textContent).toBe('Your conversations');
    expect(events.onHistoryOpen).toHaveBeenCalled();
    const rows = $$('.sk-hist-open');
    expect(rows.map((r) => r.querySelector('.sk-hist-title')!.textContent)).toEqual(['How do I cancel my account?', 'Export invoices']);
    expect(rows[0].querySelector('.sk-hist-when')!.textContent).toBe('Today');
    expect(rows[1].querySelector('.sk-hist-when')!.textContent).toBe('3 days ago');
    rows[1].click();
    expect(events.onResume).toHaveBeenCalledWith('c2');
  });

  it('asks before removing one, and Cancel puts the row back', () => {
    const { widget, $, $$, events } = make();
    widget.setHistory(ITEMS);
    widget.showHistory();
    $$('.sk-hist-remove')[0].click();
    expect($('.sk-hist-confirm').textContent).toContain('Remove from your history?');
    $('.sk-hist-no').click();
    expect($$('.sk-hist-open').length).toBe(2);
    expect(events.onRemove).not.toHaveBeenCalled();
    $$('.sk-hist-remove')[0].click();
    $('.sk-hist-yes').click();
    expect(events.onRemove).toHaveBeenCalledWith('c1');
  });

  it('says so when there are none yet', () => {
    const { widget, $ } = make();
    widget.setHistory([]);
    widget.showHistory();
    expect($('.sk-history-empty').textContent).toBe('Your earlier conversations will show here.');
  });

  it('shows New chat in the header once there’s a conversation, for anyone, but not mid walkthrough', () => {
    const { widget, $, events } = make();
    widget.setHistory(ITEMS);
    widget.showHistory();
    // The list alone, with nothing asked yet: nothing to start over from.
    expect($('.sk-new-btn').hidden).toBe(true);
    widget.showQuestion('How do I export?');
    expect($('.sk-new-btn').hidden).toBe(false);
    widget.showStep({ title: 'x', instruction: 'Click **Export**.', stepIndex: 0, total: 2, found: false });
    expect($('.sk-new-btn').hidden).toBe(true);
    widget.clearStep();
    expect($('.sk-new-btn').hidden).toBe(false);
    $('.sk-new-btn').click();
    expect(events.onNewChat).toHaveBeenCalled();
  });

  it('shows a past conversation as text, never as markup it was given', () => {
    const { widget, $, $$ } = make();
    widget.setHistory(ITEMS);
    widget.showHistory();
    widget.loadConversation([
      { id: 'u1', sender: 'user', content: 'How do I cancel? <img src=x onerror=alert(1)>', at: '' },
      { id: 'a1', sender: 'assistant', content: 'Open **Settings**.', at: '' },
    ]);
    expect($('.sk-history').hidden).toBe(true);
    expect($('.sk-panel').hidden).toBe(false);
    const msgs = $$('.sk-msg');
    expect(msgs.length).toBe(2);
    expect(msgs[0].querySelector('img')).toBeNull();
    expect(msgs[1].innerHTML).toContain('<strong>Settings</strong>');
  });

  it('goes back to the conversation when a question is asked from the list', () => {
    const { widget, $ } = make();
    widget.setHistory(ITEMS);
    widget.showHistory();
    widget.showQuestion('One more thing');
    expect($('.sk-history').hidden).toBe(true);
    expect($('.sk-messages').hidden).toBe(false);
    expect($('.sk-messages').textContent).toContain('One more thing');
  });

  it('clears the conversation for a new chat', () => {
    const { widget, $, $$ } = make();
    widget.loadConversation([{ id: 'u1', sender: 'user', content: 'Hi', at: '' }]);
    widget.clearConversation();
    expect($$('.sk-msg').length).toBe(0);
    expect($('.sk-panel').hidden).toBe(true);
    expect($('.sk-composer').hidden).toBe(false);
  });
});

describe('whenLabel', () => {
  const now = new Date(2026, 10, 16, 15, 0);
  it('says today, yesterday, days ago, then the date', () => {
    expect(whenLabel(new Date(2026, 10, 16, 9, 0).toISOString(), now)).toBe('Today');
    expect(whenLabel(new Date(2026, 10, 15, 23, 0).toISOString(), now)).toBe('Yesterday');
    expect(whenLabel(new Date(2026, 10, 12).toISOString(), now)).toBe('4 days ago');
    expect(whenLabel(new Date(2026, 10, 2).toISOString(), now)).toMatch(/2/);
    expect(whenLabel('nonsense', now)).toBe('');
  });
});
