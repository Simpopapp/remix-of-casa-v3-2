import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

import { AppNav } from "@/components/app-nav";
import { PlantaIsometrica } from "@/components/planta/PlantaIsometrica";
import { Button } from "@/components/ui/button";
import { guardSession } from "@/lib/auth-guard";
import { HOUSEHOLD_KIND_LABEL, formatBRL, formatDate } from "@/lib/format";
import { getHomeState } from "@/lib/queries";
import { claimInvites } from "@/lib/writes";

import {
  computePulse,
  pulseImprovements,
  pulseTimeline,
  roomPulses,
  type PulseLevel,
} from "@/lib/pulse";
import { warrantySuggestions } from "@/lib/suggestions";

export const Route = createFileRoute("/")({
  beforeLoad: () => guardSession(),
  component: Home,
  head: () => ({
    meta: [
      { title: "Casa Viva" },
      {
        name: "description",
        content:
          "O painel vivo da sua casa: cômodos, documentos, obrigações e tudo que mantém o lar bem cuidado.",
      },
      { property: "og:title", content: "Casa Viva" },
      {
        property: "og:description",
        content:
          "O painel vivo da sua casa: cômodos, documentos, obrigações e tudo que mantém o lar bem cuidado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const LEVEL_LABEL: Record<PulseLevel, string> = {
  tranquilo: "Tranquilo",
  atencao: "Atenção",
  urgente: "Urgente",
};

const LEVEL_CHIP: Record<PulseLevel, string> = {
  tranquilo: "bg-tranquilo/15 text-tranquilo-foreground border-tranquilo/40",
  atencao: "bg-atencao/15 text-atencao-foreground border-atencao/40",
  urgente: "bg-urgente/15 text-urgente-foreground border-urgente/40",
};

function Home() {
  const { data, isLoading } = useQuery({
    queryKey: ["home-state"],
    queryFn: () => getHomeState(),
    staleTime: 30_000,
  });

  // Quem foi chamado por e-mail vira morador ao entrar com a mesma conta.
  useEffect(() => {
    void claimInvites().catch(() => {});
  }, []);


  const pulses = useMemo(() => {
    if (!data) return { perRoom: new Map(), house: null };
    const perRoom = roomPulses(
      data.rooms.map((r) => r.id),
      { assets: data.assets, obligations: data.obligations, documents: data.documents },
    );
    const house = computePulse({
      obligations: data.obligations,
      assets: data.assets,
      documents: data.documents,
    });
    return { perRoom, house };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-primary/20" />
          <p className="text-sm text-muted-foreground">Abrindo a casa…</p>
        </div>
      </div>
    );
  }

  if (!data?.household) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
            Sua casa ainda está esperando
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Em poucos minutos ela vira um painel vivo: cômodos, documentos,
            obrigações e tudo o que mantém o lar bem cuidado.
          </p>
          <Link to="/onboarding" className="mt-6 inline-block">
            <Button size="lg">Começar agora</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { household, rooms } = data;
  const house = pulses.house;
  const improvements = house ? pulseImprovements(house) : [];
  const timeline = pulseTimeline(
    data.obligations.map((o) => ({
      title: o.title,
      amount: o.amount,
      next_due: o.next_due,
      frequency: o.frequency,
      custom_interval_days: o.custom_interval_days,
    })),
  );
  const warranty = warrantySuggestions(data.assets);

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppNav />
      <header className="mx-auto max-w-5xl px-4 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-primary">
              {HOUSEHOLD_KIND_LABEL[household.kind] ?? "Lar"}
            </p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
              {household.name}
            </h1>
          </div>
          {house && (
            <div
              className={`rounded-2xl border px-4 py-2 text-center ${LEVEL_CHIP[house.level]}`}
            >
              <p className="font-display text-2xl font-semibold leading-none">
                {house.score}
              </p>
              <p className="mt-1 text-xs font-medium">
                Pulso da casa · {LEVEL_LABEL[house.level]}
              </p>
            </div>
          )}
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-5xl px-4 py-8">
        {rooms.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              A casa está em branco
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Monte os cômodos e comece a guardar a vida da casa neles.
            </p>
            <Link to="/onboarding" className="mt-6 inline-block">
              <Button variant="outline">Montar a planta</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <section className="rounded-3xl border border-border bg-card/70 p-4 shadow-sm sm:p-6">
              <PlantaIsometrica rooms={rooms} pulses={pulses.perRoom} />
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Toque em um cômodo para entrar nele.
              </p>
            </section>

            {improvements.length > 0 && (
              <section className="rounded-3xl border border-border bg-card/70 p-5 shadow-sm">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  O que melhoraria agora
                </h2>
                <ul className="mt-3 space-y-2">
                  {improvements.slice(0, 4).map((i) => (
                    <li
                      key={i.action}
                      className="flex items-start justify-between gap-3 rounded-2xl bg-background/70 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{i.action}</p>
                        <p className="text-xs text-muted-foreground">{i.detail}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-tranquilo/15 px-2 py-0.5 text-xs font-semibold text-tranquilo-foreground">
                        +{i.recovers}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {timeline.some((m) => m.items.length > 0) && (
              <section className="rounded-3xl border border-border bg-card/70 p-5 shadow-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    Próximos 12 meses
                  </h2>
                  <Link
                    to="/obrigacoes"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Ver o radar
                  </Link>
                </div>
                <ol className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {timeline.map((m) => (
                    <li
                      key={m.key}
                      className={`min-w-32 shrink-0 rounded-2xl border px-3 py-2 ${
                        m.items.length > 0
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-background/60"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {m.label}
                      </p>
                      {m.items.length > 0 ? (
                        <>
                          <p className="mt-1 font-display text-lg font-semibold text-foreground">
                            {m.expected > 0 ? formatBRL(m.expected) : "a definir"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {m.items.length === 1
                              ? (m.items[0]?.title ?? "1 compromisso")
                              : `${m.items.length} compromissos`}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">nada previsto</p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {warranty.length > 0 && (
              <section className="rounded-3xl border border-border bg-card/70 p-5 shadow-sm">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  Antes que a garantia acabe
                </h2>
                <ul className="mt-3 space-y-2">
                  {warranty.slice(0, 3).map((s) => (
                    <li
                      key={s.assetId}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-background/70 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Coberto até {formatDate(s.coversUntil)} ·{" "}
                          {s.daysLeft === 0 ? "vence hoje" : `faltam ${s.daysLeft} dias`}
                        </p>
                      </div>
                      <Link
                        to="/ativo/$assetId"
                        params={{ assetId: s.assetId }}
                        className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        Ver ficha
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Vale chamar o técnico enquanto cobre —{" "}
                  <Link to="/zelador" className="font-medium text-primary underline-offset-4 hover:underline">
                    pergunte ao zelador
                  </Link>
                  .
                </p>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
