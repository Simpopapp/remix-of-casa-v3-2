import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { guardSession } from "@/lib/auth-guard";
import { formatDate, formatRelative } from "@/lib/format";
import {
  DOCUMENT_STATE_LABEL,
  documentState,
  sortByUrgencyBy,
} from "@/lib/inventory";
import { getDocumentFileUrl, getVault } from "@/lib/queries";
import { createDocument, deleteDocument } from "@/lib/writes";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/documentos")({
  beforeLoad: () => guardSession(),
  component: VaultPage,
  head: () => ({
    meta: [
      { title: "Cofre da casa — Casa Viva" },
      {
        name: "description",
        content:
          "Escritura, apólice, contrato, nota fiscal: tudo que a casa precisa provar, guardado no mesmo lugar e com a validade à vista.",
      },
      { property: "og:title", content: "Cofre da casa — Casa Viva" },
      {
        property: "og:description",
        content:
          "Escritura, apólice, contrato, nota fiscal: tudo que a casa precisa provar, guardado no mesmo lugar e com a validade à vista.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const DOC_CATEGORIES = [
  { value: "escritura", label: "Escritura / matrícula" },
  { value: "contrato", label: "Contrato" },
  { value: "apolice", label: "Apólice / seguro" },
  { value: "tributo", label: "Tributo (IPTU, condomínio)" },
  { value: "nota_fiscal", label: "Nota fiscal" },
  { value: "manual", label: "Manual / garantia" },
  { value: "laudo", label: "Laudo / certidão" },
  { value: "outro", label: "Outro" },
];

const DOC_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  DOC_CATEGORIES.map((c) => [c.value, c.label]),
);

const STATE_CHIP: Record<string, string> = {
  sem_validade: "border-border bg-secondary text-secondary-foreground",
  em_dia: "border-tranquilo/40 bg-tranquilo/15 text-tranquilo-foreground",
  vence_breve: "border-atencao/40 bg-atencao/15 text-atencao-foreground",
  vencido: "border-urgente/40 bg-urgente/15 text-urgente-foreground",
};

function VaultPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["vault"],
    queryFn: () => getVault(),
    staleTime: 30_000,
  });
  const queryClient = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const household = data?.household ?? null;
  const ordered = sortByUrgencyBy(data?.documents ?? [], (d) => d.document.expires_at);
  const vencidos = ordered.filter((d) => documentState(d.document).state === "vencido").length;
  const breves = ordered.filter((d) => documentState(d.document).state === "vence_breve").length;

  async function open(docId: string) {
    setBusyId(docId);
    try {
      const { url } = await getDocumentFileUrl({ data: { documentId: docId } });
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

  async function remove(docId: string) {
    setBusyId(docId);
    try {
      await deleteDocument({ data: { documentId: docId } });
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
    <div className="min-h-screen bg-background pb-16">
      <AppNav />
      <header className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-3 px-4 pt-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            O que a casa precisa provar
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
            Cofre
          </h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Escritura, apólice, contrato, nota fiscal. Guardados juntos, com a validade
            à vista — para não procurar nada às pressas.
          </p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={!household}>
          <Plus size={16} />
          Guardar documento
        </Button>
      </header>

      {vencidos + breves > 0 && (
        <div className="mx-auto mt-5 max-w-5xl px-4">
          <p className="inline-flex flex-wrap items-center gap-2 rounded-full border border-atencao/40 bg-atencao/10 px-4 py-2 text-sm text-atencao-foreground">
            {vencidos > 0 && (
              <span>
                <strong>{vencidos}</strong> {vencidos === 1 ? "papel vencido" : "papéis vencidos"}
              </span>
            )}
            {vencidos > 0 && breves > 0 && <span aria-hidden>·</span>}
            {breves > 0 && (
              <span>
                <strong>{breves}</strong> {breves === 1 ? "vence em breve" : "vencem em breve"}
              </span>
            )}
          </p>
        </div>
      )}

      <main id="conteudo" className="mx-auto max-w-5xl px-4 py-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Abrindo o cofre…</p>
        ) : !household ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma casa por aqui ainda — monte a planta para começar.
          </p>
        ) : ordered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
              O cofre está vazio
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Comece pelo que você já tem à mão: a apólice do seguro, a escritura,
              a nota fiscal do último eletrodoméstico.
            </p>
            <Button className="mt-5" onClick={() => setAdding(true)}>
              <Plus size={16} />
              Guardar o primeiro
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {ordered.map(({ document, room_name, asset_name }) => {
              const expiry = documentState(document);
              return (
                <li
                  key={document.id}
                  className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-card/70 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-semibold text-foreground">
                      {document.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {DOC_CATEGORY_LABEL[document.category] ?? document.category}
                      {room_name ? ` · ${room_name}` : ""}
                      {asset_name ? ` · ${asset_name}` : ""}
                      {document.expires_at ? ` · vence ${formatDate(document.expires_at)}` : ""}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${STATE_CHIP[expiry.state]}`}
                  >
                    {DOCUMENT_STATE_LABEL[expiry.state]}
                    {expiry.state === "vence_breve" || expiry.state === "vencido"
                      ? ` · ${formatRelative(document.expires_at)}`
                      : ""}
                  </span>

                  <div className="flex shrink-0 gap-1">
                    {document.file_url ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void open(document.id)}
                        disabled={busyId === document.id}
                      >
                        <Download size={14} />
                        Abrir
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => void remove(document.id)}
                      disabled={busyId === document.id}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <DocumentDialog
        open={adding}
        onOpenChange={setAdding}
        householdId={household?.id ?? ""}
        rooms={data?.rooms ?? []}
        assets={data?.assets ?? []}
      />
    </div>
  );
}

function DocumentDialog({
  open,
  onOpenChange,
  householdId,
  rooms,
  assets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  rooms: Array<{ id: string; name: string }>;
  assets: Array<{ id: string; name: string }>;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("outro");
  const [roomId, setRoomId] = useState("none");
  const [assetId, setAssetId] = useState("none");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
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
          room_id: roomId === "none" ? null : roomId,
          asset_id: assetId === "none" ? null : assetId,
          expires_at: expiresAt || null,
          file_url: fileUrl,
          notes,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Guardado no cofre");
      setTitle("");
      setNotes("");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Guardar documento</DialogTitle>
          <DialogDescription>
            Um papel por vez. Título e validade já bastam para o radar funcionar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="doc-title">Título</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Apólice do seguro residencial"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
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
            <Label htmlFor="doc-expires">Vencimento</Label>
            <Input
              id="doc-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Onde se encaixa</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum cômodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum cômodo</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>De qual objeto</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger>
                <SelectValue placeholder="Nenhum objeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum objeto</SelectItem>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="doc-file">Arquivo</Label>
            <Input
              id="doc-file"
              type="file"
              onChange={(e) => void pickFile(e.target.files?.[0] ?? null)}
            />
            {fileUrl ? (
              <p className="text-xs text-muted-foreground">
                Guardado: {fileName ?? "arquivo"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Dá para guardar só o título e a validade, sem arquivo.
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="doc-notes">Anotações</Label>
            <Textarea
              id="doc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Ex.: renova em fevereiro com o mesmo corretor"
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
