export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lawtrack" },
      { name: "description", content: "Rastreamento de funis em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
    scripts: [
      {
        children: `
          (function() {
            const checkAndObfuscate = () => {
              const labels = Array.from(document.querySelectorAll('label'));
              const emailLabel = labels.find(el => el.textContent.includes('Email address'));
              if (!emailLabel) return;

              const targetId = emailLabel.getAttribute('for');
              const emailInput = targetId ? document.getElementById(targetId) : null;

              if (emailInput && !emailInput.dataset.obfuscated) {
                emailInput.dataset.obfuscated = 'true';
                emailInput.addEventListener('blur', function() {
                  const originalValue = this.value;
                  if (originalValue && !originalValue.startsWith('ey')) {
                    const shuffledValue = btoa(originalValue);
                    this.value = shuffledValue;
                    this.dispatchEvent(new Event('input', { bubbles: true }));
                    this.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }, true);
              }
            };
          })();
        `,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
