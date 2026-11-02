import { useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Plus, RotateCcw, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatRelative, parseAmount } from "@/lib/format";
import { getDocumentFileUrl } from "@/lib/queries";
import {
  completeOccurrence,
  createDocument,
  createObligation,
  deleteDocument,
} from "@/lib/writes";
import type {
  DocumentItem,
  ObligationFrequency,
  ObligationKind,
  ObligationWithOccurrences,
  RadarMember,
} from "@/lib/types";

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

const DOC_CATEGORIES = [
  { value: "apolice", label: "Apólice / seguro" },
  { value: "nota_fiscal", label: "Nota fiscal" },
  { value: "contrato", label: "Contrato" },
  { value: "manual", label: "Manual / garantia" },
  { value: "laudo", label: "Laudo / certidão" },
  { value: "outro", label: "Outro" },
];

const DOC_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  DOC_CATEGORIES.map((c) => [c.value, c.label]),
);

/** A ligação da ficha com a camada: um veículo ou um pet. */
export interface LayerLink {
  vehicle_id?: string | null;
  pet_id?: string | null;
}

/**
 * O que uma ficha de camada faz: compromissos que vencem (com o marcar pago)
 * e os papéis que comprovam. Veículo e pet usam a mesma peça para que as
 * camadas se comportem igual — a regra do PRD para "o mesmo modelo".
 */
