import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Car,
  Mail,
  PawPrint,
  Sprout,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
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
  DialogTrigger,
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
import { Switch } from "@/components/ui/switch";
import { guardSession } from "@/lib/auth-guard";
import { formatDate, formatBRL, MEMBER_ROLE_LABEL } from "@/lib/format";
import { activeLayerKeys, LAYER_KEYS, LAYER_META } from "@/lib/layers";
import { getMembersState, getSettingsState } from "@/lib/queries";
import {
  inviteMember,
  removeMember,
  setLayerActive,
  updateMemberAccess,
} from "@/lib/writes";
import type { LayerKey, MemberRole, MembersState } from "@/lib/types";

export const Route = createFileRoute("/config")({
  beforeLoad: () => guardSession(),
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Ajustes da casa — Casa Viva" },
      {
        name: "description",
        content:
          "As camadas da casa, quem mora nela e o peso de cada um: ligue ou desligue veículos, pets e jardim sem perder nenhum registro.",
      },
      { property: "og:title", content: "Ajustes da casa — Casa Viva" },
      {
        property: "og:description",
        content:
          "As camadas da casa, quem mora nela e o peso de cada um: ligue ou desligue veículos, pets e jardim sem perder nenhum registro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});


/** Papéis que se pode oferecer — o dono da casa não se convida. */
const OFFERED_ROLES: MemberRole[] = ["manager", "member", "viewer", "guest"];

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettingsState(),
    staleTime: 30_000,
  });
  const { data: people, isLoading: loadingPeople } = useQuery({
    queryKey: ["members-state"],
    queryFn: () => getMembersState(),
    staleTime: 15_000,
  });

  const [busyKey, setBusyKey] = useState<LayerKey | null>(null);

  const household = data?.household ?? null;
  const active = activeLayerKeys(data?.layers ?? []);

  async function toggle(key: LayerKey, next: boolean) {
    setBusyKey(key);
    try {
      await setLayerActive({ data: { layer: key, active: next } });
      await queryClient.invalidateQueries();
      toast.success(next ? "Camada ligada" : "Camada desligada", {
        description: next
          ? "O atalho volta a aparecer na navegação."
          : "Os registros continuam guardados — só saem da navegação.",
      });
    } catch (error) {
      toast.error("Não foi possível ajustar", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppNav />
      <header className="mx-auto max-w-5xl px-4 pt-8">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          A casa do seu tamanho
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
          Ajustes
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Nem toda casa tem carro, pet ou jardim. Desligue o que não é seu: o atalho
          sai da navegação e nada nos registros é apagado.
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Abrindo os ajustes…</p>
        ) : !household ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma casa por aqui ainda — monte a planta para começar.
          </p>
        ) : (
          <>
            <ul className="grid gap-4 md:grid-cols-3">
              {LAYER_KEYS.map((key) => {
                const meta = LAYER_META[key];
                const Icon = key === "veiculos" ? Car : key === "pets" ? PawPrint : Sprout;
                const on = active.includes(key);
                return (
                  <li
                    key={key}
                    className={`rounded-3xl border p-5 transition-colors ${
                      on ? "border-border bg-card/70" : "border-dashed border-border bg-card/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon size={18} className={on ? "text-primary" : "text-muted-foreground"} />
                        <h2 className="font-display text-xl font-semibold text-foreground">
                          {meta.label}
                        </h2>
                      </div>
                      <Switch
                        checked={on}
                        disabled={busyKey === key}
                        onCheckedChange={(next) => void toggle(key, next)}
                        aria-label={`Camada ${meta.label}`}
                      />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{meta.hint}</p>
                    <p className="mt-3 text-xs font-medium text-muted-foreground">
                      {on
                        ? "Ligada — aparece na navegação"
                        : "Desligada — os registros continuam guardados"}
                    </p>
                  </li>
                );
              })}
            </ul>

            <section className="mt-10">
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Quem cuida da casa
              </h2>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                Convide por e-mail e diga até quando. Quem só vê acompanha tudo, mas
                não mexe em nada.
              </p>
              <MembersPanel
                loading={loadingPeople}
                state={people ?? null}
                onChanged={() => void queryClient.invalidateQueries()}
              />
            </section>

            <section className="mt-10">
              <h2 className="font-display text-2xl font-semibold text-foreground">
                Mapa de carga
              </h2>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                O peso de verdade, saído dos registros: quantos itens cada um cuida e
                o que vence nos próximos 30 dias.
              </p>
              <LoadMap state={people ?? null} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

/** A lista de moradores com papel, prazo e convite pendente. */
function MembersPanel({
  loading,
  state,
  onChanged,
}: {
  loading: boolean;
  state: MembersState | null;
  onChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [until, setUntil] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <p className="mt-3 text-sm text-muted-foreground">Chamando os moradores…</p>;
  if (!state) return null;

  async function invite() {
    setBusy(true);
    try {
      await inviteMember({
        data: { email, role, expires_at: until ? `${until}T23:59:59` : null },
      });
      setEmail("");
      setRole("member");
      setUntil("");
      setOpen(false);
      toast.success("Convite enviado", {
        description: "Assim que a pessoa entrar com esse e-mail, ela já vê a casa.",
      });
      onChanged();
    } catch (error) {
      toast.error("Não foi possível convidar", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ul className="mt-4 divide-y divide-border rounded-3xl border border-border bg-card/60">
        {state.members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Users size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{m.display_name}</p>
              <p className="text-xs text-muted-foreground">
                {m.linked
                  ? "Morando na casa"
                  : "Convite à espera — entra com este e-mail"}
                {" · "}
                {m.expires_at ? `acesso até ${formatDate(m.expires_at)}` : "sem prazo"}
              </p>
            </div>
            {state.can_manage ? (
              <>
                <Select
                  value={m.role}
                  onValueChange={(next) =>
                    void changeAccess(m.id, next as MemberRole, m.expires_at, onChanged)
                  }
                >
                  <SelectTrigger className="w-32" aria-label={`Papel de ${m.display_name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFERED_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {MEMBER_ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Tirar ${m.display_name} da casa`}
                  onClick={() => void drop(m.id, m.display_name, onChanged)}
                >
                  <Trash2 size={16} />
                </Button>
              </>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">
                {MEMBER_ROLE_LABEL[m.role]}
              </span>
            )}
          </li>
        ))}
      </ul>

      {state.can_manage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="mt-4 rounded-full">
              <Mail size={16} />
              Chamar alguém
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Chamar alguém para a casa</DialogTitle>
              <DialogDescription>
                Diga o e-mail, o que a pessoa pode fazer e até quando.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">E-mail</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="quem@exemplo.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-role">O que pode fazer</Label>
                <Select
                  value={role}
                  onValueChange={(next) => setRole(next as MemberRole)}
                >
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFERED_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {MEMBER_ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invite-until">Acesso até (opcional)</Label>
                <Input
                  id="invite-until"
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Sem data, o acesso não tem prazo.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => void invite()}
                disabled={busy || !email.trim()}
                className="rounded-full"
              >
                <UserPlus size={16} />
                Convidar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/** O peso de cada pessoa em barras comparáveis. */
function LoadMap({ state }: { state: MembersState | null }) {
  if (!state) return null;
  const rows = [...state.load];
  if (state.unassigned.items > 0 || state.unassigned.due_30 > 0) {
    rows.push({
      member_id: null,
      name: "Ninguém",
      items: state.unassigned.items,
      due_30: state.unassigned.due_30,
      amount_30: state.unassigned.amount_30,
    });
  }
  if (rows.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Nenhuma obrigação registrada ainda — o mapa aparece quando a casa tem o que cuidar.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => Math.max(r.items, r.due_30)), 1);

  return (
    <ul className="mt-4 grid gap-3">
      {rows.map((r) => (
        <li
          key={r.member_id ?? "none"}
          className="rounded-3xl border border-border bg-card/60 p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-lg font-semibold text-foreground">{r.name}</p>
            <p className="text-xs text-muted-foreground">
              {r.items} {r.items === 1 ? "item" : "itens"} · {r.due_30}{" "}
              {r.due_30 === 1 ? "vencimento" : "vencimentos"} em 30 dias ·{" "}
              {formatBRL(r.amount_30)}
            </p>
          </div>
          <div className="mt-3 h-2 rounded-full bg-secondary">
            <div
              className={`h-2 rounded-full ${r.member_id ? "bg-primary" : "bg-muted-foreground/50"}`}
              style={{ width: `${Math.max(4, (Math.max(r.items, r.due_30) / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

async function changeAccess(
  memberId: string,
  role: MemberRole,
  expiresAt: string | null,
  onChanged: () => void,
) {
  try {
    await updateMemberAccess({ data: { memberId, role, expires_at: expiresAt } });
    toast.success("Papel atualizado");
    onChanged();
  } catch (error) {
    toast.error("Não foi possível mudar", {
      description: error instanceof Error ? error.message : "Tente de novo.",
    });
  }
}

async function drop(memberId: string, name: string, onChanged: () => void) {
  try {
    await removeMember({ data: { memberId } });
    toast.success("Pessoa tirada da casa", { description: name });
    onChanged();
  } catch (error) {
    toast.error("Não foi possível tirar", {
      description: error instanceof Error ? error.message : "Tente de novo.",
    });
  }
}

