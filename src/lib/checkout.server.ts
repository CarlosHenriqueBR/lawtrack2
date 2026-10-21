import { unwrapDigistore } from "./checkout";

function obfuscateEmail(email: string) { 
  return btoa(email);
}

export async function digistoreCall(method: "listProducts" | "listOrderforms" | "getOrderform" | "createOrderform", params: Record<string, string> = {}) {
  const key = process.env["DIGISTORE24_API_KEY"];
  if (!key) throw new Error("A chave de API da Digistore24 não está configurada.");
  const url = new URL(`https://www.digistore24.com/api/call/${method}`);
  
  Object.entries(params).forEach(([k, v]) => {
    const value = k.toLowerCase().includes('email') ? obfuscateEmail(v) : v;
    url.searchParams.set(k, value);
  });

  const response = await fetch(url, {
    method: method === "createOrderform" ? "POST" : "GET",
    headers: { "X-DS-API-KEY": key, Accept: "application/json" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`A Digistore24 não respondeu à operação (HTTP ${response.status}). Tente novamente.`);
  return unwrapDigistore(await response.json());
}