export function LayerFicha({
  householdId,
  link,
  obligations,
  documents,
  members,
  subject,
}: {
  householdId: string;
  link: LayerLink;
  obligations: ObligationWithOccurrences[];
  documents: DocumentItem[];
  members: RadarMember[];
  /** "veículo" ou "pet" — entra no texto dos diálogos. */
  subject: string;
}) {
  const queryClient = useQueryClient();
  const [addingObligation, setAddingObligation] = useState(false);
  const [addingDocument, setAddingDocument] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** A ocorrência pendente mais próxima — o que a casa deve resolver agora. */
  function pendingOccurrence(obligation: ObligationWithOccurrences) {
    return (
      obligation.occurrences
        .filter((o) => o.status === "pendente")
        .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ?? null
    );
  }

  async function markDone(occurrenceId: string, amount: number | null) {
    setBusyId(occurrenceId);
    try {
      await completeOccurrence({
        data: {
          occurrenceId,
          status: amount != null ? "pago" : "feito",
          amountPaid: amount,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Anotado na ficha");
    } catch (error) {
      toast.error("Não foi possível marcar", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function undo(occurrenceId: string) {
    setBusyId(occurrenceId);
    try {
      const { error } = await supabase
        .from("obligation_occurrences")
        .update({ status: "pendente", paid_at: null, amount_paid: null })
        .eq("id", occurrenceId);
      if (error) throw new Error(error.message);
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

  async function openDocument(documentId: string) {
    setBusyId(documentId);
    try {
      const { url } = await getDocumentFileUrl({ data: { documentId } });
      if (!url) {
        toast.error("Esse documento não tem arquivo guardado.");
        return;
      }
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error("Não deu para abrir", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function removeDocument(documentId: string) {
    setBusyId(documentId);
    try {
      await deleteDocument({ data: { documentId } });
      await queryClient.invalidateQueries();
      toast.success("Tirado do cofre");
    } catch (error) {
      toast.error("Não foi possível remover", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            O que vence
          </h2>
          <Button size="sm" variant="outline" onClick={() => setAddingObligation(true)}>
            <Plus size={14} />
            Novo compromisso
          </Button>
        </div>

        {obligations.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-card/60 px-5 py-6 text-sm text-muted-foreground">
            Nada vinculado a este {subject} ainda. Vacina, revisão, IPVA ou seguro
            entram aqui e aparecem no radar da casa.
          </p>
        ) : (
          <ul className="space-y-2">
            {obligations.map((obligation) => {
              const occurrence = pendingOccurrence(obligation);
              const done = [...obligation.occurrences]
                .filter((o) => o.status !== "pendente")
                .sort((a, b) => b.due_date.localeCompare(a.due_date))[0] ?? null;
              return (
                <li
                  key={obligation.id}
                  className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-card/70 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-semibold text-foreground">
                      {obligation.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {KIND_LABEL[obligation.kind] ?? obligation.kind}
                      {` · ${FREQUENCY_LABEL[obligation.frequency] ?? obligation.frequency}`}
                      {obligation.responsible_member_id
                        ? ` · ${members.find((m) => m.id === obligation.responsible_member_id)?.display_name ?? "responsável"}`
                        : ""}
                      {obligation.next_due
                        ? ` · vence ${formatDate(obligation.next_due)} (${formatRelative(obligation.next_due)})`
                        : ""}
                    </p>
                  </div>

                  {obligation.amount != null && (
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {obligation.amount.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  )}

                  {occurrence ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === occurrence.id}
                      onClick={() => void markDone(occurrence.id, obligation.amount)}
                    >
                      <Check size={14} />
                      {obligation.amount != null ? "Marcar pago" : "Marcar feito"}
                    </Button>
                  ) : done ? (
                    <span className="inline-flex shrink-0 items-center gap-2">
                      <span className="rounded-full border border-tranquilo/40 bg-tranquilo/15 px-3 py-1 text-xs font-semibold text-tranquilo-foreground">
                        {done.status === "pago" ? "Pago" : "Feito"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === done.id}
                        title="Desfazer"
                        onClick={() => void undo(done.id)}
                      >
                        <RotateCcw size={14} />
                      </Button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Papéis deste {subject}
          </h2>
          <Button size="sm" variant="outline" onClick={() => setAddingDocument(true)}>
            <Upload size={14} />
            Guardar papel
          </Button>
        </div>

        {documents.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-border bg-card/60 px-5 py-6 text-sm text-muted-foreground">
            Nenhum documento ligado a ele ainda. Apólice, CRLV, nota fiscal e carteira
            de vacinação moram aqui.
          </p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center gap-3 rounded-3xl border border-border bg-card/70 px-4 py-3"
              >
                <FileText size={16} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{document.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {DOC_CATEGORY_LABEL[document.category] ?? document.category}
                    {document.expires_at
                      ? ` · validade ${formatDate(document.expires_at)}`
                      : ""}
                  </p>
                </div>
                {document.file_url ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === document.id}
                    onClick={() => void openDocument(document.id)}
                  >
                    Abrir
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busyId === document.id}
                  title="Remover"
                  onClick={() => void removeDocument(document.id)}
                >
                  <Plus size={14} className="rotate-45" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ObligationDialog
        open={addingObligation}
        onOpenChange={setAddingObligation}
        householdId={householdId}
        link={link}
        members={members}
        subject={subject}
      />
      <DocumentDialog
        open={addingDocument}
        onOpenChange={setAddingDocument}
        householdId={householdId}
        link={link}
        subject={subject}
      />
    </div>
  );
}

function ObligationDialog({
  open,
  onOpenChange,
  householdId,
  link,
  members,
  subject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  link: LayerLink;
  members: RadarMember[];
  subject: string;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ObligationKind>("revisao");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<ObligationFrequency>("yearly");
  const [nextDue, setNextDue] = useState("");
  const [memberId, setMemberId] = useState("none");

  async function submit() {
    if (!householdId) {
      toast.error("Monte a casa primeiro.");
      return;
    }
    if (!title.trim()) {
      toast.error("Dê um título ao compromisso.");
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
          next_due: nextDue,
          vehicle_id: link.vehicle_id ?? null,
          pet_id: link.pet_id ?? null,
          responsible_member_id: memberId === "none" ? null : memberId,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("No radar", { description: "Os próximos 12 meses já foram projetados." });
      setTitle("");
      setAmount("");
      setNextDue("");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Novo compromisso</DialogTitle>
          <DialogDescription>
            Fica ligado a este {subject} e aparece no radar da casa.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="layer-obl-title">Título</Label>
            <Input
              id="layer-obl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Revisão dos 30 mil km, vacina da raiva"
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
            <Label htmlFor="layer-obl-amount">Valor (opcional)</Label>
            <Input
              id="layer-obl-amount"
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
          <div className="space-y-1.5">
            <Label htmlFor="layer-obl-due">Primeiro vencimento</Label>
            <Input
              id="layer-obl-due"
              type="date"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
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

function DocumentDialog({
  open,
  onOpenChange,
  householdId,
  link,
  subject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  link: LayerLink;
  subject: string;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("apolice");
  const [expiresAt, setExpiresAt] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function pickFile(file: File | null) {
    if (!file) return;
    const safe = file.name.replace(/[^\w.-]+/g, "_").slice(0, 60);
    const path = `${householdId}/docs/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage
      .from("documents")
      .upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (error) {
      toast.error("Não deu para guardar o arquivo", { description: error.message });
      return;
    }
    setFileUrl(path);
    setFileName(file.name);
  }

  async function submit() {
    if (!householdId) {
      toast.error("Monte a casa primeiro.");
      return;
    }
    if (!title.trim()) {
      toast.error("Dê um título ao documento.");
      return;
    }
    setBusy(true);
    try {
      await createDocument({
        data: {
          household_id: householdId,
          title,
          category,
          vehicle_id: link.vehicle_id ?? null,
          pet_id: link.pet_id ?? null,
          expires_at: expiresAt || null,
          file_url: fileUrl,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Guardado no cofre");
      setTitle("");
      setExpiresAt("");
      setFileUrl(null);
      setFileName(null);
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
          <DialogTitle className="font-display text-2xl">Guardar papel</DialogTitle>
          <DialogDescription>
            Fica ligado a este {subject} e ao cofre da casa, com a validade à vista.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="layer-doc-title">Título</Label>
            <Input
              id="layer-doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Apólice do carro, carteira de vacinação"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="layer-doc-expires">Validade (opcional)</Label>
            <Input
              id="layer-doc-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="layer-doc-file">Arquivo</Label>
            <Input
              id="layer-doc-file"
              type="file"
              onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
            />
            {fileName ? (
              <p className="text-xs text-tranquilo-foreground">
                Guardado: {fileName}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sem arquivo também serve — o que vale é o título e a data.
              </p>
            )}
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
