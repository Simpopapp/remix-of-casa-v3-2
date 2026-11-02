import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarClock,
  Check,
  Droplets,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";
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
import { activeLayerKeys, sortByWatering } from "@/lib/layers";
import { getRadar } from "@/lib/queries";

import {
  completeOccurrence,
  createObligation,
  deleteObligation,
  ensureRadarOccurrences,
  reopenOccurrence,
} from "@/lib/writes";
import type {
  ObligationFrequency,
  ObligationKind,
  RadarObligation,
} from "@/lib/types";

export const Route = createFileRoute("/obrigacoes")({
  beforeLoad: () => guardSession(),
  component: RadarPage,
  head: () => ({
    meta: [
      { title: "Radar temporal — Casa Viva" },
      {
        name: "description",
        content:
          "Doze meses de vencimentos da casa à vista: contas, tributos, seguros e revisões, com custo previsto por mês e responsável por cada item.",
      },
      { property: "og:title", content: "Radar temporal — Casa Viva" },
      {
        property: "og:description",
        content:
          "Doze meses de vencimentos da casa à vista: contas, tributos, seguros e revisões, com custo previsto por mês e responsável por cada item.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const KIND_LABEL: Record<ObligationKind, string> = {
  conta: "Conta",
  tributo: "Tributo",
  seguro: "Seguro",
  revisao: "Revisão",
  vacina: "Vacina",
  contrato: "Contrato",
  outro: "Outro",
};

const FREQUENCY_LABEL: Record<ObligationFrequency, string> = {
  one_time: "Uma vez só",
  monthly: "Todo mês",
  quarterly: "A cada 3 meses",
  semiannual: "A cada 6 meses",
  yearly: "Uma vez por ano",
  custom: "Intervalo personalizado",
};

interface FlatOccurrence {
  occurrenceId: string;
  due_date: string;
  status: "pendente" | "pago" | "feito";
  amount_paid: number | null;
  obligation: RadarObligation;
}

function daysUntil(iso: string): number {
  const date = new Date(`${iso}T12:00:00`);
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const date = new Date(`${key}-15T12:00:00`);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function RadarPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["radar"],
    queryFn: () => getRadar(),
    staleTime: 30_000,
  });
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const household = data?.household ?? null;

  // Ao abrir o radar, garante que as ocorrências dos próximos 12 meses existem.
  useEffect(() => {
    if (!household) return;
    void ensureRadarOccurrences({ data: { household_id: household.id } }).then(() =>
      queryClient.invalidateQueries({ queryKey: ["radar"] }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id]);

  const flat = useMemo<FlatOccurrence[]>(() => {
    return (data?.obligations ?? []).flatMap((obligation) =>
      obligation.occurrences.map((occ) => ({
        occurrenceId: occ.id,
        due_date: occ.due_date,
        status: occ.status,
        amount_paid: occ.amount_paid,
        obligation,
      })),
    );
  }, [data?.obligations]);

  const overdue = flat.filter((o) => o.status === "pendente" && daysUntil(o.due_date) < 0);
  const dueSoon = flat.filter((o) => {
    const d = daysUntil(o.due_date);
    return o.status === "pendente" && d >= 0 && d <= 7;
  });

  const months = useMemo(() => {
    const map = new Map<string, FlatOccurrence[]>();
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + 12);
    const limit = `${horizon.getFullYear()}-${String(horizon.getMonth() + 1).padStart(2, "0")}`;
    for (const occ of flat) {
      const key = monthKey(occ.due_date);
      if (key > limit) continue;
      const list = map.get(key) ?? [];
      list.push(occ);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({
        key,
        label: monthLabel(key),
        items: items.sort((a, b) => a.due_date.localeCompare(b.due_date)),
        forecast: items
          .filter((i) => i.status === "pendente")
          .reduce((sum, i) => sum + (i.obligation.amount ?? 0), 0),
      }));
  }, [flat]);

  const yearForecast = months.reduce((sum, m) => sum + m.forecast, 0);

  // A rega do jardim entra no radar quando a camada está ligada: é o que a casa
  // precisa saber antes de molhar, não um compromisso que se paga.
  const gardenCare = useMemo(() => {
    if (!activeLayerKeys(data?.layers ?? []).includes("jardim")) return [];
    return sortByWatering(data?.plants ?? [])
      .filter((r) => r.watering.status === "atrasada" || r.watering.status === "logo")
      .slice(0, 6);
  }, [data?.plants, data?.layers]);


  async function complete(occ: FlatOccurrence) {
    setBusyId(occ.occurrenceId);
    try {
      await completeOccurrence({
        data: {
          occurrenceId: occ.occurrenceId,
          status: occ.obligation.amount != null ? "pago" : "feito",
          amountPaid: occ.obligation.amount,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Anotado", {
        description: `${occ.obligation.title} — ${formatDate(occ.due_date)}.`,
      });
    } catch (error) {
      toast.error("Não foi possível marcar", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function reopen(occ: FlatOccurrence) {
    setBusyId(occ.occurrenceId);
    try {
      await reopenOccurrence({ data: { occurrenceId: occ.occurrenceId } });
      await queryClient.invalidateQueries();
      toast.success("Voltou para o radar");
    } catch (error) {
      toast.error("Não foi possível desfazer", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(obligation: RadarObligation) {
    setBusyId(obligation.id);
    try {
      await deleteObligation({ data: { obligationId: obligation.id } });
      await queryClient.invalidateQueries();
      toast.success("Obrigação removida do radar");
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
            O que vem pela frente
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
            Radar temporal
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Doze meses de vencimentos à vista — quanto vai custar, quem cuida e o
            que precisa de decisão, não só de pagamento.
          </p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={!household}>
          <Plus size={16} />
          Nova obrigação
        </Button>
      </header>

      {(overdue.length > 0 || dueSoon.length > 0 || yearForecast > 0) && (
        <div className="mx-auto mt-5 flex max-w-5xl flex-wrap gap-2 px-4">
          {overdue.length > 0 && (
            <p className="inline-flex items-center gap-2 rounded-full border border-urgente/40 bg-urgente/10 px-4 py-2 text-sm text-urgente-foreground">
              <strong>{overdue.length}</strong> em atraso
            </p>
          )}
          {dueSoon.length > 0 && (
            <p className="inline-flex items-center gap-2 rounded-full border border-atencao/40 bg-atencao/10 px-4 py-2 text-sm text-atencao-foreground">
              <strong>{dueSoon.length}</strong> vencem em 7 dias
            </p>
          )}
          {yearForecast > 0 && (
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-2 text-sm text-secondary-foreground">
              Previsão de 12 meses: <strong>{formatBRL(yearForecast)}</strong>
            </p>
          )}
        </div>
      )}

      {gardenCare.length > 0 && (
        <div className="mx-auto mt-5 max-w-5xl px-4">
          <div className="rounded-3xl border border-border bg-card/70 px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-display text-lg font-semibold text-foreground">
                Cuidados do jardim
              </p>
              <Link to="/jardim" className="text-xs font-medium text-primary hover:underline">
                Ver o jardim
              </Link>
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {gardenCare.map(({ plant, watering }) => (
                <li
                  key={plant.id}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
                    watering.status === "atrasada"
                      ? "border-urgente/40 bg-urgente/15 text-urgente-foreground"
                      : "border-atencao/40 bg-atencao/15 text-atencao-foreground"
                  }`}
                >
                  <Droplets size={11} />
                  {plant.name} ·{" "}
                  {watering.status === "atrasada"
                    ? "esperando água"
                    : `rega em ${watering.next ? formatDate(watering.next) : "breve"}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8">

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Varrendo o calendário da casa…</p>
        ) : !household ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma casa por aqui ainda — monte a planta para começar.
          </p>
        ) : flat.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
              O radar está limpo
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Comece pelo que se repete: o aluguel, o IPTU, o seguro, a limpeza da
              caixa d'água. O radar projeta os próximos 12 meses sozinho.
            </p>
            <Button className="mt-5" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Criar a primeira
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {months.map((month) => (
              <section key={month.key}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    {month.label}
                  </h2>
                  {month.forecast > 0 && (
                    <p className="text-sm text-muted-foreground">
                      previsto: <strong className="text-foreground">{formatBRL(month.forecast)}</strong>
                    </p>
                  )}
                </div>
                <ul className="space-y-2">
                  {month.items.map((occ) => {
                    const d = daysUntil(occ.due_date);
                    const isOverdue = occ.status === "pendente" && d < 0;
                    const isDone = occ.status !== "pendente";
                    return (
                      <li
                        key={occ.occurrenceId}
                        className={`flex flex-wrap items-center gap-3 rounded-3xl border px-5 py-4 ${
                          isOverdue
                            ? "border-urgente/40 bg-urgente/5"
                            : "border-border bg-card/70"
                        } ${isDone ? "opacity-70" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate font-display text-lg font-semibold text-foreground ${
                              isDone ? "line-through" : ""
                            }`}
                          >
                            {occ.obligation.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {KIND_LABEL[occ.obligation.kind] ?? occ.obligation.kind}
                            {occ.obligation.room_name ? ` · ${occ.obligation.room_name}` : ""}
                            {occ.obligation.asset_name ? ` · ${occ.obligation.asset_name}` : ""}
                            {occ.obligation.vehicle_name
                              ? ` · ${occ.obligation.vehicle_name}`
                              : ""}
                            {occ.obligation.pet_name ? ` · ${occ.obligation.pet_name}` : ""}

                            {occ.obligation.responsible_name
                              ? ` · ${occ.obligation.responsible_name}`
                              : ""}
                            {` · ${formatDate(occ.due_date)} (${formatRelative(occ.due_date)})`}
                          </p>
                        </div>

                        {occ.obligation.amount != null && (
                          <span className="shrink-0 text-sm font-semibold text-foreground">
                            {formatBRL(isDone && occ.amount_paid != null ? occ.amount_paid : occ.obligation.amount)}
                          </span>
                        )}

                        {isDone ? (
                          <span className="inline-flex shrink-0 items-center gap-2">
                            <span className="rounded-full border border-tranquilo/40 bg-tranquilo/15 px-3 py-1 text-xs font-semibold text-tranquilo-foreground">
                              {occ.status === "pago" ? "Pago" : "Feito"}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => void reopen(occ)}
                              disabled={busyId === occ.occurrenceId}
                              title="Desfazer"
                            >
                              <RotateCcw size={14} />
                            </Button>
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-2">
                            {isOverdue && (
                              <span className="rounded-full border border-urgente/40 bg-urgente/15 px-3 py-1 text-xs font-semibold text-urgente-foreground">
                                Em atraso
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void complete(occ)}
                              disabled={busyId === occ.occurrenceId}
                            >
                              <Check size={14} />
                              {occ.obligation.amount != null ? "Marcar pago" : "Marcar feito"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => void remove(occ.obligation)}
                              disabled={busyId === occ.obligation.id}
                              title="Remover obrigação"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <ObligationDialog
        open={adding}
        onOpenChange={setAdding}
        householdId={household?.id ?? ""}
        rooms={data?.rooms ?? []}
        assets={data?.assets ?? []}
        members={data?.members ?? []}
        vehicles={data?.vehicles ?? []}
        pets={data?.pets ?? []}
      />

    </div>
  );
}

function ObligationDialog({
  open,
  onOpenChange,
  householdId,
  rooms,
  assets,
  members,
  vehicles,
  pets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  rooms: Array<{ id: string; name: string }>;
  assets: Array<{ id: string; name: string }>;
  members: Array<{ id: string; display_name: string }>;
  vehicles: Array<{ id: string; name: string }>;
  pets: Array<{ id: string; name: string }>;
}) {

  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ObligationKind>("conta");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<ObligationFrequency>("monthly");
  const [customDays, setCustomDays] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [roomId, setRoomId] = useState("none");
  const [assetId, setAssetId] = useState("none");
  const [vehicleId, setVehicleId] = useState("none");
  const [petId, setPetId] = useState("none");
  const [memberId, setMemberId] = useState("none");

  const [notes, setNotes] = useState("");

  async function submit() {
    if (!householdId) {
      toast.error("Monte a casa primeiro.");
      return;
    }
    if (!title.trim()) {
      toast.error("Dê um título à obrigação.");
      return;
    }
    if (!nextDue) {
      toast.error("Diga quando vence a primeira vez.");
      return;
    }
    setBusy(true);
    try {
      await createObligation({
        data: {
          household_id: householdId,
          title,
          kind,
          amount: parseAmount(amount),
          frequency,
          custom_interval_days:
            frequency === "custom" ? Number(customDays) || null : null,
          next_due: nextDue,
          room_id: roomId === "none" ? null : roomId,
          asset_id: assetId === "none" ? null : assetId,
          vehicle_id: vehicleId === "none" ? null : vehicleId,
          pet_id: petId === "none" ? null : petId,
          responsible_member_id: memberId === "none" ? null : memberId,

          notes,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("No radar", {
        description: "Os próximos 12 meses já foram projetados.",
      });
      // Limpa tudo, inclusive os vínculos: sem isso a próxima obrigação nasce
      // heredando o cômodo, o objeto, o veículo ou o pet da anterior.
      setTitle("");
      setKind("conta");
      setAmount("");
      setFrequency("monthly");
      setCustomDays("");
      setNextDue("");
      setRoomId("none");
      setAssetId("none");
      setVehicleId("none");
      setPetId("none");
      setMemberId("none");
      setNotes("");
      onOpenChange(false);

    } catch (error) {
      toast.error("Não foi possível criar", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Nova obrigação</DialogTitle>
          <DialogDescription>
            Título, valor e primeiro vencimento já bastam — o radar projeta o resto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="obl-title">Título</Label>
            <Input
              id="obl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: IPTU, seguro residencial, limpeza da caixa d'água"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as ObligationKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obl-amount">Valor (opcional)</Label>
            <Input
              id="obl-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex.: 350,00"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Repetição</Label>
            <Select
              value={frequency}
              onValueChange={(v) => setFrequency(v as ObligationFrequency)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FREQUENCY_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {frequency === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="obl-custom">A cada quantos dias?</Label>
              <Input
                id="obl-custom"
                inputMode="numeric"
                value={customDays}
                onChange={(e) => setCustomDays(e.target.value)}
                placeholder="Ex.: 90"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="obl-due">Primeiro vencimento</Label>
            <Input
              id="obl-due"
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Quem cuida</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Ninguém em específico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguém em específico</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cômodo</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Objeto</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {vehicles.length > 0 && (
            <div className="space-y-1.5">
              <Label>Veículo</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {pets.length > 0 && (
            <div className="space-y-1.5">
              <Label>Pet</Label>
              <Select value={petId} onValueChange={setPetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {pets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}


          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="obl-notes">Anotações</Label>
            <Textarea
              id="obl-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex.: código de barras chega por e-mail"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Deixar para depois
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Um instante…" : "Colocar no radar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
