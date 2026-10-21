export function checkoutEmbedSnippet(origin: string, slug: string) {
  const base = new URL(origin).origin;
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug)) throw new Error("Checkout inválido");
  return `<style>\n[data-lawtrack-checkout="${slug}"] { --buy-background: #f43b59; --buy-text: #ffffff; display: block; width: 100%; max-width: 320px; min-height: 51px; padding: 14px 20px; border: 0; border-radius: 8px; background: var(--buy-background); color: var(--buy-text); font: 700 15px Arial, sans-serif; cursor: pointer; }\n[data-lawtrack-checkout="${slug}"]:focus-visible { outline: 2px solid var(--buy-background); outline-offset: 3px; }\n</style>\n<script src="${base}/api/public/checkout-popup.js" data-checkout="${slug}" defer></script>\n<button type="button" data-lawtrack-checkout="${slug}">Comprar agora</button>`;
}

// Serialized into the public script; keep this function self-contained and browser-only.
function installCheckoutPopup() {
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return;
  const origin = new URL(script.src).origin;
  const defaultSlug = script.dataset["checkout"] || "";
  const hostWindow = window as typeof window & {
    LawtrackCheckout?: { open: (slug?: string) => void; close: () => void };
  };
  if (hostWindow.LawtrackCheckout) return;
  let active: HTMLDialogElement | null = null;
  let previousOverflow = "";
  let previousFocus: HTMLElement | null = null;

  function close() {
    if (!active) return;
    active.close();
    active.remove();
    active = null;
    document.documentElement.style.overflow = previousOverflow;
    previousFocus?.focus();
  }

  function open(slug = defaultSlug) {
    if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug) || active) return;
    const url = new URL(`/checkout/${encodeURIComponent(slug)}`, origin);
    const params = new URLSearchParams(window.location.search);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "lt_sid"]) {
      const value = params.get(key);
      if (value) url.searchParams.set(key, value);
    }
    if (!url.searchParams.has("lt_sid")) {
      const cookie = document.cookie.split("; ").find((item) => item.startsWith("lt_sid="));
      if (cookie) {
        try { url.searchParams.set("lt_sid", decodeURIComponent(cookie.slice(7))); } catch { /* Ignore malformed cookies. */ }
      }
    }
    // The email capture renders as a small modal and the payment fills the screen.
    url.searchParams.set("embed", "1");
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previousOverflow = document.documentElement.style.overflow;
    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-label", "Checkout");
    dialog.setAttribute("data-lawtrack-popup", "");
    const container = document.createElement("div");
    const shadow = container.attachShadow({ mode: "open" });
    dialog.appendChild(container);
    const outerStyle = document.createElement("style");
    outerStyle.textContent = `
      dialog[data-lawtrack-popup] { --popup-surface: #ffffff; --popup-ink: #b5b5ba; --popup-backdrop: #00000099;
        position: fixed; inset: 0; margin: 0; padding: 0; border: 0; border-radius: 0;
        width: 100vw; height: 100dvh; max-width: none; max-height: none;
        background: var(--popup-surface); color: var(--popup-ink); overflow: hidden; }
      dialog[data-lawtrack-popup]::backdrop { background: var(--popup-backdrop); }
      dialog[data-lawtrack-popup] > div { height: 100%; }
    `;
    dialog.appendChild(outerStyle);
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; height: 100%; }
      .bar { position: absolute; top: 10px; right: 10px; z-index: 1; display: flex; justify-content: flex-end; align-items: center; }
      button { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 4px;
        background: transparent; color: var(--popup-ink); cursor: pointer; font: 28px Arial, sans-serif; }
      button:focus-visible { outline: 2px solid var(--popup-ink); outline-offset: -2px; }
      iframe { display: block; width: 100%; height: 100%; border: 0; background: var(--popup-surface); }
    `;
    const bar = document.createElement("div");
    bar.className = "bar";
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", "Fechar checkout");
    button.textContent = "×";
    button.addEventListener("click", close);
    bar.appendChild(button);
    const iframe = document.createElement("iframe");
    iframe.title = "Checkout";
    iframe.src = url.toString();
    iframe.allow = "payment *; publickey-credentials-get *";
    shadow.append(style, bar, iframe);
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
    dialog.addEventListener("click", (event) => { if (event.composedPath()[0] === dialog) close(); });
    document.body.appendChild(dialog);
    active = dialog;
    document.documentElement.style.overflow = "hidden";
    dialog.showModal();
    button.focus();
  }

  hostWindow.LawtrackCheckout = { open, close };
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest("[data-lawtrack-checkout]");
    if (!trigger) return;
    event.preventDefault();
    open(trigger.getAttribute("data-lawtrack-checkout") || defaultSlug);
  });
}

export const checkoutPopupScript = `;(${installCheckoutPopup.toString()})();`;