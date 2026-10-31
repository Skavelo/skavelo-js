// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { pageScheme } from './widget';

afterEach(() => {
  document.documentElement.removeAttribute('style');
  document.body.removeAttribute('style');
});

describe('pageScheme', () => {
  it('follows the color-scheme the page declares', () => {
    document.documentElement.style.colorScheme = 'light';
    document.body.style.backgroundColor = 'rgb(10, 10, 10)';
    expect(pageScheme()).toBe('light');
    document.documentElement.style.colorScheme = 'dark';
    expect(pageScheme()).toBe('dark');
  });

  it('otherwise reads the background, whatever the device is set to', () => {
    document.body.style.backgroundColor = 'rgb(21, 18, 20)';
    expect(pageScheme()).toBe('dark');
    document.body.style.backgroundColor = 'rgb(255, 255, 255)';
    expect(pageScheme()).toBe('light');
  });

  it('looks past a see-through body to the page behind it', () => {
    document.body.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    document.documentElement.style.backgroundColor = 'rgb(20, 20, 20)';
    expect(pageScheme()).toBe('dark');
  });

  it('calls a page with no background light, as the browser paints it', () => {
    expect(pageScheme()).toBe('light');
  });
});
