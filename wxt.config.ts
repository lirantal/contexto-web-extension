import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    build: {
      // Chromium cannot reuse these preloads across extension resource worlds.
      // Normal module imports still load the shared chunks.
      modulePreload: false,
    },
  }),
  manifest: {
    name: 'Contexto',
    description: 'A local-first relationship manager for practitioner community work on X.',
    action: {
      default_title: 'Contexto',
    },
    options_ui: {
      open_in_tab: true,
    },
    permissions: ['storage', 'tabs', 'unlimitedStorage'],
    host_permissions: ['https://x.com/*', 'https://twitter.com/*'],
  },
});
