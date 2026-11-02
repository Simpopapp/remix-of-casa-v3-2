import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, FileText, Plus, Trash2 } from "lucide-react";
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
import { formatDate, formatRelative } from "@/lib/format";
import { getVehiclesPage } from "@/lib/queries";
import { createVehicle, deleteVehicle, updateVehicle, type VehicleInput } from "@/lib/writes";
import type { VehicleRow } from "@/lib/types";

export const Route = createFileRoute("/veiculos")({
  beforeLoad: () => guardSession(),
  component: VehiclesPage,
  head: () => ({
    meta: [
      { title: "Veículos — Casa Viva" },
      {
        name: "description",
        content:
          "A garagem da casa: cada veículo com ficha, revisão, IPVA, seguro e os papéis que comprovam.",
      },
      { property: "og:title", content: "Veículos — Casa Viva" },
      {
        property: "og:description",
        content:
          "A garagem da casa: cada veículo com ficha, revisão, IPVA, seguro e os papéis que comprovam.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/** O próximo vencimento do veículo: a obrigação que chega antes. */
function nextDue(row: VehicleRow): string | null {
  const dates = row.obligations
    .map((o) => o.next_due)
    .filter((d): d is string => Boolean(d))
    .sort();
  return dates[0] ?? null;
}

function VehiclesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: () => getVehiclesPage(),
    staleTime: 30_000,
  });

  const [editing, setEditing] = useState<VehicleRow | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const household = data?.household ?? null;
  const vehicles = data?.vehicles ?? [];

  async function remove(row: VehicleRow) {
    setBusyId(row.vehicle.id);
    try {
      await deleteVehicle({ data: { vehicleId: row.vehicle.id } });
      await queryClient.invalidateQueries();
      toast.success("Veículo tirado da garagem", {
        description: "As obrigações e os papéis continuam na casa, sem dono.",
      });
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
            O que vive na garagem
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
            Veículos
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Revisão, IPVA e seguro de cada carro — com a ficha e os papéis do veículo
            no mesmo radar do resto da casa.
          </p>
        </div>
        <Button onClick={() => setEditing("new")} disabled={!household}>
          <Plus size={16} />
          Novo veículo
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Abrindo a garagem…</p>
        ) : !household ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma casa por aqui ainda — monte a planta para começar.
          </p>
        ) : vehicles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <Car className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
              A garagem está vazia
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Nome e placa já bastam para começar. O resto — revisão, IPVA, apólice —
              entra com o tempo.
            </p>
            <Button className="mt-5" onClick={() => setEditing("new")}>
              <Plus size={16} />
              Guardar o primeiro
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {vehicles.map((row) => {
              const due = nextDue(row);
              return (
                <li key={row.vehicle.id} className="rounded-3xl border border-border bg-card/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/veiculo/$vehicleId"
                        params={{ vehicleId: row.vehicle.id }}
                        className="font-display text-xl font-semibold text-foreground hover:underline"
                      >
                        {row.vehicle.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {[row.vehicle.brand, row.vehicle.model].filter(Boolean).join(" ") ||
                          "Marca e modelo por registrar"}
                        {row.vehicle.year ? ` · ${row.vehicle.year}` : ""}
                      </p>
                    </div>
                    {row.vehicle.plate ? (
                      <span className="shrink-0 rounded-lg border border-border bg-secondary px-2.5 py-1 font-mono text-xs font-semibold tracking-wide text-secondary-foreground">
                        {row.vehicle.plate}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Mini label="Obrigações" value={String(row.obligations.length)} />
                    <Mini label="Papéis" value={String(row.documents.length)} />
                    <Mini
                      label="Km"
                      value={row.vehicle.odometer != null ? row.vehicle.odometer.toLocaleString("pt-BR") : "—"}
                    />
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {due
                      ? `Próximo vencimento em ${formatDate(due)} (${formatRelative(due)})`
                      : "Nada vencendo por enquanto"}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(row)}
                    >
                      Editar ficha
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={busyId === row.vehicle.id}
                      onClick={() => void remove(row)}
                    >
                      <Trash2 size={14} />
                      Remover
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <VehicleDialog
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(null)}
        householdId={household?.id ?? ""}
        initial={editing && editing !== "new" ? editing.vehicle : null}
      />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background/70 px-2 py-2">
      <p className="font-display text-lg font-semibold leading-none text-foreground">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function VehicleDialog({
  open,
  onOpenChange,
  householdId,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  initial: VehicleRow["vehicle"] | null;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<VehicleInput>(() => blank(householdId));
  const [seeded, setSeeded] = useState<string | null>(null);

  // O diálogo acompanha a ficha aberta: trocar de veículo troca o conteúdo.
  const seedKey = initial?.id ?? "new";
  if (open && seeded !== seedKey) {
    setSeeded(seedKey);
    setForm(
      initial
        ? {
            household_id: householdId,
            name: initial.name,
            plate: initial.plate,
            brand: initial.brand,
            model: initial.model,
            year: initial.year,
            purchase_date: initial.purchase_date,
            odometer: initial.odometer,
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
      toast.error("Dê um nome ao veículo.");
      return;
    }
    setBusy(true);
    try {
      if (initial) {
        await updateVehicle({ data: { ...form, vehicleId: initial.id, household_id: householdId } });
        toast.success("Ficha atualizada");
      } else {
        await createVehicle({ data: { ...form, household_id: householdId } });
        toast.success("Veículo na garagem");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {initial ? "Editar veículo" : "Novo veículo"}
          </DialogTitle>
          <DialogDescription>
            Nome e placa já bastam. Revisão e IPVA entram no radar a partir da ficha.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="vehicle-name">Nome</Label>
            <Input
              id="vehicle-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Carro da casa"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-plate">Placa</Label>
            <Input
              id="vehicle-plate"
              value={form.plate ?? ""}
              onChange={(e) => setForm({ ...form, plate: e.target.value })}
              placeholder="Ex.: ABC1D23"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-year">Ano</Label>
            <Input
              id="vehicle-year"
              inputMode="numeric"
              value={form.year ?? ""}
              onChange={(e) =>
                setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="Ex.: 2019"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-brand">Marca</Label>
            <Input
              id="vehicle-brand"
              value={form.brand ?? ""}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              placeholder="Ex.: Fiat"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-model">Modelo</Label>
            <Input
              id="vehicle-model"
              value={form.model ?? ""}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="Ex.: Argo"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-purchase">Compra</Label>
            <Input
              id="vehicle-purchase"
              type="date"
              value={form.purchase_date ?? ""}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-odometer">Quilometragem</Label>
            <Input
              id="vehicle-odometer"
              inputMode="numeric"
              value={form.odometer ?? ""}
              onChange={(e) =>
                setForm({ ...form, odometer: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="Ex.: 68000"
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

function blank(householdId: string): VehicleInput {
  return {
    household_id: householdId,
    name: "",
    plate: "",
    brand: "",
    model: "",
    year: null,
    purchase_date: "",
    odometer: null,
  };
}
