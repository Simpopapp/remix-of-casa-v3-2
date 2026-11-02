import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/entrar")({
  component: Entrar,
  head: () => ({
    meta: [
      {
        title: "Entrar — Casa Viva",
      },
      {
        name: "description",
        content: "Entre na Casa Viva: a memória, o radar e o cérebro operacional do seu lar.",
      },
      { property: "og:title", content: "Entrar — Casa Viva" },
      {
        property: "og:description",
        content: "Entre na Casa Viva: a memória, o radar e o cérebro operacional do seu lar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Entrar() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          toast.error("Não foi possível entrar", { description: error.message });
          return;
        }
        navigate({ to: "/" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) {
          toast.error("Não foi possível criar a conta", {
            description: error.message,
          });
          return;
        }
        if (!data.session) {
          toast.info("Quase lá", {
            description: "Enviamos um link de confirmação para o seu e-mail. Confirme para entrar.",
          });
          setMode("entrar");
          return;
        }
        navigate({ to: "/" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível continuar", {
        description: result.error.message,
      });
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[64rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative w-full max-w-md">
        <header className="mb-8 text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
            Casa Viva
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A memória, o radar e o cérebro operacional da sua casa.
          </p>
        </header>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex gap-1 rounded-full bg-muted p-1 text-sm">
            {(
              [
                ["entrar", "Entrar"],
                ["criar", "Criar conta"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex-1 rounded-full px-3 py-1.5 font-medium transition-colors ${
                  mode === value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "criar" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Como você se chama?</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Um instante…"
                : mode === "entrar"
                  ? "Entrar"
                  : "Criar minha conta"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => social("google")}
            >
              Continuar com Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => social("lovable")}
            >
              Continuar com Lovable
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const { error } = await supabase.auth.signInAnonymously();
                setBusy(false);
                if (error) {
                  toast.error("Não foi possível entrar como convidado", {
                    description: error.message,
                  });
                  return;
                }
                navigate({ to: "/" });
              }}
            >
              Entrar como convidado (sem conta)
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Sua casa é sua: seus dados ficam no seu lar, acessíveis só por quem
          você convidar.
        </p>
      </div>
    </div>
  );
}
