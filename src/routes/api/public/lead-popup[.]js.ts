import { createFileRoute } from "@tanstack/react-router";

export const popupScript = `(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var origin = new URL(script.src).origin;
  var slug = script.getAttribute("data-checkout");
  if (!slug || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug)) return;
  var active = null;
  function openPopup() {
    if (active) return;
    var previous = document.activeElement;
    var dialog = document.createElement("dialog");
    dialog.id = "lead-email-overlay";
    dialog.setAttribute("aria-label", "Email");
    var shadow = dialog.attachShadow({mode: "open"});
    var style = document.createElement("style");
    style.textContent = ":host{--popup-surface:Canvas;--popup-text:CanvasText;--popup-shade:color-mix(in srgb, CanvasText 55%, transparent);border:0;padding:0;width:min(640px,calc(100vw - 32px));height:min(680px,calc(100dvh - 32px));max-height:calc(100dvh - 32px);background:var(--popup-surface);color:var(--popup-text);border-radius:8px}:host::backdrop{background:var(--popup-shade)}iframe{display:block;width:100%;height:100%;border:0}button{position:absolute;right:8px;top:8px;z-index:2;width:32px;height:32px;border:1px solid currentColor;border-radius:4px;background:var(--popup-surface);color:var(--popup-text);font:24px Arial;cursor:pointer}";
    shadow.appendChild(style);
    var close = document.createElement("button");
    close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label", "Close");
    var frame = document.createElement("iframe");
    frame.title = "Email";
    var url = new URL("/capture/" + slug, origin);
    var params = new URLSearchParams(location.search);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term","lt_sid"].forEach(function(key){var value=params.get(key);if(value)url.searchParams.set(key,value.slice(0,key==="lt_sid"?80:200));});
    if (!url.searchParams.has("lt_sid")) {var cookie=document.cookie.split("; ").find(function(c){return c.indexOf("lt_sid=")===0;});if(cookie)url.searchParams.set("lt_sid",decodeURIComponent(cookie.slice(7)));}
    url.searchParams.set("parent_origin", location.origin);
    frame.src = url.toString();
    shadow.appendChild(close); shadow.appendChild(frame);
    function cleanup(){window.removeEventListener("message", receive);dialog.remove();active=null;if(previous && previous.focus)previous.focus();}
    function receive(event){
      if(event.origin!==origin || event.source!==frame.contentWindow || !event.data || event.data.type!=="lawtrack:lead-saved")return;
      try {var target=new URL(event.data.url);if(target.origin!==origin || target.pathname!=="/checkout/"+slug || !/^#lead=L[a-f0-9]{32}$/.test(target.hash))return;location.assign(target.toString());}catch(e){}
    }
    close.onclick=function(){dialog.close();};
    dialog.addEventListener("close", cleanup);
    dialog.addEventListener("click",function(e){if(e.target===dialog){var r=dialog.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)dialog.close();}});
    window.addEventListener("message", receive);
    document.body.appendChild(dialog);active=dialog;dialog.showModal();
  }
  window.openPopup = openPopup;
  document.addEventListener("click", function(event){var trigger=event.target.closest && event.target.closest("[data-lawtrack-popup]");if(trigger){event.preventDefault();openPopup();}});
})();`;

export const Route = createFileRoute("/api/public/lead-popup.js")({
  server: { handlers: { GET: () => new Response(popupScript, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } }) } },
});