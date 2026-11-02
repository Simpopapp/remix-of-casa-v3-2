import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Package,
  Printer,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { guardSession } from "@/lib/auth-guard";
import { formatBRL, formatDate, formatMonthYear } from "@/lib/format";
import {
  buildClaimPackage,
  buildDossier,
  buildMovingChecklist,
  buildYearReview,
  movingProgress,
} from "@/lib/moments";
import { getMomentsState } from "@/lib/queries";
import type { MomentsState } from "@/lib/types";

export const Route = createFileRoute("/momentos")({
  beforeLoad: () => guardSession(),
  component: MomentsPage,
  head: () => ({
    meta: [
      { title: "Momentos de virada — Casa Viva" },
      {
        name: "description",
        content:
          "Mudança, venda, sinistro ou fim de ano: a casa inteira vira checklist, dossiê, pacote de comprovantes e retrospectiva.",
      },
      { property: "og:title", content: "Momentos de virada — Casa Viva" },
      {
        property: "og:description",
        content:
          "Mudança, venda, sinistro ou fim de ano: a casa inteira vira checklist, dossiê, pacote de comprovantes e retrospectiva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function MomentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["moments"],
    queryFn: () => getMomentsState(),
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppNav />
      <header className="mx-auto max-w-5xl px-4 pt-8">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          Quando a vida muda, a casa acompanha
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
          Momentos de virada
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Mudar de casa, vender o imóvel, acionar o seguro ou fechar o ano: tudo
          que a casa já sabe vira o que você precisa na hora.
        </p>
      </header>

      <main id="conteudo" className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Reunindo a casa inteira…</p>
        ) : !data?.household ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma casa por aqui ainda — monte a planta para começar.
          </p>
        ) : (
          <Tabs defaultValue="mudanca">
            <TabsList className="flex h-auto flex-wrap justify-start gap-1 rounded-full bg-secondary/60 p-1">
              <TabsTrigger value="mudanca" className="rounded-full">
                <Package size={15} /> Mudança
              </TabsTrigger>
              <TabsTrigger value="dossie" className="rounded-full">
                <FileText size={15} /> Dossiê
              </TabsTrigger>
              <TabsTrigger value="sinistro" className="rounded-full">
                <ShieldCheck size={15} /> Sinistro
              </TabsTrigger>
              <TabsTrigger value="retrospectiva" className="rounded-full">
                <Sparkles size={15} /> Retrospectiva
              </TabsTrigger>
            </TabsList>
            <TabsContent value="mudanca">
              <MovingMoment state={data} />
            </TabsContent>
            <TabsContent value="dossie">
              <DossierMoment state={data} />
            </TabsContent>
            <TabsContent value="sinistro">
              <ClaimMoment state={data} />
            </TabsContent>
            <TabsContent value="retrospectiva">
              <YearReviewMoment state={data} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

// ─── Mudança ───────────────────────────────────────────────────────────────

/** O checklist é da mudança, não da casa: fica guardado neste aparelho. */
function MovingMoment({ state }: { state: MomentsState }) {
  const checklist = useMemo(
    () => buildMovingChecklist(state.rooms, state.assets),
    [state.rooms, state.assets],
  );
  const storageKey = `casa-viva:mudanca:${state.household?.id ?? "sem-casa"}`;
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch {
      // Sem memória local, a mudança recomeça zerada — sem drama.
    }
  }, [storageKey]);

  function toggle(itemId: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Se não der para guardar, o checklist ainda funciona na tela.
      }
      return next;
    });
  }

  const progress = movingProgress(checklist, done);

  if (progress.total === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        A casa ainda não tem objetos cadastrados — quando tiver, cada cômodo vira
        um grupo de caixas aqui.
      </p>
    );
  }

  return (
    <section className="mt-6">
      <div className="rounded-3xl border border-border bg-card/60 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-foreground">
            {progress.done} de {progress.total} itens embalados
          </h2>
          <p className="text-sm font-medium text-primary">{progress.pct}%</p>
        </div>
        <div className="mt-3 h-2 rounded-full bg-secondary">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
      </div>

      <ul className="mt-4 grid gap-3">
        {checklist.map((room) => (
          <li
            key={room.room_id}
            className="rounded-3xl border border-border bg-card/60 p-5"
          >
            <h3 className="font-display text-lg font-semibold text-foreground">
              {room.room_name}
            </h3>
            {room.items.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum objeto cadastrado — lembre do que desmontar e limpar.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {room.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`move-${item.id}`}
                      checked={done.has(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                    />
                    <label
                      htmlFor={`move-${item.id}`}
                      className={`text-sm ${
                        done.has(item.id)
                          ? "text-muted-foreground line-through"
                          : "text-foreground"
                      }`}
                    >
                      {item.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Dossiê do imóvel ──────────────────────────────────────────────────────

function DossierMoment({ state }: { state: MomentsState }) {
  const dossier = useMemo(
    () => buildDossier(state.rooms, state.assets, state.events, state.documents),
    [state.rooms, state.assets, state.events, state.documents],
  );

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-lg text-sm text-muted-foreground">
          A história completa do imóvel para vender, alugar ou herdar:{" "}
          {dossier.totalAssets} {dossier.totalAssets === 1 ? "objeto" : "objetos"} e{" "}
          {dossier.totalMaintenances}{" "}
          {dossier.totalMaintenances === 1 ? "manutenção registrada" : "manutenções registradas"}.
        </p>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => window.print()}
        >
          <Printer size={16} />
          Imprimir ou salvar em PDF
        </Button>
      </div>

      <ul className="mt-4 grid gap-3">
        {dossier.sections.map((section) => (
          <li
            key={section.room_name}
            className="rounded-3xl border border-border bg-card/60 p-5"
          >
            <h3 className="font-display text-lg font-semibold text-foreground">
              {section.room_name}
            </h3>
            <ul className="mt-3 divide-y divide-border">
              {section.assets.map((a) => (
                <li
                  key={a.name}
                  className="flex flex-wrap items-baseline justify-between gap-2 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.category}
                      {a.purchase_date ? ` · comprado em ${formatDate(a.purchase_date)}` : ""}
                      {a.maintenances > 0
                        ? ` · ${a.maintenances} ${a.maintenances === 1 ? "manutenção" : "manutenções"}`
                        : ""}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {a.purchase_price != null ? formatBRL(a.purchase_price) : "sem valor"}
                    {a.warranty_expires
                      ? ` · garantia até ${formatDate(a.warranty_expires)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {dossier.houseDocuments.length > 0 && (
        <div className="mt-4 rounded-3xl border border-border bg-card/60 p-5">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Documentos da casa
          </h3>
          <ul className="mt-3 divide-y divide-border">
            {dossier.houseDocuments.map((d) => (
              <li
                key={d.title}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <p className="text-sm font-medium text-foreground">{d.title}</p>
                <p className="text-xs text-muted-foreground">
                  {d.category}
                  {d.expires_at ? ` · válido até ${formatDate(d.expires_at)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ─── Sinistro ──────────────────────────────────────────────────────────────

function ClaimMoment({ state }: { state: MomentsState }) {
  const pkg = useMemo(
    () => buildClaimPackage(state.assets, state.rooms, state.documents),
    [state.assets, state.rooms, state.documents],
  );

  async function copySummary() {
    const lines = [
      `Pacote de sinistro — ${state.household?.name ?? "Casa"}`,
      `Total com valor registrado: ${formatBRL(pkg.totalValue)}`,
      "",
      ...pkg.items.map(
        (i) =>
          `• ${i.name}${i.room_name ? ` (${i.room_name})` : ""} — ${formatBRL(i.purchase_price)}` +
          `${i.purchase_date ? `, comprado em ${formatDate(i.purchase_date)}` : ""}` +
          ` — ${i.proofs} ${i.proofs === 1 ? "comprovante" : "comprovantes"}`,
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Resumo copiado", {
        description: "Cole no e-mail ou no aplicativo da seguradora.",
      });
    } catch {
      toast.error("Não foi possível copiar", {
        description: "Selecione o texto e copie manualmente.",
      });
    }
  }

  if (pkg.items.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        Nenhum objeto com valor de compra registrado ainda. Na hora do sinistro,
        é esse valor que prova o que a casa tinha.
      </p>
    );
  }

  return (
    <section className="mt-6">
      <div className="rounded-3xl border border-border bg-card/60 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-foreground">
            {formatBRL(pkg.totalValue)} em bens com valor registrado
          </h2>
          <Button variant="outline" className="rounded-full" onClick={() => void copySummary()}>
            <FileText size={16} />
            Copiar resumo
          </Button>
        </div>
        {pkg.withoutProof > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {pkg.withoutProof} {pkg.withoutProof === 1 ? "item está" : "itens estão"} sem
            comprovante ligado — vale fotografar a nota fiscal e guardar no cofre.
          </p>
        )}
      </div>

      <ul className="mt-4 grid gap-3">
        {pkg.items.map((item) => (
          <li
            key={item.name}
            className="flex flex-wrap items-baseline justify-between gap-2 rounded-3xl border border-border bg-card/60 p-4"
          >
            <div>
              <p className="font-medium text-foreground">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.room_name ?? "Sem cômodo"}
                {item.purchase_date ? ` · ${formatDate(item.purchase_date)}` : ""}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatBRL(item.purchase_price)} ·{" "}
              {item.proofs === 0
                ? "sem comprovante"
                : `${item.proofs} ${item.proofs === 1 ? "comprovante" : "comprovantes"}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Retrospectiva anual ───────────────────────────────────────────────────

function YearReviewMoment({ state }: { state: MomentsState }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const review = useMemo(
    () => buildYearReview(year, state.expenses, state.events, state.services),
    [year, state.expenses, state.events, state.services],
  );
  const maxMonth = Math.max(...review.months.map((m) => m.total), 1);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
          <Button
            key={y}
            variant={y === year ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setYear(y)}
          >
            {y}
          </Button>
        ))}
      </div>

      {review.totalSpent === 0 && review.maintenances === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {year} ainda não tem história registrada — os gastos e cuidados do ano
          aparecem aqui.
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-border bg-card/60 p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                A casa pediu
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">
                {formatBRL(review.totalSpent)}
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-card/60 p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Cuidados feitos
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">
                {review.maintenances + review.services}
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-card/60 p-5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Mês mais pesado
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-foreground">
                {review.heaviestMonth
                  ? formatMonthYear(`${review.heaviestMonth.month}-01`)
                  : "—"}
              </p>
            </div>
          </div>

          <ul className="mt-4 grid gap-2">
            {review.months.map((m) => (
              <li
                key={m.month}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3"
              >
                <p className="w-28 shrink-0 text-sm font-medium text-foreground">
                  {formatMonthYear(`${m.month}-01`)}
                </p>
                <div className="h-2 flex-1 rounded-full bg-secondary">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (m.total / maxMonth) * 100)}%` }}
                  />
                </div>
                <p className="w-24 shrink-0 text-right text-sm text-muted-foreground">
                  {formatBRL(m.total)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
