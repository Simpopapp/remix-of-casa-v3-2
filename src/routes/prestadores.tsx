import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Phone, Plus, Star } from "lucide-react";
import { useEffect, useState } from "react";
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
import { providerMemory, VERDICT_LABEL } from "@/lib/inventory";
import { getProviderDirectory } from "@/lib/queries";
import {
  createProvider,
  recordProviderService,
  type ProviderInput,
} from "@/lib/writes";

export const Route = createFileRoute("/prestadores")({
  beforeLoad: () => guardSession(),
  component: ProvidersPage,
  head: () => ({
    meta: [
      { title: "Prestadores — Casa Viva" },
      {
        name: "description",
        content:
          "A agenda de prestadores da casa com memória: quem fez o quê, quanto cobrou e se vale chamar de novo.",
      },
      { property: "og:title", content: "Prestadores — Casa Viva" },
      {
        property: "og:description",
        content:
          "A agenda de prestadores da casa com memória: quem fez o quê, quanto cobrou e se vale chamar de novo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const VERDICT_CHIP: Record<string, string> = {
  confia: "border-tranquilo/40 bg-tranquilo/15 text-tranquilo-foreground",
  neutro: "border-border bg-secondary text-secondary-foreground",
  evitar: "border-urgente/40 bg-urgente/15 text-urgente-foreground",
};

function ProvidersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["provider-directory"],
    queryFn: () => getProviderDirectory(),
    staleTime: 30_000,
  });

  const [adding, setAdding] = useState(false);
  const [serviceFor, setServiceFor] = useState<string | null>(null);

  const household = data?.household ?? null;
  const providers = data?.providers ?? [];

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppNav />
      <header className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3 px-4 pt-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            A agenda da casa
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
            Prestadores
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Quem consertou o quê, quanto cobrou e se vale chamar de novo — a memória
            que costuma morar na cabeça de uma pessoa só.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus size={16} />
            Novo prestador
          </Button>
          <Button
            onClick={() => setServiceFor(providers[0]?.provider.id ?? "")}
            disabled={providers.length === 0}
          >
            Registrar serviço
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Abrindo a agenda…</p>
        ) : !household ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma casa por aqui ainda — monte a planta para começar.
          </p>
        ) : providers.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <h2 className="font-display text-2xl font-semibold text-foreground">
              A agenda está vazia
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Guarde o encanador, a eletricista, a diarista. Na próxima emergência,
              o número já está aqui.
            </p>
            <Button className="mt-5" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Guardar o primeiro
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {providers.map(({ provider, services }) => {
              const memory = providerMemory(services);
              return (
                <li
                  key={provider.id}
                  className="rounded-3xl border border-border bg-card/70 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-xl font-semibold text-foreground">
                        {provider.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {provider.specialty ?? "Sem especialidade registrada"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${VERDICT_CHIP[memory.verdict]}`}
                    >
                      {VERDICT_LABEL[memory.verdict]}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Mini label="Serviços" value={String(memory.services)} />
                    <Mini
                      label="Já cobrou"
                      value={memory.totalSpent > 0 ? formatBRL(memory.totalSpent) : "—"}
                    />
                    <Mini
                      label="Nota média"
                      value={memory.avgRating != null ? memory.avgRating.toFixed(1) : "—"}
                    />
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {memory.wouldHireAgain != null
                      ? `${Math.round(memory.wouldHireAgain * 100)}% das vezes a casa chamaria de novo`
                      : "Ainda sem opinião registrada"}
                    {memory.lastService
                      ? ` · último em ${formatRelative(memory.lastService)}`
                      : ""}
                  </p>

                  {provider.phone ? (
                    <a
                      href={`tel:${provider.phone}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                    >
                      <Phone size={14} />
                      {provider.phone}
                    </a>
                  ) : null}

                  {provider.notes ? (
                    <p className="mt-2 text-sm text-muted-foreground">{provider.notes}</p>
                  ) : null}

                  {services.length > 0 && (
                    <ul className="mt-4 space-y-2 border-t border-border pt-3">
                      {services.slice(-3).reverse().map((s) => (
                        <li key={s.id} className="text-sm">
                          <p className="font-medium text-foreground">
                            {s.description}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {formatDate(s.date)}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {s.asset_name ? `${s.asset_name} · ` : ""}
                            {s.cost != null ? formatBRL(s.cost) : "sem valor"}
                            {s.rating != null ? (
                              <span className="inline-flex items-center gap-0.5">
                                {" · "}
                                <Star size={10} /> {s.rating}
                              </span>
                            ) : null}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={() => setServiceFor(provider.id)}
                  >
                    <Plus size={14} />
                    Registrar serviço
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <ProviderDialog open={adding} onOpenChange={setAdding} householdId={household?.id ?? ""} />

      <ServiceDialog
        open={serviceFor != null}
        onOpenChange={(open) => !open && setServiceFor(null)}
        providers={providers.map((p) => ({ id: p.provider.id, name: p.provider.name }))}
        initialProviderId={serviceFor ?? ""}
        assets={(data?.providers ?? []).flatMap((p) =>
          p.services.filter((s) => s.asset_id).map((s) => ({ id: s.asset_id!, name: s.asset_name ?? "objeto" })),
        )}
      />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background/70 px-2 py-2">
      <p className="font-display text-lg font-semibold leading-none text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function ProviderDialog({
  open,
  onOpenChange,
  householdId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ProviderInput>({
    household_id: householdId,
    name: "",
    specialty: "",
    phone: "",
    trusted: false,
    notes: "",
  });

  async function submit() {
    if (!householdId) {
      toast.error("Monte a casa primeiro.");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Dê um nome ao prestador.");
      return;
    }
    setBusy(true);
    try {
      await createProvider({ data: { ...form, household_id: householdId } });
      await queryClient.invalidateQueries();
      toast.success("Prestador guardado");
      setForm({ household_id: householdId, name: "", specialty: "", phone: "", trusted: false, notes: "" });
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
          <DialogTitle className="font-display text-2xl">Novo prestador</DialogTitle>
          <DialogDescription>
            Nome e telefone já bastam. O histórico vem com o tempo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="provider-name">Nome</Label>
            <Input
              id="provider-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Seu Antônio"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider-specialty">Faz o quê</Label>
            <Input
              id="provider-specialty"
              value={form.specialty ?? ""}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              placeholder="Ex.: Encanador"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider-phone">Telefone</Label>
            <Input
              id="provider-phone"
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Ex.: (11) 99999-0000"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="provider-notes">Anotações</Label>
            <Textarea
              id="provider-notes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Ex.: cobra pelo horário, atende fim de semana"
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

function ServiceDialog({
  open,
  onOpenChange,
  providers,
  initialProviderId,
  assets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providers: Array<{ id: string; name: string }>;
  initialProviderId: string;
  assets: Array<{ id: string; name: string }>;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [providerId, setProviderId] = useState(initialProviderId);
  const [assetId, setAssetId] = useState("none");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [rating, setRating] = useState("none");
  const [wouldHire, setWouldHire] = useState("none");

  // O prestador escolhido no card manda: o diálogo acompanha a escolha.
  useEffect(() => {
    if (initialProviderId) setProviderId(initialProviderId);
  }, [initialProviderId]);

  async function submit() {
    if (!providerId) {
      toast.error("Escolha o prestador.");
      return;
    }
    if (!description.trim()) {
      toast.error("Conte qual foi o serviço.");
      return;
    }
    setBusy(true);
    try {
      await recordProviderService({
        data: {
          provider_id: providerId,
          asset_id: assetId === "none" ? null : assetId,
          date,
          description,
          cost: parseAmount(cost),
          rating: rating === "none" ? null : Number(rating),
          would_hire_again: wouldHire === "none" ? null : wouldHire === "sim",
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Serviço registrado na memória da casa");
      setDescription("");
      setCost("");
      onOpenChange(false);
    } catch (error) {
      toast.error("Não foi possível registrar", {
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
          <DialogTitle className="font-display text-2xl">Registrar serviço</DialogTitle>
          <DialogDescription>
            Anotar agora é o que faz a agenda virar memória.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Prestador</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger>
                <SelectValue placeholder="Quem veio" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service-date">Quando</Label>
            <Input
              id="service-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="service-description">O que foi feito</Label>
            <Textarea
              id="service-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ex.: Trocou o disjuntor da cozinha"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Em quê</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="Nada específico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nada específico</SelectItem>
                {uniqueAssets(assets).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service-cost">Quanto cobrou</Label>
            <Input
              id="service-cost"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="Ex.: 380"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Nota do serviço</Label>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger>
                <SelectValue placeholder="Sem nota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem nota</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Chamaria de novo?</Label>
            <Select value={wouldHire} onValueChange={setWouldHire}>
              <SelectTrigger>
                <SelectValue placeholder="Ainda não sei" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ainda não sei</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Deixar para depois
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Um instante…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function uniqueAssets(assets: Array<{ id: string; name: string }>) {
  const seen = new Set<string>();
  return assets.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}
