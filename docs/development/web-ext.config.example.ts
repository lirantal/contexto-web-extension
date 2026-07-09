import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  binaries: {
    // Set this to your preferred Chromium browser.
    // Examples: '/usr/bin/vivaldi', '/usr/bin/google-chrome-stable'
    chrome: process.env.CONTEXTO_CHROMIUM_BINARY ?? '/usr/bin/vivaldi',
  },
  chromiumArgs: ['--user-data-dir=./.wxt/chromium-profile'],
  keepProfileChanges: true,
});
