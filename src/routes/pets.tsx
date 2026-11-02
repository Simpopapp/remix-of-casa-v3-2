import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PawPrint, Plus, Trash2 } from "lucide-react";
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
import { getPetsPage } from "@/lib/queries";
import { createPet, deletePet, updatePet, type PetInput } from "@/lib/writes";
import type { Pet, PetRow } from "@/lib/types";

export const Route = createFileRoute("/pets")({
  beforeLoad: () => guardSession(),
  component: PetsPage,
  head: () => ({
    meta: [
      { title: "Pets — Casa Viva" },
      {
        name: "description",
        content:
          "Vacinas, consultas, medicações e documentos de cada pet da casa, no mesmo radar do resto do lar.",
      },
      { property: "og:title", content: "Pets — Casa Viva" },
      {
        property: "og:description",
        content:
          "Vacinas, consultas, medicações e documentos de cada pet da casa, no mesmo radar do resto do lar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

/** A idade do pet, dita como gente fala: "3 anos e 2 meses". */
function ageFrom(birthdate: string | null): string | null {
  if (!birthdate) return null;
  const born = new Date(`${birthdate}T12:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return rest === 0 ? "menos de um mês" : `${rest} ${rest === 1 ? "mês" : "meses"}`;
  if (rest === 0) return `${years} ${years === 1 ? "ano" : "anos"}`;
  return `${years} ${years === 1 ? "ano" : "anos"} e ${rest} ${rest === 1 ? "mês" : "meses"}`;
}

/** O próximo vencimento do pet: a obrigação que chega antes. */
function nextDue(row: PetRow): string | null {
  const dates = row.obligations
    .map((o) => o.next_due)
    .filter((d): d is string => Boolean(d))
    .sort();
  return dates[0] ?? null;
}

function PetsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pets"],
    queryFn: () => getPetsPage(),
    staleTime: 30_000,
  });

  const [editing, setEditing] = useState<PetRow | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const household = data?.household ?? null;
  const pets = data?.pets ?? [];

  async function remove(row: PetRow) {
    setBusyId(row.pet.id);
    try {
      await deletePet({ data: { petId: row.pet.id } });
      await queryClient.invalidateQueries();
      toast.success("Pet tirado da lista", {
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
            Quem tem quatro patas
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
            Pets
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Vacina, vermífugo, consulta e a carteira de vacinação guardada — tudo no
            radar que a casa já lê todo dia.
          </p>
        </div>
        <Button onClick={() => setEditing("new")} disabled={!household}>
          <Plus size={16} />
          Novo pet
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chamando a casa…</p>
        ) : !household ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma casa por aqui ainda — monte a planta para começar.
          </p>
        ) : pets.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <PawPrint className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
              Nenhum pet registrado
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Nome e espécie já bastam. A próxima vacina entra no radar a partir da ficha.
            </p>
            <Button className="mt-5" onClick={() => setEditing("new")}>
              <Plus size={16} />
              Guardar o primeiro
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {pets.map((row) => {
              const due = nextDue(row);
              const age = ageFrom(row.pet.birthdate);
              return (
                <li key={row.pet.id} className="rounded-3xl border border-border bg-card/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to="/pet/$petId"
                        params={{ petId: row.pet.id }}
                        className="font-display text-xl font-semibold text-foreground hover:underline"
                      >
                        {row.pet.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {[row.pet.species, row.pet.breed].filter(Boolean).join(" · ") ||
                          "Espécie por registrar"}
                      </p>
                    </div>
                    {age ? (
                      <span className="shrink-0 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                        {age}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Mini label="Obrigações" value={String(row.obligations.length)} />
                    <Mini label="Papéis" value={String(row.documents.length)} />
                    <Mini
                      label="Peso"
                      value={row.pet.weight_kg != null ? `${row.pet.weight_kg} kg` : "—"}
                    />
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {due
                      ? `Próximo vencimento em ${formatDate(due)} (${formatRelative(due)})`
                      : "Nada vencendo por enquanto"}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                      Editar ficha
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={busyId === row.pet.id}
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

      <PetDialog
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(null)}
        householdId={household?.id ?? ""}
        initial={editing && editing !== "new" ? editing.pet : null}
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

function PetDialog({
  open,
  onOpenChange,
  householdId,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  initial: Pet | null;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<PetInput>(() => blank(householdId));
  const [seeded, setSeeded] = useState<string | null>(null);

  const seedKey = initial?.id ?? "new";
  if (open && seeded !== seedKey) {
    setSeeded(seedKey);
    setForm(
      initial
        ? {
            household_id: householdId,
            name: initial.name,
            species: initial.species,
            breed: initial.breed,
            birthdate: initial.birthdate,
            weight_kg: initial.weight_kg,
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
      toast.error("Dê um nome ao pet.");
      return;
    }
    setBusy(true);
    try {
      if (initial) {
        await updatePet({ data: { ...form, petId: initial.id, household_id: householdId } });
        toast.success("Ficha atualizada");
      } else {
        await createPet({ data: { ...form, household_id: householdId } });
        toast.success("Pet registrado");
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
            {initial ? "Editar pet" : "Novo pet"}
          </DialogTitle>
          <DialogDescription>
            Nome e espécie já bastam. A carteira de vacinação vem com o tempo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pet-name">Nome</Label>
            <Input
              id="pet-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Nina"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pet-species">Espécie</Label>
            <Input
              id="pet-species"
              value={form.species ?? ""}
              onChange={(e) => setForm({ ...form, species: e.target.value })}
              placeholder="Ex.: Cachorro"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pet-breed">Raça</Label>
            <Input
              id="pet-breed"
              value={form.breed ?? ""}
              onChange={(e) => setForm({ ...form, breed: e.target.value })}
              placeholder="Ex.: Vira-lata"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pet-birth">Nascimento</Label>
            <Input
              id="pet-birth"
              type="date"
              value={form.birthdate ?? ""}
              onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pet-weight">Peso (kg)</Label>
            <Input
              id="pet-weight"
              inputMode="decimal"
              value={form.weight_kg ?? ""}
              onChange={(e) =>
                setForm({ ...form, weight_kg: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="Ex.: 12,5"
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

function blank(householdId: string): PetInput {
  return {
    household_id: householdId,
    name: "",
    species: "",
    breed: "",
    birthdate: "",
    weight_kg: null,
  };
}
