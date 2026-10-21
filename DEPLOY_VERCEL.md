# Publicar na Vercel com banco próprio

## 1. Código no GitHub
No Lovable: Conectar ao GitHub → criar repositório.

## 2. Banco novo (supabase.com)
1. Crie um projeto.
2. No editor de SQL, rode **em ordem** os arquivos de `drizzle/migrations/`:
   `0000` → `0001` → `0002` → `0003` → `0004` → `0005` → `0006`.
   (O `0004` dá admin a um usuário pelo id do banco antigo; no banco novo pode ignorar — a lista de emails do `0003` já dá acesso ao criar a conta.)
3. Authentication → URL Configuration: coloque o domínio da Vercel em **Site URL** e **Redirect URLs** (`https://SEU-DOMINIO/**`).
4. Settings → API: copie URL, chave publishable/anon e chave service_role.

## 3. Projeto na Vercel
Importe o repositório. Em Settings → Environment Variables cadastre:

| Nome | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL do banco novo |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave publishable/anon |
| `VITE_SUPABASE_PROJECT_ID` | id do projeto do banco |
| `SUPABASE_URL` | mesma URL |
| `SUPABASE_PUBLISHABLE_KEY` | mesma chave publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role (secreta) |
| `DIGISTORE24_API_KEY` | sua chave da Digistore24 |
| `LOVABLE_CRON_SECRET` | um texto aleatório longo (protege o reenvio automático) |
| `NITRO_PRESET` | `vercel` |

Faça o deploy.

## 4. Reenvio automático (a cada 15 min)
No banco novo, ative as extensões `pg_cron` e `pg_net` e rode:

```sql
select cron.schedule('lawtrack-retry-queue', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://SEU-DOMINIO/api/public/jobs/process-queue',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer SEU_LOVABLE_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb);
$$);
```

## 5. Depois do deploy
- Entre em **Integrações** e copie a nova URL do webhook; cole no painel da Digistore24 (IPN).
- Cadastre de novo o token do TikTok e a senha IPN em Integrações.
- Atualize o script de rastreio (`/api/public/tracker.js`) nas suas páginas de venda para o domínio novo.
- Recrie os links de checkout em **Checkouts** (os dados do banco antigo não são copiados).
