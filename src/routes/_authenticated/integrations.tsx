import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { fetchFunnels } from "@/lib/data";
import { getIntegrationSecrets, retryQueueItems, saveIntegrationSecret } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [{ title: "Integrações — Lawtrack" }, { name: "description", content: "TikTok Ads e Digistore24." }] }),
  component: Integrations,
});

function Integrations() {
  const qc = useQueryClient();
  const getSecrets = useServerFn(getIntegrationSecrets);
  const saveSecret = useServerFn(saveIntegrationSecret);
  const retry = useServerFn(retryQueueItems);
  const secrets = useQuery({ queryKey: ["secrets"], queryFn: () => getSecrets() });
  const funnels = useQuery({ queryKey: ["funnels"], queryFn: fetchFunnels });
  const integ = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => (await supabase.from("integrations").select("*")).data ?? [],
  });
  const queue = useQuery({
    queryKey: ["queue"],
    queryFn: async () =>
      (await supabase.from("event_queue").select("id, event_name, event_id, status, attempts, last_error, last_status_code, created_at").order("created_at", { ascending: false }).limit(50)).data ?? [],
    refetchInterval: 10_000,
  });
  const [token, setToken] = useState("");
  const [pass, setPass] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  async function store(key: "tiktok_access_token" | "digistore_ipn_passphrase" | "digistore_webhook_token", value: string) {
    try {
      await saveSecret({ data: { key, value } });
      toast.success("Salvo com segurança");
      setToken("");
      setPass("");
      qc.invalidateQueries({ queryKey: ["secrets"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveFunnel(funnelId: string, patch: Record<string, unknown>, pixel?: string) {
    const existing = integ.data?.find((i) => i.funnel_id === funnelId);
    const row = { funnel_id: funnelId, ...(existing ?? {}), ...patch, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("integrations").upsert(row, { onConflict: "funnel_id" });
    if (pixel !== undefined) await supabase.from("funnels").update({ tiktok_pixel_id: pixel || null }).eq("id", funnelId);
    if (error) toast.error(error.message);
    else toast.success("Integração salva");
    qc.invalidateQueries({ queryKey: ["integrations"] });
    qc.invalidateQueries({ queryKey: ["funnels"] });
  }

  const webhookUrl = secrets.data ? `${origin}/api/public/webhooks/digistore24?token=${secrets.data.webhookToken}` : "…";
  const counts = (queue.data ?? []).reduce<Record<string, number>>((m, x) => ((m[x.status] = (m[x.status] ?? 0) + 1), m), {});

  return (
    <div>
      <PageHeader title="Integrações" sub="Chaves ficam só no servidor; aqui você vê apenas os últimos dígitos." />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel space-y-4 p-6">
          <h2 className="font-display text-2xl">TikTok Events API</h2>
          <div className="space-y-1.5">
            <Label>Access Token {secrets.data?.tiktokTokenHint && <span className="text-muted-foreground">(atual {secrets.data.tiktokTokenHint})</span>}</Label>
            <div className="flex gap-2">
              <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole um novo token" />
              <Button onClick={() => store("tiktok_access_token", token)} disabled={!token}>
                Salvar
              </Button>
            </div>
          </div>
          {funnels.data?.map((f) => {
            const i = integ.data?.find((x) => x.funnel_id === f.id);
            return <FunnelTikTok key={f.id} name={f.name} pixel={f.tiktok_pixel_id ?? ""} i={i} onSave={(p, px) => saveFunnel(f.id, p, px)} />;
          })}
          <p className="text-xs text-muted-foreground">
            Enviamos apenas eventos reais: InitiateCheckout quando o visitante chega no checkout e CompletePayment quando a Digistore24 confirma a venda. O
            mesmo event_id evita duplicação com o Pixel do navegador.
          </p>
        </section>

        <section className="panel space-y-4 p-6">
          <h2 className="font-display text-2xl">Digistore24</h2>
          <div className="space-y-1.5">
            <Label>URL do webhook (IPN)</Label>
            <pre className="overflow-x-auto rounded-sm bg-muted p-3 text-xs">{webhookUrl}</pre>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => (navigator.clipboard.writeText(webhookUrl), toast.success("Copiado"))}>
                Copiar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => confirm("Gerar nova URL? A antiga para de funcionar.") && store("digistore_webhook_token", "x")}>
                Gerar nova
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Senha IPN (assinatura) — {secrets.data?.passphraseSet ? "configurada" : "não configurada"}</Label>
            <div className="flex gap-2">
              <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="A mesma senha definida na Digistore24" />
              <Button onClick={() => store("digistore_ipn_passphrase", pass)} disabled={!pass}>
                Salvar
              </Button>
            </div>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Na Digistore24: Configurações → Integrações (IPN) → Nova conexão → Genérica.</li>
            <li>Cole a URL acima e defina a mesma senha IPN.</li>
            <li>O script da Lawtrack envia o visitante no campo "custom" para ligar a venda à jornada.</li>
          </ol>
        </section>
      </div>

      <section className="panel mt-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">Fila de eventos</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {Object.entries(counts).map(([k, v]) => (
              <span key={k}>
                {k}: {v}
              </span>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await retry({ data: {} });
                  toast.success("Reprocessando");
                } catch (e) {
                  toast.error((e as Error).message);
                }
                qc.invalidateQueries({ queryKey: ["queue"] });
              }}
            >
              Reprocessar falhas
            </Button>
          </div>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              {["Criado", "Evento", "Event ID", "Status", "Tentativas", "Erro"].map((h) => (
                <th key={h} className="py-2 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queue.data?.map((x) => (
              <tr key={x.id} className="border-t">
                <td className="py-2">{new Date(x.created_at).toLocaleString("pt-BR")}</td>
                <td>{x.event_name}</td>
                <td className="text-muted-foreground">{x.event_id}</td>
                <td className={x.status === "success" ? "text-success" : x.status === "dead_letter" ? "text-destructive" : "text-warning"}>{x.status}</td>
                <td>{x.attempts}</td>
                <td className="max-w-80 truncate text-muted-foreground">{x.last_error}</td>
              </tr>
            ))}
            {queue.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  Fila vazia.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function FunnelTikTok({
  name,
  pixel,
  i,
  onSave,
}: {
  name: string;
  pixel: string;
  i: { tiktok_enabled: boolean; tiktok_advertiser_id: string | null; tiktok_test_mode: boolean; tiktok_test_event_code: string | null } | undefined;
  onSave: (p: Record<string, unknown>, pixel: string) => void;
}) {
  const [s, set] = useState({
    pixel,
    enabled: i?.tiktok_enabled ?? false,
    adv: i?.tiktok_advertiser_id ?? "",
    test: i?.tiktok_test_mode ?? true,
    code: i?.tiktok_test_event_code ?? "",
  });
  return (
    <div className="space-y-3 rounded-sm border p-4">
      <div className="flex items-center justify-between">
        <span>{name}</span>
        <label className="flex items-center gap-2 text-xs">
          Ativo <Switch checked={s.enabled} onCheckedChange={(v) => set({ ...s, enabled: v })} />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Pixel ID" value={s.pixel} onChange={(e) => set({ ...s, pixel: e.target.value })} />
        <Input placeholder="Advertiser ID" value={s.adv} onChange={(e) => set({ ...s, adv: e.target.value })} />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs">
          <Switch checked={s.test} onCheckedChange={(v) => set({ ...s, test: v })} /> Ambiente de teste
        </label>
        {s.test && <Input className="flex-1" placeholder="Test event code" value={s.code} onChange={(e) => set({ ...s, code: e.target.value })} />}
      </div>
      <Button
        size="sm"
        onClick={() =>
          onSave({ tiktok_enabled: s.enabled, tiktok_advertiser_id: s.adv || null, tiktok_test_mode: s.test, tiktok_test_event_code: s.code || null }, s.pixel)
        }
      >
        Salvar funil
      </Button>
    </div>
  );
}
