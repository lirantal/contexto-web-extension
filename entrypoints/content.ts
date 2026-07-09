import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ProfilePanel } from '@/src/ui/ProfilePanel';
import { parseXProfileUrl } from '@/src/shared/platforms/x';
import type { ProfileSnapshot } from '@/src/shared/types';
import '@/src/ui/profile-panel.css';

function extractProfile(): ProfileSnapshot | null {
  const parsed = parseXProfileUrl(location.href);
  if (!parsed) return null;

  const userNameBlock = document.querySelector('[data-testid="UserName"]');
  const text = userNameBlock?.textContent?.replace(/\s+/g, ' ').trim();
  const displayName = text?.split('@')[0]?.trim();
  const bioSnapshot = document.querySelector('[data-testid="UserDescription"]')?.textContent?.trim();
  const locationText = document.querySelector('[data-testid="UserLocation"]')?.textContent?.trim();
  const avatar = document.querySelector<HTMLImageElement>('img[src*="profile_images"]')?.src;

  return {
    ...parsed,
    displayName: displayName || parsed.handle,
    bioSnapshot: bioSnapshot || undefined,
    location: locationText || undefined,
    avatarUrl: avatar,
    capturedAt: new Date().toISOString(),
  };
}

function ContentApp() {
  const [profile, setProfile] = useState<ProfileSnapshot | null>(() => extractProfile());

  useEffect(() => {
    let previousUrl = location.href;
    const interval = window.setInterval(() => {
      if (location.href !== previousUrl) {
        previousUrl = location.href;
        setProfile(extractProfile());
      }
    }, 700);

    const observer = new MutationObserver(() => {
      const next = extractProfile();
      if (next?.profileUrl !== profile?.profileUrl || next?.displayName !== profile?.displayName) {
        setProfile(next);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearInterval(interval);
      observer.disconnect();
    };
  }, [profile?.profileUrl, profile?.displayName]);

  return React.createElement(ProfilePanel, { profile });
}

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let root: Root | undefined;
    const ui = await createShadowRootUi(ctx, {
      name: 'contexto-x-profile',
      position: 'overlay',
      anchor: 'body',
      onMount(container) {
        const wrapper = document.createElement('div');
        container.append(wrapper);
        root = createRoot(wrapper);
        root.render(React.createElement(ContentApp));
      },
      onRemove() {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
