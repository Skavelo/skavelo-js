import { Widget, type AppliedTheme } from './ui/widget';

export type PreviewView = 'launcher' | 'input' | 'chat' | 'walkthrough';

export interface PreviewOptions {
  view: PreviewView;
  scheme: 'light' | 'dark';
  branding: boolean;
  /** Starter questions to show on the input view. */
  suggestions?: string[];
}

const noop = () => {};

/**
 * Renders the real widget with sample content inside `container` (which should be
 * position: relative). Used by the dashboard's Appearance page.
 */
export function mountPreview(container: HTMLElement, theme: AppliedTheme, options: PreviewOptions) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
  container.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  let widget: Widget | null = null;
  let current = { theme, options };

  const render = () => {
    widget?.destroy();
    widget = new Widget(root, { ...current.theme, branding: current.options.branding }, {
      onAsk: noop, onStop: noop, onOpen: noop, onClose: noop,
      onStepNext: noop, onStepBack: noop, onFeedback: noop,
    }, { preview: true });
    widget.setScheme(current.options.scheme);

    switch (current.options.view) {
      case 'launcher':
        break;
      case 'input':
        widget.setSuggestions(current.options.suggestions ?? []);
        widget.showView('composer');
        break;
      case 'chat':
        widget.showView('panel');
        widget.addMessage('How do I export my invoices?', 'user');
        widget.addAnswerMessage(
          'Open **Invoices** and click **Export CSV**. You get every invoice in the current view as a CSV file.',
          [{ title: 'Exporting invoices' }],
          'preview',
        );
        break;
      case 'walkthrough':
        widget.showStep({
          title: 'Export your invoices',
          instruction: 'Click **Export CSV** in the top right.',
          stepIndex: 1,
          total: 3,
          found: true,
        });
        break;
    }
  };

  render();

  return {
    update(theme: AppliedTheme, options: PreviewOptions) {
      const viewChanged = options.view !== current.options.view || options.scheme !== current.options.scheme;
      current = { theme, options };
      if (viewChanged || !widget) render();
      else {
        widget.applyTheme({ ...theme, branding: options.branding });
        widget.setSuggestions(options.view === 'input' ? options.suggestions ?? [] : []);
      }
    },
    destroy() {
      widget?.destroy();
      host.remove();
    },
  };
}
