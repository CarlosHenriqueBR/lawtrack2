import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lawtrack — Rastreamento de funis em tempo real" },
      { name: "description", content: "Veja cada visitante avançando pelo seu funil, ao vivo, com origem TikTok Ads." },
      { property: "og:title", content: "Lawtrack — Rastreamento de funis em tempo real" },
      { property: "og:description", content: "Veja cada visitante avançando pelo seu funil, ao vivo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-8 py-6">
        <Logo />
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>
      <section className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-8 pb-24">
        <p className="mb-6 text-xs uppercase tracking-[0.3em] text-primary">
          <span className="pulse-dot mr-2 inline-block h-2 w-2 rounded-full bg-primary" />
          Observação contínua
        </p>
        <h1 className="font-display text-6xl leading-[1.05] text-foreground md:text-7xl">
          Todo visitante deixa um <em className="text-primary">rastro</em>.
        </h1>
        <p className="mt-6 max-w-xl text-muted-foreground">
          Acompanhe quem entra no seu funil, em qual etapa está, de qual campanha veio e quando converte — sem
          recarregar a página.
        </p>
        <div className="mt-10">
          <Button asChild size="lg" className="glow">
            <Link to="/auth">Abrir o caderno</Link>
          </Button>
        </div>
      </section>
      <footer className="px-8 py-6 text-xs text-muted-foreground">
        {/* easter egg */}
        <span title="Os shinigamis adoram maçãs.">🍎 L.</span>
      </footer>
    </main>
  );
}
