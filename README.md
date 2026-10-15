# Skavelo JavaScript SDK

The widget for [Skavelo](https://skavelo.com), the in-product AI guide. Add it to your web app and your users can ask questions in plain words. Skavelo answers from your docs and your product, walks them through tasks step by step on the real screen, and runs actions in your app once they approve.

It loads in its own Shadow DOM, so your styles and its styles never touch, and it has no dependencies.

## Install

You need an agent ID from your Skavelo dashboard (the agent's **Install** tab). Add the widget once, at the root of your app; it follows client side navigation by itself.

### Script tag

Any site, CMS or server rendered app. Put it just before `</body>` in your shared layout:

```html
<script src="https://cdn.skavelo.com/skavelo.js"></script>
<script>
  Skavelo.init({ agentId: 'YOUR_AGENT_ID' });
</script>
```

### npm

```bash
npm install @skavelo/sdk
```

```ts
import { Skavelo } from '@skavelo/sdk';

Skavelo.init({ agentId: 'YOUR_AGENT_ID' });
```

Call it once in the browser, in your root component: `onMounted` in Vue, `onMount` in Svelte or SvelteKit, a client-only plugin in Nuxt, `afterNextRender` in Angular. On the server, `Skavelo.init` does nothing, so server rendering never breaks.

### React and Next.js

```tsx
import { SkaveloProvider } from '@skavelo/sdk/react';

<SkaveloProvider agentId="YOUR_AGENT_ID" user={user && { id: user.id, plan: user.plan }}>
  <App />
</SkaveloProvider>
```

In the Next.js App Router, render the provider from a `'use client'` component used by your root layout. Inside it:

```tsx
import { useSkavelo, useSkaveloEvent, SkaveloLauncher } from '@skavelo/sdk/react';

const { open, ask } = useSkavelo();
useSkaveloEvent('walkthrough_complete', ({ workflowId }) => track('guide_done', { workflowId }));
<SkaveloLauncher label="Help" />; // your own button that opens the widget
```

The provider cleans up on unmount and works with React's strict mode.

## Tell Skavelo who's signed in

Optional. Without it the widget works for everyone, anonymously.

```ts
Skavelo.identify({
  id: user.id,          // required
  name: user.name,      // shown to your team only
  email: user.email,    // shown to your team only
  plan: user.plan,      // answers can take it into account
  role: user.role,
  tags: ['beta'],       // up to 20; usable in targeting rules
  traits: { company: 'Acme', seats: 12 }, // up to 30 of your own
  userHash,             // optional, see below
});
```

Only `plan`, `role` and `tags` are given to the AI. Name, email and traits are for your team, in the dashboard's Conversations.

**Verified identities.** `identify` runs in the browser, so anyone could claim to be someone else. To prevent that, sign the user ID on your server with the identity secret from your dashboard's Settings and pass the result as `userHash`:

```ts
// On your server
const userHash = crypto.createHmac('sha256', process.env.SKAVELO_IDENTITY_SECRET).update(user.id).digest('hex');
```

## Options

```ts
Skavelo.init({
  agentId: 'YOUR_AGENT_ID',
  // or workspaceId: 'YOUR_WORKSPACE_ID', to let each page show the agent whose targeting matches it

  user: { id: user.id },     // same as calling identify

  theme: {                   // overrides the Appearance settings from the dashboard
    accent: '#2F6BFF',
    position: 'bottom-right', // 'bottom-center' | 'bottom-right' | 'bottom-left'
    label: 'Get help',
    title: 'Acme Help',
    icon: 'https://acme.com/icon.png',
    offset: 24,
  },

  actions: {                 // for skills, the actions Skavelo runs in your app
    headers: () => ({ 'X-CSRF-Token': getCsrfToken() }),
  },
});
```

Where the widget shows (pages, countries, signed in users, plans, devices, gradual rollout) and its suggested questions are set in the dashboard, so they change without a deploy.

## API

`Skavelo.init()` returns the widget:

| Method | What it does |
|---|---|
| `open()` / `close()` | Opens or closes the widget. |
| `ask(question)` | Asks a question as if the user typed it. |
| `identify(user)` | Same as `Skavelo.identify`. |
| `on(event, handler)` / `off(event, handler)` | Listens for widget events. |
| `destroy()` | Removes the widget from the page. |

Events: `open`, `close`, `answer`, `step`, `step_complete`, `walkthrough_complete`, `walkthrough_abandon`, `walkthrough_replay`, `do_approved`, `do_rejected`, `handoff`.

## Security and privacy

- The widget only answers on the sites allowed for your agent in the dashboard.
- Skills (actions) run from the visitor's browser with their own session, only after they click to approve, so they can never do more than the visitor already could.
- To understand the page someone is asking about, the widget reads short visible text (buttons, headings, labels) when they ask a question. It never reads what people typed: form values, passwords and rich text editors are left out.
- Mark anything else private with `data-sk-sensitive`, and nothing inside that element is read:

  ```html
  <section data-sk-sensitive>…card details, health data…</section>
  ```

## License

[Elastic License 2.0](./LICENSE.md). You can read, use and modify the SDK, but not offer it to others as a hosted service. The Skavelo name and logo are trademarks of Skavelo.
