import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarRange,
  Coins,
  Hammer,
  Home,
  PieChart,
  PiggyBank,
} from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { guardSession } from "@/lib/auth-guard";
import { formatBRL } from "@/lib/format";
import {
  costByRoom,
  forecast12Months,
  monthlyAverage,
  ownershipCost,
  reserveSuggestion,
  type MoneyExpense,
} from "@/lib/money";
import { getMoneyState } from "@/lib/queries";
import type { TimelineObligation } from "@/lib/pulse";

export const Route = createFileRoute("/dinheiro")({
  beforeLoad: () => guardSession(),
  component: MoneyPage,
  head: () => ({
    meta: [
      { title: "Dinheiro da casa — Casa Viva" },
      {
        name: "description",
        content:
          "Quanto custa morar aqui: gastos por cômodo, previsão dos próximos 12 meses, reserva sugerida e o custo real de cada objeto.",
      },
      { property: "og:title", content: "Dinheiro da casa — Casa Viva" },
      {
        property: "og:description",
        content:
          "Quanto custa morar aqui: gastos por cômodo, previsão dos próximos 12 meses, reserva sugerida e o custo real de cada objeto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function MoneyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["money-state"],
    queryFn: () => getMoneyState(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <p className="px-4 pt-10 text-sm text-muted-foreground">Contando os dinheiros…</p>
      </div>
    );
  }

  const household = data?.household ?? null;
  const rooms = data?.rooms ?? [];
  const roomNames = new Map(rooms.map((r) => [r.id, r.name]));
  const expenses: MoneyExpense[] = (data?.expenses ?? []).map((e) => ({
    id: e.id,
    amount: e.amount,
    date: e.date,
    room_id: e.room_id,
    room_name: e.room_id ? roomNames.get(e.room_id) ?? null : null,
    asset_name: null,
  }));
  const assets = data?.assets ?? [];
  const assetNames = new Map(assets.map((a) => [a.id, a.name]));
  const assetRoomNames = new Map(
    assets.map((a) => [a.id, a.room_id ? roomNames.get(a.room_id) ?? null : null]),
  );

  const monthly = monthlyAverage(expenses);
  const byRoom = costByRoom(expenses);
  const timelineObligations: TimelineObligation[] = (data?.obligations ?? []).map((o) => ({
    title: o.title,
    amount: o.amount,
    next_due: o.next_due,
    frequency: o.frequency,
    custom_interval_days: o.custom_interval_days,
  }));
  const forecast = forecast12Months(timelineObligations);
  const forecastMonthly = forecast.total / 12;
  const reserve = reserveSuggestion(forecastMonthly, monthly);
  const ownership = assets
    .map((a) => ({
      name: a.name,
      room_name: assetRoomNames.get(a.id) ?? null,
      total: ownershipCost({
        purchase_price: a.purchase_price,
        events: (data?.events ?? []).filter((ev) => ev.asset_id === a.id),
        services: (data?.services ?? []).filter((sv) => sv.asset_id === a.id),
      }),
    }))
    .filter((a) => a.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const projects = data?.projects ?? [];

  if (!household) {
    return (
      <div className="min-h-screen bg-background">
        <AppNav />
        <main id="conteudo" className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Dinheiro da casa
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma casa por aqui ainda — monte a planta para começar a contar.
          </p>
          <Button asChild className="mt-6">
            <Link to="/">
              <ArrowLeft size={16} />
              Voltar para a casa
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppNav />
      <header className="mx-auto max-w-5xl px-4 pt-8">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          Quanto custa morar aqui
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
          Dinheiro
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Gastos reais, previsão honesta dos próximos meses e o custo de ter cada
          objeto — tudo batendo com os registros da casa.
        </p>
      </header>

      <main id="conteudo" className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        {/* Custo real por mês */}
        <section className="rounded-3xl border border-border bg-card/70 p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
            <Coins size={22} className="text-primary" />
            Custo real
          </h2>
          {expenses.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum gasto registrado ainda. Cadastre gastos (ou deixe a captura
              registrar por você) e a média aparece aqui.
            </p>
          ) : (
            <>
              <p className="mt-3 font-display text-5xl font-semibold tracking-tight text-foreground">
                {formatBRL(monthly)}
                <span className="ml-2 text-base font-normal text-muted-foreground">por mês</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Média dos gastos registrados desde o primeiro lançamento (últimos 12 meses).
              </p>
              {byRoom.length > 0 && (
                <div className="mt-5 space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <PieChart size={16} className="text-primary" />
                    Por cômodo
                  </p>
                  {byRoom.map((r) => {
                    const top = byRoom[0]?.total ?? 1;
                    return (
                    <div key={r.room_id ?? "sem-comodo"} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-sm text-foreground">
                        {r.room_name}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{
                            width: `${Math.max(3, (r.total / top) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-sm font-medium text-foreground">
                        {formatBRL(r.total)}
                      </span>
                    </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* Previsão + reserva */}
        <section className="rounded-3xl border border-border bg-card/70 p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
            <CalendarRange size={22} className="text-primary" />
            Previsão dos próximos 12 meses
          </h2>
          {forecast.total === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma obrigação com valor e vencimento ainda — o radar é quem
              alimenta esta previsão.
            </p>
          ) : (
            <>
              <p className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground">
                {formatBRL(forecast.total)}
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  nos próximos 12 meses
                </span>
              </p>
              <div className="mt-5 flex items-end gap-1.5">
                {forecast.months.map((m) => {
                  const max = Math.max(...forecast.months.map((x) => x.expected), 1);
                  return (
                    <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md bg-primary/60"
                        style={{ height: `${Math.max(4, (m.expected / max) * 72)}px` }}
                        title={`${m.label}: ${formatBRL(m.expected)}`}
                      />
                      <span className="text-[10px] text-muted-foreground">{m.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 rounded-2xl border border-tranquilo/40 bg-tranquilo/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-tranquilo">
                  <PiggyBank size={16} />
                  Reserva sugerida: {formatBRL(reserve)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Três meses do custo mensal previsto — o colchão que segura a casa
                  quando um mês ruim chega junto.
                </p>
              </div>
            </>
          )}
        </section>

        {/* Custo de propriedade por ativo */}
        <section className="rounded-3xl border border-border bg-card/70 p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
            <Home size={22} className="text-primary" />
            Custo de ter cada objeto
          </h2>
          {ownership.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Ainda não dá para comparar: cadastre o valor de compra e registre os
              serviços e eventos dos objetos.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {ownership.map((a) => (
                <li key={a.name} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-foreground">
                    <strong>{a.name}</strong>
                    {a.room_name ? ` · ${a.room_name}` : ""}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-foreground">
                    {formatBRL(a.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Projetos */}
        <section className="rounded-3xl border border-border bg-card/70 p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
            <Hammer size={22} className="text-primary" />
            Reformas e projetos
          </h2>
          {projects.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum projeto ainda. Quando a casa ganhar uma reforma, o planejado e
              o realizado aparecem lado a lado aqui.
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {projects.map((p) => {
                const pct =
                  p.budget_planned && p.budget_planned > 0
                    ? Math.round(((p.budget_spent ?? 0) / p.budget_planned) * 100)
                    : null;
                return (
                  <li key={p.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {p.name}
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {formatBRL(p.budget_spent ?? 0)}
                        {p.budget_planned ? ` de ${formatBRL(p.budget_planned)}` : ""}
                      </span>
                    </div>
                    {pct != null && (
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={`h-full rounded-full ${pct > 100 ? "bg-urgente" : "bg-primary/70"}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    )}
                    {pct != null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {pct > 100
                          ? `${pct}% do planejado — passou do orçamento`
                          : `${pct}% do planejado`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
