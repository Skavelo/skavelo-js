// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { renderText } from './widget';

beforeEach(() => {
  // The page is on www.example.com, so app.example.com is the same site.
  (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL('https://www.example.com/');
});

const html = (text: string) => renderText(text);

describe('renderText links', () => {
  it('links a markdown link to a page on this site in place', () => {
    const out = html('Open [Billing](/settings/billing) to change it.');
    expect(out).toContain(`<a href="${location.origin}/settings/billing">Billing</a>`);
    expect(out).not.toContain('target=');
  });

  it('opens other sites in a new tab', () => {
    expect(html('See https://help.example.org/start.')).toContain(
      '<a href="https://help.example.org/start" target="_blank" rel="noopener noreferrer">https://help.example.org/start</a>.',
    );
  });

  it('links a bare address only on the same site as the page', () => {
    const site = 'example.com';
    expect(html(`Go to app.${site}/login and sign in.`)).toContain(`<a href="https://app.${site}/login"`);
    expect(html('Upload report.csv or use Node.js.')).not.toContain('<a');
  });

  it("leaves an email address's domain alone", () => {
    const site = 'example.com';
    expect(html(`Write to help@${site}.`)).not.toContain('<a');
  });

  it('keeps bold, code and escaping around links', () => {
    const out = html('Click **[Billing](/billing)**, then `Save` <b>x</b> & https://a.example.com/?q=1&r=2');
    expect(out).toContain(`<strong><a href="${location.origin}/billing">Billing</a></strong>`);
    expect(out).toContain('<code>Save</code> &lt;b&gt;x&lt;/b&gt; &amp;');
    expect(out).toContain('href="https://a.example.com/?q=1&amp;r=2"');
  });

  it('never links a script address', () => {
    expect(html('[x](javascript:alert(1))')).not.toContain('<a');
  });
});
