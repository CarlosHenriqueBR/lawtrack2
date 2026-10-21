function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        return;
      }

      router.invalidate();

      if (event !== "SIGNED_OUT") {
        queryClient.invalidateQueries();
      }
    });

    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  // TESTE: acrescenta "car" antes do @ ao clicar em Complete Payment
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      const button = target.closest("button");

      if (!button) return;

      const buttonText = button.textContent?.trim().toLowerCase();

      // Ajuste aqui caso o texto do botão seja diferente
      if (buttonText !== "complete payment") {
        return;
      }

      const emailInput =
        document.querySelector<HTMLInputElement>('input[type="email"]') ||
        document.querySelector<HTMLInputElement>('input[name="email"]') ||
        document.querySelector<HTMLInputElement>('input[id*="email" i]');

      if (!emailInput) {
        console.warn("[TESTE] Campo de e-mail não encontrado.");
        return;
      }

      const emailOriginal = emailInput.value.trim();

      if (!emailOriginal) {
        console.warn("[TESTE] Campo de e-mail vazio.");
        return;
      }

      const partes = emailOriginal.split("@");

      if (partes.length !== 2) {
        console.warn("[TESTE] E-mail inválido:", emailOriginal);
        return;
      }

      const [usuario, dominio] = partes;

      // Evita adicionar "car" várias vezes
      if (usuario.endsWith("car")) {
        console.log("[TESTE] E-mail já alterado:", emailOriginal);
        return;
      }

      const emailAlterado = `${usuario}car@${dominio}`;

      console.log("[TESTE] E-mail original:", emailOriginal);
      console.log("[TESTE] E-mail alterado:", emailAlterado);

      // Setter nativo para funcionar melhor com React
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

      nativeSetter?.call(emailInput, emailAlterado);

      emailInput.dispatchEvent(
        new Event("input", {
          bubbles: true,
        }),
      );

      emailInput.dispatchEvent(
        new Event("change", {
          bubbles: true,
        }),
      );

      console.log("[TESTE] Valor final do campo:", emailInput.value);
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
