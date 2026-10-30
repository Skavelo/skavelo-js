// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { menuButton, revealerOf, revealInstruction } from './reveal';

// happy-dom has no layout: anything inside a hidden box has no size, the rest is visible.
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const hidden = !!this.closest('[hidden], [style*="display: none"]');
    const size = hidden ? 0 : 30;
    return { x: 0, y: 0, left: 0, top: 0, right: size, bottom: size, width: size, height: size, toJSON: () => ({}) } as DOMRect;
  };
});

const billing = () => document.querySelector('a[href="/billing"]')!;

describe('revealerOf', () => {
  it('finds the button that says it opens the sidebar', () => {
    document.body.innerHTML = `
      <header><button aria-controls="side" aria-label="Open sidebar">☰</button></header>
      <aside id="side" hidden><a href="/billing">Billing</a></aside>`;
    expect(revealerOf(billing())?.el.getAttribute('aria-label')).toBe('Open sidebar');
  });

  it('finds a menu button by its name or class when nothing links them', () => {
    document.body.innerHTML = `
      <header><button>Search</button><button class="nav-toggle"><svg></svg></button></header>
      <nav style="display: none"><a href="/billing">Billing</a></nav>`;
    expect(revealerOf(billing())?.el.className).toBe('nav-toggle');
  });

  it('finds the closed toggle beside a dropdown', () => {
    document.body.innerHTML = `
      <div><button aria-expanded="false">Account</button>
      <div hidden><a href="/billing">Billing</a></div></div>`;
    expect(revealerOf(billing())?.label).toBe('Account');
  });

  it('opens a closed details by its summary', () => {
    document.body.innerHTML = `<details><summary>More</summary><a href="/billing">Billing</a></details>`;
    expect(revealerOf(billing())?.label).toBe('More');
  });

  it('gives up outside a sidebar or menu when nothing says what opens it', () => {
    document.body.innerHTML = `<button>Menu</button><main><div hidden><a href="/billing">Billing</a></div></main>`;
    expect(revealerOf(billing())).toBeNull();
  });
});

describe('menuButton', () => {
  it('prefers the button the site marked', () => {
    document.body.innerHTML = `<button aria-label="Menu">☰</button><button data-sk-menu aria-label="Navigation">≡</button>`;
    expect(menuButton()?.el.hasAttribute('data-sk-menu')).toBe(true);
  });

  it('falls back to an unlabelled icon button near the top that opens something', () => {
    document.body.innerHTML = `<button>Save</button><button aria-expanded="false"><svg></svg></button>`;
    expect(menuButton()?.el.getAttribute('aria-expanded')).toBe('false');
  });

  it('finds nothing when no button looks like a menu', () => {
    document.body.innerHTML = `<button>Save</button><button><svg></svg></button>`;
    expect(menuButton()).toBeNull();
  });
});

describe('revealInstruction', () => {
  it('names a specific button and calls generic ones the menu', () => {
    expect(revealInstruction('Account')).toBe('Open **Account** first.');
    expect(revealInstruction('Toggle navigation')).toBe('Open the menu first.');
    expect(revealInstruction('')).toBe('Open the menu first.');
  });
});
