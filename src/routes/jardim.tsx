import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Droplets, Plus, Sprout, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppNav } from "@/components/app-nav";
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
import { guardSession } from "@/lib/auth-guard";
import { formatDate } from "@/lib/format";
import { sortByWatering, todayISO, type WateringStatus } from "@/lib/layers";
import { getGardenPage } from "@/lib/queries";
import { createPlant, deletePlant, updatePlant, waterPlant, type PlantInput } from "@/lib/writes";
import type { GardenState, Plant } from "@/lib/types";

export const Route = createFileRoute("/jardim")({
  beforeLoad: () => guardSession(),
  component: GardenPage,
  head: () => ({
    meta: [
      { title: "Jardim — Casa Viva" },
      {
        name: "description",
        content:
          "Rega, poda e adubação por planta: a casa avisa quando é hora de molhar cada uma.",
      },
      { property: "og:title", content: "Jardim — Casa Viva" },
      {
        property: "og:description",
        content:
          "Rega, poda e adubação por planta: a casa avisa quando é hora de molhar cada uma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const WATER_CHIP: Record<WateringStatus, string> = {
  atrasada: "border-urgente/40 bg-urgente/15 text-urgente-foreground",
  logo: "border-atencao/40 bg-atencao/15 text-atencao-foreground",
  em_dia: "border-tranquilo/40 bg-tranquilo/15 text-tranquilo-foreground",
  sem_horario: "border-border bg-secondary text-secondary-foreground",
};

const WATER_LABEL: Record<WateringStatus, string> = {
  atrasada: "Precisa de água",
  logo: "Vai precisar logo",
  em_dia: "Regada em dia",
  sem_horario: "Sem horário fixo",
};

function GardenPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["garden"],
    queryFn: () => getGardenPage(),
    staleTime: 30_000,
  });

  const [editing, setEditing] = useState<Plant | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const household = data?.household ?? null;
  const rows = sortByWatering(data?.plants ?? []);
  const atrasadas = rows.filter((r) => r.watering.status === "atrasada").length;

  async function water(plant: Plant) {
    setBusyId(plant.id);
    try {
      const day = todayISO();
      await waterPlant({ data: { plantId: plant.id, day } });
      await queryClient.invalidateQueries();
      toast.success("Anotado: regada hoje");
    } catch (error) {
      toast.error("Não foi possível anotar", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(plant: Plant) {
    setBusyId(plant.id);
    try {
      await deletePlant({ data: { plantId: plant.id } });
      await queryClient.invalidateQueries();
      toast.success("Planta tirada do jardim");
    } catch (error) {
      toast.error("Não foi possível remover", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppNav />
      <header className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3 px-4 pt-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            O que vive fora das paredes
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
            Jardim
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Cada planta com seu ritmo de rega. A casa conta a partir da última vez
            que você molhou e avisa quando chega a hora.
          </p>
        </div>
        <Button onClick={() => setEditing("new")} disabled={!household}>
          <Plus size={16} />
          Nova planta
        </Button>
      </header>

      {atrasadas > 0 && (
        <div className="mx-auto mt-5 max-w-5xl px-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-urgente/40 bg-urgente/10 px-4 py-2 text-sm text-urgente-foreground">
            <strong>{atrasadas}</strong> {atrasadas === 1 ? "planta esperando água" : "plantas esperando água"}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Vendo o jardim…</p>
        ) : !household ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma casa por aqui ainda — monte a planta para começar.
          </p>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <Sprout className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
              O jardim está vazio
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Nome e de quantos em quantos dias regar já bastam. A casa cuida do resto.
            </p>
            <Button className="mt-5" onClick={() => setEditing("new")}>
              <Plus size={16} />
              Plantar a primeira
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {rows.map(({ plant, watering }) => (
              <li key={plant.id} className="rounded-3xl border border-border bg-card/70 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-semibold text-foreground">
                      {plant.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {plant.location ?? "Sem lugar registrado"}
                      {plant.watering_interval_days
                        ? ` · a cada ${plant.watering_interval_days} ${plant.watering_interval_days === 1 ? "dia" : "dias"}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${WATER_CHIP[watering.status]}`}
                  >
                    {WATER_LABEL[watering.status]}
                  </span>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {watering.next
                    ? `Próxima rega em ${formatDate(watering.next)}`
                    : "Diga de quantos em quantos dias regar para a casa avisar"}
                  {plant.last_watered ? ` · última em ${formatDate(plant.last_watered)}` : ""}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busyId === plant.id}
                    onClick={() => void water(plant)}
                  >
                    <Droplets size={14} />
                    Regar hoje
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(plant)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={busyId === plant.id}
                    onClick={() => void remove(plant)}
                  >
                    <Trash2 size={14} />
                    Remover
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <PlantDialog
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(null)}
        householdId={household?.id ?? ""}
        initial={editing && editing !== "new" ? editing : null}
      />
    </div>
  );
}

function PlantDialog({
  open,
  onOpenChange,
  householdId,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  initial: Plant | null;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<PlantInput>(() => blank(householdId));
  const [seeded, setSeeded] = useState<string | null>(null);

  const seedKey = initial?.id ?? "new";
  if (open && seeded !== seedKey) {
    setSeeded(seedKey);
    setForm(
      initial
        ? {
            household_id: householdId,
            name: initial.name,
            location: initial.location,
            watering_interval_days: initial.watering_interval_days,
            last_watered: initial.last_watered,
          }
        : blank(householdId),
    );
  }
  if (!open && seeded !== null) setSeeded(null);

  async function submit() {
    if (!householdId) {
      toast.error("Monte a casa primeiro.");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Dê um nome à planta.");
      return;
    }
    setBusy(true);
    try {
      if (initial) {
        await updatePlant({
          data: { ...form, plantId: initial.id, household_id: householdId },
        });
        toast.success("Planta atualizada");
      } else {
        await createPlant({ data: { ...form, household_id: householdId } });
        toast.success("Planta no jardim");
      }
      await queryClient.invalidateQueries();
      onOpenChange(false);
    } catch (error) {
      toast.error("Não foi possível guardar", {
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
          <DialogTitle className="font-display text-2xl">
            {initial ? "Editar planta" : "Nova planta"}
          </DialogTitle>
          <DialogDescription>
            Diga o nome e de quantos em quantos dias regar. O resto a casa calcula.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="plant-name">Nome</Label>
            <Input
              id="plant-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Samambaia da varanda"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plant-location">Onde mora</Label>
            <Input
              id="plant-location"
              value={form.location ?? ""}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Ex.: Varanda, quintal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plant-interval">Regar a cada (dias)</Label>
            <Input
              id="plant-interval"
              inputMode="numeric"
              value={form.watering_interval_days ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  watering_interval_days: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="Ex.: 3"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="plant-last">Última rega</Label>
            <Input
              id="plant-last"
              type="date"
              value={form.last_watered ?? ""}
              onChange={(e) => setForm({ ...form, last_watered: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Deixar para depois
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Um instante…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function blank(householdId: string): PlantInput {
  return {
    household_id: householdId,
    name: "",
    location: "",
    watering_interval_days: null,
    last_watered: "",
  };
}
