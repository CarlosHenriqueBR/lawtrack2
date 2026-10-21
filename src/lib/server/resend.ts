function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export async function sendProductAccessEmail(input: {
  to: string;
  orderId: string;
  idempotencyKey: string;
}) {
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  const from = process.env["RESEND_FROM_EMAIL"]?.trim();
  const accessUrl = process.env["PRODUCT_ACCESS_URL"]?.trim();
  const missing = [
    ...(!apiKey ? ["RESEND_API_KEY"] : []),
    ...(!from ? ["RESEND_FROM_EMAIL"] : []),
    ...(!accessUrl ? ["PRODUCT_ACCESS_URL"] : []),
  ];
  if (!apiKey || !from || !accessUrl) {
    throw new Error(`Resend configuration is incomplete: ${missing.join(", ")}`);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(accessUrl);
  } catch {
    throw new Error("PRODUCT_ACCESS_URL must be an absolute HTTPS URL.");
  }
  if (parsedUrl.protocol !== "https:") throw new Error("PRODUCT_ACCESS_URL must use HTTPS.");

  const safeUrl = escapeHtml(parsedUrl.toString());
  const safeOrderId = escapeHtml(input.orderId);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Seu acesso está liberado",
      html: `<p>Olá!</p><p>Seu pagamento foi confirmado e seu acesso já está disponível.</p><p><a href="${safeUrl}">Acessar o produto</a></p><p>Pedido: ${safeOrderId}</p>`,
      text: `Olá! Seu pagamento foi confirmado e seu acesso já está disponível.\n\nAcesse: ${parsedUrl.toString()}\nPedido: ${input.orderId}`,
    }),
  });
  if (!response.ok) throw new Error(`Resend rejected the access email (HTTP ${response.status}).`);
}
