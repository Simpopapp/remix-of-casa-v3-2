import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { AppNav } from "@/components/app-nav";
import { AssetForm, CATEGORY_LABEL } from "@/components/asset-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { guardSession } from "@/lib/auth-guard";
import { formatBRL, formatDate, formatRelative, parseAmount } from "@/lib/format";
import { assetLife, WARRANTY_LABEL, warrantyState } from "@/lib/inventory";
import { getAssetDetail } from "@/lib/queries";
import { addAssetEvent, deleteAsset } from "@/lib/writes";

const assetOptions = (assetId: string) =>
  queryOptions({
    queryKey: ["asset", assetId],
    queryFn: () => getAssetDetail({ data: { assetId } }),
  });

export const Route = createFileRoute("/ativo/$assetId")({
  beforeLoad: () => guardSession(),
  // No servidor não há token: a busca acontece no navegador, após a hidratação.
  loader: ({ params, context }) =>
    typeof window === "undefined"
      ? undefined
      : context.queryClient.ensureQueryData(assetOptions(params.assetId)),
  component: AssetPage,
  head: () => ({
    meta: [
      { title: "Ficha do objeto — Casa Viva" },
      {
        name: "description",
        content:
          "A ficha viva de um objeto da casa: garantia, vida útil, histórico de cuidados e comprovantes.",
      },
      { property: "og:title", content: "Ficha do objeto — Casa Viva" },
      {
        property: "og:description",
        content:
          "A ficha viva de um objeto da casa: garantia, vida útil, histórico de cuidados e comprovantes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const EVENT_KINDS = [
  { value: "manutencao", label: "Manutenção" },
  { value: "reparo", label: "Reparo" },
  { value: "substituicao", label: "Substituição" },
  { value: "observacao", label: "Observação" },
];

const KIND_LABEL: Record<string, string> = Object.fromEntries(
  EVENT_KINDS.map((k) => [k.value, k.label]),
);

const WARRANTY_CHIP: Record<string, string> = {
  sem_garantia: "border-border bg-secondary text-secondary-foreground",
  valida: "border-tranquilo/40 bg-tranquilo/15 text-tranquilo-foreground",
  vencendo: "border-atencao/40 bg-atencao/15 text-atencao-foreground",
  vencida: "border-urgente/40 bg-urgente/15 text-urgente-foreground",
};

function AssetPage() {
  const { assetId } = Route.useParams();
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <p className="text-sm text-muted-foreground">Abrindo a ficha…</p>
          </div>
        }
      >
        <div className="mx-auto max-w-4xl px-4 pb-16 pt-6">
          <AssetContent assetId={assetId} />
        </div>
      </Suspense>
    </div>
  );
}

function AssetContent({ assetId }: { assetId: string }) {
  const { data } = useSuspenseQuery(assetOptions(assetId));
  const { asset, room, events, services, documents, photo_src, rooms, providers } = data;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState(false);
  const [busy, setBusy] = useState(false);

  const warranty = warrantyState(asset);
  const life = assetLife(asset, events);
  const usedPct =
    asset.useful_life_months && life.ageMonths != null
      ? Math.min(100, Math.round((life.ageMonths / asset.useful_life_months) * 100))
      : null;

  async function remove() {
    setBusy(true);
    try {
      await deleteAsset({ data: { assetId } });
      await queryClient.invalidateQueries();
      toast.success("Objeto removido da casa");
      await navigate({ to: room ? "/comodo/$roomId" : "/", params: room ? { roomId: room.id } : {} });
    } catch (error) {
      toast.error("Não foi possível remover", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link
        to={room ? "/comodo/$roomId" : "/"}
        params={room ? { roomId: room.id } : {}}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={15} />
        {room ? `Voltar para ${room.name}` : "Voltar para a planta"}
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            {CATEGORY_LABEL[asset.category] ?? "Objeto"}
            {room ? ` · ${room.name}` : ""}
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
            {asset.name}
          </h1>
          {asset.brand || asset.model ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {[asset.brand, asset.model].filter(Boolean).join(" ")}
              {asset.serial ? ` · série ${asset.serial}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${WARRANTY_CHIP[warranty.state]}`}
          >
            {WARRANTY_LABEL[warranty.state]}
            {warranty.ref && warranty.state !== "sem_garantia"
              ? ` · ${formatRelative(warranty.ref)}`
              : ""}
          </span>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={14} />
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => void remove()}
            disabled={busy}
          >
            <Trash2 size={14} />
            Remover
          </Button>
        </div>
      </header>

      <main id="conteudo" className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-border bg-card/70 p-5">
            <h2 className="font-display text-xl font-semibold text-foreground">
              A vida desse objeto
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Stat label="Compra" value={asset.purchase_date ? formatDate(asset.purchase_date) : "—"} />
              <Stat label="Pagou" value={formatBRL(asset.purchase_price)} />
              <Stat label="Já custou cuidar" value={formatBRL(life.spentOnCare)} />
              <Stat
                label="Tempo de vida que resta"
                value={
                  life.remainingMonths != null
                    ? `${life.remainingMonths} meses`
                    : "Sem estimativa"
                }
              />
            </div>

            {usedPct != null && (
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Vida útil consumida</span>
                  <span>{usedPct}%</span>
                </div>
                <Progress value={usedPct} className="mt-2" />
              </div>
            )}

            {life.worthReplacing && (
              <p className="mt-4 rounded-2xl bg-atencao/15 px-4 py-3 text-sm text-atencao-foreground">
                O cuidado já custou {Math.round((life.careVsNew ?? 0) * 100)}% do que um
                novo. Vale conversar sobre trocar — com calma, antes de quebrar.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-foreground">
                O que aconteceu com ele
              </h2>
              <Button size="sm" variant="outline" onClick={() => setLogging(true)}>
                <Plus size={14} />
                Registrar
              </Button>
            </div>

            {events.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nada registrado ainda. Uma linha hoje evita uma dúvida daqui a dois anos.
              </p>
            ) : (
              <ul className="mt-4 space-y-3 border-l border-border pl-4">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span
                      aria-hidden
                      className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary"
                    />
                    <p className="text-sm font-medium text-foreground">
                      {KIND_LABEL[e.kind] ?? e.kind}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {formatDate(e.date)}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">{e.description}</p>
                    {(e.cost != null || e.provider_name) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {e.cost != null ? formatBRL(e.cost) : ""}
                        {e.cost != null && e.provider_name ? " · " : ""}
                        {e.provider_name ?? ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-border bg-card/70">
            {photo_src ? (
              <img
                src={photo_src}
                alt={asset.name}
                className="h-56 w-full object-cover"
              />
            ) : (
              <div className="flex h-40 items-center justify-center bg-secondary/60 text-sm text-muted-foreground">
                Sem foto — edite a ficha para guardar uma
              </div>
            )}
            {asset.notes ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">{asset.notes}</p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-border bg-card/70 p-5">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Quem já mexeu nele
            </h2>
            {services.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhum serviço registrado neste objeto.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {services.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-2xl bg-background/70 px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {s.description}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {formatDate(s.date)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.provider_name ?? "Prestador não informado"}
                      {s.cost != null ? ` · ${formatBRL(s.cost)}` : ""}
                      {s.rating != null ? ` · nota ${s.rating}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card/70 p-5">
            <h2 className="font-display text-xl font-semibold text-foreground">
              Comprovantes
            </h2>
            {documents.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nada guardado no cofre ligado a este objeto.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {documents.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-background/70 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-foreground">{d.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {d.expires_at ? `Vence ${formatRelative(d.expires_at)}` : "Sem validade"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/documentos"
              className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
            >
              Abrir o cofre
            </Link>
          </div>
        </section>
      </main>

      <AssetForm
        open={editing}
        onOpenChange={setEditing}
        householdId={asset.household_id}
        rooms={rooms}
        defaultRoomId={asset.room_id}
        asset={asset}
      />

      <EventDialog
        open={logging}
        onOpenChange={setLogging}
        assetId={asset.id}
        providers={providers.map((p) => ({ id: p.id, name: p.name }))}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background/70 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EventDialog({
  open,
  onOpenChange,
  assetId,
  providers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  providers: Array<{ id: string; name: string }>;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("manutencao");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState<string>("");
  const [providerId, setProviderId] = useState("none");

  async function submit() {
    if (!description.trim()) {
      toast.error("Conte o que aconteceu com o objeto.");
      return;
    }
    setBusy(true);
    try {
      await addAssetEvent({
        data: {
          asset_id: assetId,
          kind,
          date,
          description,
          cost: parseAmount(cost),
          provider_id: providerId === "none" ? null : providerId,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Anotado na ficha");
      setDescription("");
      setCost("");
      onOpenChange(false);
    } catch (error) {
      toast.error("Não foi possível anotar", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">O que aconteceu?</DialogTitle>
          <DialogDescription>
            Uma linha agora é o que salva a memória da casa depois.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Que tipo de registro</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-date">Quando</Label>
            <Input
              id="event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="event-description">O que foi feito</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Trocamos o filtro e limpamos as bobinas"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-cost">Quanto custou</Label>
            <Input
              id="event-cost"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="Ex.: 180"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Quem fez</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger>
                <SelectValue placeholder="Ninguém ainda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguém ainda</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Deixar para depois
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Um instante…" : "Anotar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
