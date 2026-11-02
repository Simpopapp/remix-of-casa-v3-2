import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Guard de sessão para rotas protegidas, usado no beforeLoad.
 * No SSR não há sessão no request — o cliente corrige o estado após hidratar,
 * então apenas ignoramos o guard no servidor para não derrubar a renderização.
 */
export async function guardSession(): Promise<void> {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw redirect({ to: "/entrar" });
  }
}
