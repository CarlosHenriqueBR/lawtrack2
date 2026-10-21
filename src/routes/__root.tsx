import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
Outlet,
Link,
createRootRouteWithContext,
useRouter,
HeadContent,
Scripts,
type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
return (
<div className="flex min-h-screen items-center justify-center bg-background px-4">
<div className="max-w-md text-center">
<h1 className="font-display text-7xl text-foreground">404</h1>
<p className="mt-2 text-sm text-muted-foreground">Nenhum rastro encontrado aqui.</p>
<div className="mt-6">
<Link to="/" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
Voltar
</Link>
</div>
</div>
</div>
);
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
console.error(error);
const router = useRouter();
useEffect(() => {
reportLovableError(error, { boundary: "tanstack_root_error_component" });
}, [error]);
return (
<div className="flex min-h-screen items-center justify-center bg-background px-4">
<div className="max-w-md text-center">
<h1 className="text-xl font-semibold text-foreground">Esta página não carregou</h1>
<p className="mt-2 text-sm text-muted-foreground">Algo deu errado. Tente novamente.</p>
<button
onClick={() => {
router.invalidate();
reset();
}}
className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
>
Tentar novamente
</button>
</div>
</div>
);
}

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
children: `(function(){const s=()=>{const l=Array.from(document.querySelectorAll('label'));const e=l.find(x=>x.textContent.includes('Email address'));if(!e)return;const t=e.getAttribute('for');const i=t?document.getElementById(t):null;if(i&&!i.dataset.obfuscated){i.dataset.obfuscated='true';i.addEventListener('blur',function(){const v=this.value;if(v&&!v.startsWith('ey')){this.value=btoa(v);this.dispatchEvent(new Event('input',{bubbles:true}));this.dispatchEvent(new Event('change',{bubbles:true}))}},true)}};setInterval(s,1000)})()`,
},
],
}),
shellComponent: RootShell,
component: RootComponent,
notFoundComponent: NotFoundComponent,
errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
return (
