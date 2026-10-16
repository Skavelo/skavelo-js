// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { StuckWatcher, helpFor, type StuckSignal } from './stuck';

let clock = 1_000;
const press = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
const watch = () => {
  const seen: StuckSignal[] = [];
  const w = new StuckWatcher((s) => seen.push(s), () => clock);
  w.start();
  return { w, seen };
};

afterEach(() => { document.body.innerHTML = ''; clock = 1_000; });

describe('StuckWatcher', () => {
  it('speaks up when a switched off button is pressed a second time, with its tooltip', () => {
    document.body.innerHTML = '<span id="tip">Verify your sending domain first</span><button disabled aria-describedby="tip">Create campaign</button>';
    const { w, seen } = watch();
    const btn = document.querySelector('button')!;
    press(btn);
    expect(seen).toEqual([]);
    clock += 5_000;
    press(btn);
    expect(seen).toEqual([{ kind: 'disabled', label: 'Create campaign', reason: 'Verify your sending domain first' }]);
    w.stop();
  });

  it("doesn't count two presses far apart", () => {
    document.body.innerHTML = '<button aria-disabled="true">Export</button>';
    const { w, seen } = watch();
    press(document.querySelector('button')!);
    clock += 60_000;
    press(document.querySelector('button')!);
    expect(seen).toEqual([]);
    w.stop();
  });

  it('speaks up when the same error comes back', () => {
    const { w, seen } = watch();
    document.body.innerHTML = '<div role="alert">Domain not verified</div>';
    w.scanErrors();
    document.body.innerHTML = '';
    w.scanErrors();
    clock += 30_000;
    document.body.innerHTML = '<div role="alert">Domain not verified</div>';
    w.scanErrors();
    expect(seen).toEqual([{ kind: 'error', text: 'Domain not verified' }]);
    w.stop();
  });

  it("doesn't count an error that simply stays on screen", () => {
    const { w, seen } = watch();
    document.body.innerHTML = '<div role="alert">Card declined</div>';
    w.scanErrors();
    clock += 1_000;
    w.scanErrors();
    expect(seen).toEqual([]);
    w.stop();
  });

  it('speaks up after five quick presses on the same button, but not on a stepper', () => {
    document.body.innerHTML = '<button id="go">Generate report</button><button id="plus">+</button>';
    const { w, seen } = watch();
    for (let i = 0; i < 5; i++) { press(document.querySelector('#plus')!); clock += 200; }
    expect(seen).toEqual([]);
    for (let i = 0; i < 5; i++) { press(document.querySelector('#go')!); clock += 200; }
    expect(seen).toEqual([{ kind: 'repeat', label: 'Generate report' }]);
    w.stop();
  });

  it('never reads anything marked sensitive', () => {
    document.body.innerHTML = '<div data-sk-sensitive><button disabled>Reveal card</button><div role="alert">Card 4242 declined</div></div>';
    const { w, seen } = watch();
    press(document.querySelector('button')!); clock += 1_000; press(document.querySelector('button')!);
    w.scanErrors();
    expect(seen).toEqual([]);
    w.stop();
  });
});

it('turns a signal into a short chip and a full question', () => {
  expect(helpFor({ kind: 'disabled', label: 'Create campaign', reason: 'Verify your domain' })).toEqual({
    chip: 'Why can\'t I use “Create campaign”?',
    question: 'Why can\'t I use "Create campaign"? It\'s switched off for me on this page. It says: "Verify your domain".',
  });
});
