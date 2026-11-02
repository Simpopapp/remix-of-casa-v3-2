import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Camera,
  Check,
  Layers,
  Loader2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { guardSession } from "@/lib/auth-guard";
import { formatBRL, formatDate } from "@/lib/format";
import { getCaptureQueue } from "@/lib/queries";
import {
  applyCapture,
  createCapture,
  discardCapture,
  processCapture,
} from "@/lib/writes";
import type { Capture, CaptureExtract } from "@/lib/types";

export const Route = createFileRoute("/captura")({
  beforeLoad: () => guardSession(),
  component: CapturaPage,
  head: () => ({
    meta: [
      { title: "Captura rápida — Casa Viva" },
      {
        name: "description",
        content:
          "Fotografe a nota fiscal ou escreva uma frase — a casa entende, propõe a ficha e você só confirma.",
      },
      { property: "og:title", content: "Captura rápida — Casa Viva" },
      {
        property: "og:description",
        content:
          "Fotografe a nota fiscal ou escreva uma frase — a casa entende, propõe a ficha e você só confirma.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const KIND_LABEL: Record<CaptureExtract["kind"], string> = {
  asset: "Objeto da casa",
  document: "Documento para o cofre",
  obligation: "Obrigação no radar",
  expense: "Gasto",
  asset_event: "Acontecimento com um objeto",
  unknown: "Não entendi",
};

function CapturaPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["captures"],
    queryFn: () => getCaptureQueue(),
    staleTime: 10_000,
  });

  const household = data?.household ?? null;
  const captures = data?.captures ?? [];
  const rooms = data?.rooms ?? [];
  const assets = data?.assets ?? [];

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function sendText() {
    if (!household) {
      toast.error("Monte a casa primeiro.");
      return;
    }
    if (!text.trim()) {
      toast.error("Escreva algo para a casa entender.");
      return;
    }
    setBusy(true);
    try {
      const { id } = await createCapture({
        data: { household_id: household.id, kind: "texto", raw_text: text },
      });
      setText("");
      toast.info("A casa está lendo…", { description: "A proposta aparece na pilha em instantes." });
      await processCapture({ data: { captureId: id } });
      await queryClient.invalidateQueries({ queryKey: ["captures"] });
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: ["captures"] });
      toast.error("Não deu para entender", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoto(file: File | null) {
    if (!file || !household) return;
    setBusy(true);
    try {
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(0, 60);
      const path = `${household.id}/captures/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (upErr) throw new Error(upErr.message);

      const { id } = await createCapture({
        data: { household_id: household.id, kind: "foto", image_url: path },
      });
      toast.info("A casa está lendo a foto…", {
        description: "A proposta aparece na pilha em instantes.",
      });
      await processCapture({ data: { captureId: id } });
      await queryClient.invalidateQueries({ queryKey: ["captures"] });
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: ["captures"] });
      toast.error("Não deu para ler a foto", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <AppNav />
      <header className="mx-auto max-w-5xl px-4 pt-8">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          Sem formulário, sem atrito
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
          Captura rápida
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Fotografe a nota fiscal, a etiqueta, o boleto — ou escreva como fala:
          “troquei o filtro da geladeira hoje”. A casa propõe a ficha, você só confirma.
        </p>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Ex.: o eletricista veio e cobrou 380 pra trocar o disjuntor da cozinha"
            aria-label="Conte o que aconteceu"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void sendText()} disabled={busy || !household}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Entender isso
            </Button>
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={busy || !household}
            >
              <Camera size={16} />
              Fotografar documento
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void sendPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center gap-2">
            <Layers size={18} className="text-primary" />
            <h2 className="font-display text-2xl font-semibold text-foreground">
              Pilha de revisão
            </h2>
            {captures.length > 0 && (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                {captures.length}
              </span>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Arrumando a pilha…</p>
          ) : captures.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card/60 p-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-display text-xl font-semibold text-foreground">
                Nada esperando revisão
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Cada foto ou frase que você mandar vira uma carta aqui — revise,
                ajuste e confirme em segundos.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {captures.map((capture, i) => (
                <CaptureCard
                  key={capture.id}
                  capture={capture}
                  stackIndex={i}
                  householdId={household?.id ?? ""}
                  rooms={rooms}
                  assets={assets}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function CaptureCard({
  capture,
  stackIndex,
  householdId,
  rooms,
  assets,
}: {
  capture: Capture;
  stackIndex: number;
  householdId: string;
  rooms: Array<{ id: string; name: string }>;
  assets: Array<{ id: string; name: string }>;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const extract = (capture.ai_extract ?? null) as CaptureExtract | null;

  const [title, setTitle] = useState(extract?.title ?? "");
  const [amount, setAmount] = useState(
    extract?.amount != null
      ? String(extract.amount)
      : extract?.purchase_price != null
        ? String(extract.purchase_price)
        : extract?.cost != null
          ? String(extract.cost)
          : "",
  );
  const [date, setDate] = useState(
    extract?.next_due ?? extract?.expires_at ?? extract?.purchase_date ?? extract?.event_date ?? "",
  );
  const [roomId, setRoomId] = useState("none");
  const [assetId, setAssetId] = useState(assets.length === 0 ? "__new" : "none");
  const [newAssetName, setNewAssetName] = useState(extract?.asset_name ?? "");

  async function retry() {
    setBusy(true);
    try {
      await processCapture({ data: { captureId: capture.id } });
      await queryClient.invalidateQueries({ queryKey: ["captures"] });
    } catch (error) {
      toast.error("A IA não conseguiu ler", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!extract) return;
    setBusy(true);
    try {
      const amountNumber = amount.trim() ? Number(amount.replace(",", ".")) : null;
      const edited: CaptureExtract = {
        ...extract,
        title: title.trim() || extract.title,
        amount: extract.kind === "obligation" || extract.kind === "expense" ? amountNumber : extract.amount,
        purchase_price: extract.kind === "asset" ? amountNumber : extract.purchase_price,
        cost: extract.kind === "asset_event" ? amountNumber : extract.cost,
        next_due: extract.kind === "obligation" ? date || extract.next_due : extract.next_due,
        expires_at: extract.kind === "document" ? date || extract.expires_at : extract.expires_at,
        purchase_date: extract.kind === "asset" ? date || extract.purchase_date : extract.purchase_date,
        event_date: extract.kind === "asset_event" ? date || extract.event_date : extract.event_date,
      };
      await applyCapture({
        data: {
          captureId: capture.id,
          household_id: householdId,
          extract: edited,
          room_id: roomId === "none" ? null : roomId,
          asset_id: assetId === "none" || assetId === "__new" ? null : assetId,
          asset_name: assetId === "__new" ? newAssetName.trim() : null,
        },
      });
      await queryClient.invalidateQueries();
      toast.success("Registrado na casa", { description: edited.title });
    } catch (error) {
      toast.error("Não foi possível registrar", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    try {
      await discardCapture({ data: { captureId: capture.id } });
      await queryClient.invalidateQueries({ queryKey: ["captures"] });
      toast.success("Fora da pilha");
    } catch (error) {
      toast.error("Não foi possível descartar", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className="rounded-3xl border border-border bg-card p-5 shadow-sm"
      style={{ marginLeft: Math.min(stackIndex * 8, 24), marginRight: Math.min(stackIndex * 8, 24) }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {capture.kind === "foto" ? "Foto" : "Texto"} · {formatDate(capture.created_at)}
          </p>
          {capture.raw_text && (
            <p className="mt-1 text-sm italic text-muted-foreground">“{capture.raw_text}”</p>
          )}
        </div>
        {extract && (
          <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {KIND_LABEL[extract.kind]}
          </span>
        )}
      </div>

      {capture.ai_status === "processando" || capture.ai_status === "pendente" ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={15} className="animate-spin" />
          A casa está lendo…
        </p>
      ) : capture.ai_status === "erro" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-urgente-foreground">A leitura falhou dessa vez.</p>
          <Button size="sm" variant="outline" onClick={() => void retry()} disabled={busy}>
            Tentar de novo
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void discard()} disabled={busy}>
            <X size={14} />
            Descartar
          </Button>
        </div>
      ) : extract ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{extract.summary}</p>

          {extract.kind !== "unknown" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Título</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {extract.kind === "obligation"
                      ? "Valor previsto"
                      : extract.kind === "expense"
                        ? "Quanto foi"
                        : extract.kind === "asset_event"
                          ? "Custo"
                          : "Valor de compra"}
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {extract.kind === "obligation"
                      ? "Primeiro vencimento"
                      : extract.kind === "document"
                        ? "Validade"
                        : extract.kind === "asset_event"
                          ? "Quando aconteceu"
                          : "Data de compra"}
                  </Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cômodo</Label>
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger>
                      <SelectValue placeholder={extract.room_guess ?? "Nenhum"} />
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
                {extract.kind === "asset_event" && (
                  <div className="space-y-1.5">
                    <Label>Qual objeto</Label>
                    <Select value={assetId} onValueChange={setAssetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha o objeto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__new">
                          {extract.asset_name ? `Novo: ${extract.asset_name}` : "Novo objeto…"}
                        </SelectItem>
                        {assets.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {assetId === "__new" && (
                      <Input
                        value={newAssetName}
                        onChange={(e) => setNewAssetName(e.target.value)}
                        placeholder="Nome do objeto (ex.: Geladeira)"
                        aria-label="Nome do novo objeto"
                      />
                    )}
                  </div>
                )}
              </div>

              {extract.kind === "obligation" && extract.frequency && (
                <p className="text-xs text-muted-foreground">
                  Repetição entendida:{" "}
                  {{ one_time: "uma vez só", monthly: "todo mês", quarterly: "a cada 3 meses", semiannual: "a cada 6 meses", yearly: "uma vez por ano", custom: "intervalo personalizado" }[extract.frequency]}
                  {extract.amount != null ? ` · ${formatBRL(extract.amount)}` : ""}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void confirm()} disabled={busy}>
                  <Check size={16} />
                  Confirmar e registrar
                </Button>
                <Button variant="ghost" className="text-destructive" onClick={() => void discard()} disabled={busy}>
                  <X size={16} />
                  Descartar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Não deu para entender o que fazer com isso.
              </p>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void discard()} disabled={busy}>
                <X size={14} />
                Descartar
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
