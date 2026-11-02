import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Armchair,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bath,
  BedDouble,
  Car,
  Check,
  CookingPot,
  Laptop,
  Package,
  Shirt,
  Sprout,
  Sun,
  Trash2,
  WashingMachine,
  type LucideIcon,
} from "lucide-react";

import { guardSession } from "@/lib/auth-guard";
import {
  GRID_H,
  GRID_W,
  ROOM_TEMPLATES,
  canPlace,
  type RoomPlacement,
  type RoomTemplate,
} from "@/lib/plant";
import { getHomeState } from "@/lib/queries";
import { createHousehold, saveRooms } from "@/lib/writes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: () => guardSession(),
  component: Onboarding,
  head: () => ({
    meta: [
      { title: "Montar sua casa — Casa Viva" },
      {
        name: "description",
        content: "Monte a planta da sua casa: escolha os cômodos e arrume-os como quiser.",
      },
      { property: "og:title", content: "Montar sua casa — Casa Viva" },
      {
        property: "og:description",
        content: "Monte a planta da sua casa: escolha os cômodos e arrume-os como quiser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const KINDS = [
  { value: "casa", label: "Casa" },
  { value: "apartamento", label: "Apartamento" },
  { value: "sitio", label: "Sítio" },
  { value: "praia", label: "Casa de praia" },
  { value: "alugado", label: "Imóvel alugado" },
  { value: "outro", label: "Outro" },
] as const;

const ROOM_ICONS: Record<string, LucideIcon> = {
  sala: Armchair,
  cozinha: CookingPot,
  quarto: BedDouble,
  banheiro: Bath,
  lavanderia: WashingMachine,
  escritorio: Laptop,
  closet: Shirt,
  despensa: Package,
  garagem: Car,
  varanda: Sun,
  quintal: Sprout,
};

const AREA_LABEL: Record<string, string> = {
  interna: "Interna",
  externa: "Externa",
  garagem: "Garagem",
};

const CELL = 40;

function Onboarding() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["home-state"],
    queryFn: () => getHomeState(),
    staleTime: 30_000,
  });

  const needsHousehold = !data?.household;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("casa");
  const [placed, setPlaced] = useState<RoomPlacement[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [template, setTemplate] = useState<RoomTemplate>(
    ROOM_TEMPLATES[0] as RoomTemplate,
  );
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const householdReady = !needsHousehold || name.trim().length > 0;

  function place(cx: number, cy: number) {
    const candidate = { x: cx, y: cy, w: template.w, h: template.h };
    if (!canPlace(candidate, placed)) {
      setHint("Aí não cabe — escolha outro canto da grade.");
      return;
    }
    setHint(null);
    setSelected(placed.length);
    setPlaced([
      ...placed,
      { ...candidate, name: template.label, kind: template.kind, kind_area: template.area },
    ]);
  }

  function moveSelected(dx: number, dy: number) {
    if (selected == null) return;
    const room = placed[selected];
    if (!room) return;
    const candidate: RoomPlacement = { ...room, x: room.x + dx, y: room.y + dy };
    if (!canPlace(candidate, placed, selected)) {
      setHint("Não dá para mover para lá.");
      return;
    }
    setHint(null);
    setPlaced(placed.map((r, i) => (i === selected ? candidate : r)));
  }

  function removeSelected() {
    if (selected == null) return;
    setPlaced(placed.filter((_, i) => i !== selected));
    setSelected(null);
  }

  function renameSelected(value: string) {
    if (selected == null) return;
    setPlaced(placed.map((r, i) => (i === selected ? { ...r, name: value } : r)));
  }

  async function submit() {
    setBusy(true);
    try {
      let householdId = data?.household?.id;
      if (!householdId) {
        const household = await createHousehold({ data: { name: name.trim(), kind } });
        householdId = household.id;
      }
      await saveRooms({
        data: {
          household_id: householdId,
          rooms: placed.map((p) => ({
            name: p.name,
            kind: p.kind,
            kind_area: p.kind_area,
            layout: { x: p.x, y: p.y, w: p.w, h: p.h },
          })),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["home-state"] });
      toast.success("A planta está de pé", {
        description: `${placed.length} cômodo(s) prontos para receber a vida da casa.`,
      });
      await navigate({ to: "/" });
    } catch (error) {
      toast.error("Não foi possível montar a casa", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            {needsHousehold ? "Primeiro passo" : "Sua planta"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground">
            {needsHousehold ? "Todo lar começa com um nome" : "Monte a planta da casa"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {needsHousehold
              ? "Dê identidade à sua casa e depois arrume os cômodos, como quem brinca de construção."
              : "Escolha um cômodo ao lado e clique na grade para colocá-lo. Depois ajuste como quiser."}
          </p>
        </header>

        {needsHousehold && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="mb-6 rounded-3xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="household-name">Nome do lar</Label>
                <Input
                  id="household-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Casa do Alecrim"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Que lar é esse?</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setKind(k.value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                        kind === k.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </form>
        )}

        <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap gap-2">
            {ROOM_TEMPLATES.map((t) => {
              const Icon = ROOM_ICONS[t.kind] ?? Package;
              return (
                <button
                  key={t.kind}
                  type="button"
                  onClick={() => setTemplate(t)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
                    template.kind === t.kind
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <Icon size={15} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 overflow-x-auto pb-2">
            <div
              className="relative mx-auto rounded-2xl border border-border bg-background/60"
              style={{ width: GRID_W * CELL, height: GRID_H * CELL }}
            >
              {/* Grade clicável */}
              <div
                className="absolute inset-0 grid"
                style={{
                  gridTemplateColumns: `repeat(${GRID_W}, ${CELL}px)`,
                  gridTemplateRows: `repeat(${GRID_H}, ${CELL}px)`,
                }}
              >
                {Array.from({ length: GRID_W * GRID_H }, (_, i) => {
                  const cx = i % GRID_W;
                  const cy = Math.floor(i / GRID_W);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Colocar ${template.label} na linha ${cy + 1}, coluna ${cx + 1}`}
                      onClick={() => place(cx, cy)}
                      className="border border-border/50 transition-colors hover:bg-primary/10"
                    />
                  );
                })}
              </div>

              {/* Cômodos posicionados */}
              {placed.map((r, i) => {
                const Icon = ROOM_ICONS[r.kind] ?? Package;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(i)}
                    className={`absolute z-10 flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-center transition-colors ${
                      selected === i
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-primary/30 bg-card text-foreground hover:border-primary/60"
                    }`}
                    style={{
                      left: r.x * CELL,
                      top: r.y * CELL,
                      width: r.w * CELL,
                      height: r.h * CELL,
                    }}
                  >
                    <Icon size={16} />
                    <span className="max-w-full truncate px-1 text-[11px] font-semibold">
                      {r.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {hint && (
            <p className="mt-2 text-center text-sm font-medium text-urgente-foreground">
              {hint}
            </p>
          )}

          {selected != null && placed[selected] != null && (
            <div className="mt-4 rounded-2xl border border-border bg-background/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={placed[selected]!.name}
                  onChange={(e) => renameSelected(e.target.value)}
                  className="max-w-52"
                  aria-label="Nome do cômodo"
                />
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                  {AREA_LABEL[placed[selected]!.kind_area] ?? "Cômodo"}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Mover para a esquerda"
                    onClick={() => moveSelected(-1, 0)}
                  >
                    <ArrowLeft size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Mover para cima"
                    onClick={() => moveSelected(0, -1)}
                  >
                    <ArrowUp size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Mover para baixo"
                    onClick={() => moveSelected(0, 1)}
                  >
                    <ArrowDown size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Mover para a direita"
                    onClick={() => moveSelected(1, 0)}
                  >
                    <ArrowRight size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Remover cômodo"
                    onClick={removeSelected}
                    className="text-destructive"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {placed.length === 0
                ? "Nenhum cômodo ainda — clique na grade para começar."
                : `${placed.length} cômodo(s) na planta.`}
            </p>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !householdReady || placed.length === 0}
            >
              <Check size={16} />
              {busy ? "Um instante…" : "Concluir a planta"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
