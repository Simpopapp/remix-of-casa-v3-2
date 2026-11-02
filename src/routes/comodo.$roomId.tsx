import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { Suspense, useState } from "react";

import { AssetForm, CATEGORY_LABEL } from "@/components/asset-form";
import { Button } from "@/components/ui/button";
import { guardSession } from "@/lib/auth-guard";
import { formatDate, formatRelative } from "@/lib/format";
import { getRoomDetail } from "@/lib/queries";
import { computePulse, pulseColor, type PulseLevel } from "@/lib/pulse";

const roomOptions = (roomId: string) =>
  queryOptions({
    queryKey: ["room", roomId],
    queryFn: () => getRoomDetail({ data: { roomId } }),
  });

export const Route = createFileRoute("/comodo/$roomId")({
  beforeLoad: () => guardSession(),
  // No servidor não há token: a busca acontece no navegador, após a hidratação.
  loader: ({ params, context }) =>
    typeof window === "undefined"
      ? undefined
      : context.queryClient.ensureQueryData(roomOptions(params.roomId)),
  component: RoomPage,
  head: () => ({
    meta: [
      { title: "Cômodo — Casa Viva" },
      {
        name: "description",
        content: "O interior de um cômodo da sua casa: inventário, obrigações e pulso.",
      },
      { property: "og:title", content: "Cômodo — Casa Viva" },
      {
        property: "og:description",
        content: "O interior de um cômodo da sua casa: inventário, obrigações e pulso.",
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

function RoomPage() {
  const { roomId } = Route.useParams();
  return (
    <div className="min-h-screen bg-background">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <p className="text-sm text-muted-foreground">Abrindo o cômodo…</p>
          </div>
        }
      >
        <RoomContent roomId={roomId} />
      </Suspense>
    </div>
  );
}

function RoomContent({ roomId }: { roomId: string }) {
  const { data } = useSuspenseQuery(roomOptions(roomId));
  const { room, assets, obligations, documents, rooms } = data;
  const pulse = computePulse({ obligations, assets, documents });
  const [adding, setAdding] = useState(false);

  return (
    <div className="entrada-comodo mx-auto max-w-4xl px-4 pb-16 pt-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={15} />
        Voltar para a planta
      </Link>

      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            {room.kind_area === "externa"
              ? "Área externa"
              : room.kind_area === "garagem"
                ? "Garagem"
                : "Cômodo"}
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
            {room.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus size={14} />
            Registrar objeto
          </Button>
          <div
            className="rounded-2xl border px-4 py-2 text-center"
            style={{
              borderColor: pulseColor(pulse.level),
              backgroundColor: `color-mix(in oklab, ${pulseColor(pulse.level)} 12%, transparent)`,
            }}
          >
            <p className="font-display text-2xl font-semibold leading-none text-foreground">
              {pulse.score}
            </p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Pulso · {LEVEL_LABEL[pulse.level]}
            </p>
          </div>
        </div>
      </header>

      <main className="mt-8 space-y-6">
        {pulse.factors.length > 0 && (
          <section className="rounded-3xl border border-border bg-card/70 p-5">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Por que o pulso está assim
            </h2>
            <ul className="mt-3 space-y-2">
              {pulse.factors.map((f) => (
                <li
                  key={f.label}
                  className="flex items-start justify-between gap-3 rounded-2xl bg-background/70 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{f.label}</p>
                    <p className="text-xs text-muted-foreground">{f.detail}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-urgente/10 px-2 py-0.5 text-xs font-semibold text-urgente-foreground">
                    −{f.points}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-3xl border border-border bg-card/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Inventário
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
              <Plus size={14} />
              Registrar objeto
            </Button>
          </div>
          {assets.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nada registrado neste cômodo ainda. Comece pelo que mais dá trabalho:
              a geladeira, o fogão, o aquecedor.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {assets.map((asset) => (
                <li key={asset.id}>
                  <Link
                    to="/ativo/$assetId"
                    params={{ assetId: asset.id }}
                    className="block rounded-2xl bg-background/70 px-4 py-3 transition-colors hover:bg-secondary"
                  >
                    <p className="text-sm font-medium text-foreground">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABEL[asset.category] ?? asset.category}
                      {asset.brand ? ` · ${asset.brand}` : ""}
                      {asset.model ? ` ${asset.model}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Garantia: {formatRelative(asset.warranty_expires)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card/70 p-5">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Compromissos daqui
          </h2>
          {obligations.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum compromisso ligado a este cômodo.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {obligations.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-background/70 px-4 py-3"
                >
                  <p className="text-sm font-medium text-foreground">{o.title}</p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(o.next_due)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card/70 p-5">
          <h2 className="font-display text-xl font-semibold text-foreground">
            Documentos
          </h2>
          {documents.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum documento guardado aqui.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {documents.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-background/70 px-4 py-3"
                >
                  <p className="text-sm font-medium text-foreground">{d.title}</p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {d.expires_at ? `Vence ${formatRelative(d.expires_at)}` : "Sem validade"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <AssetForm
        open={adding}
        onOpenChange={setAdding}
        householdId={room.household_id}
        rooms={rooms}
        defaultRoomId={room.id}
      />
    </div>
  );
}
