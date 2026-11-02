import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { parseAmount } from "@/lib/format";
import type { Asset, Room } from "@/lib/types";
import { createAsset, updateAsset, type AssetInput } from "@/lib/writes";

export const ASSET_CATEGORIES = [
  { value: "eletrodomestico", label: "Eletrodoméstico" },
  { value: "eletronico", label: "Eletrônico" },
  { value: "instalacao", label: "Instalação" },
  { value: "movel", label: "Móvel" },
  { value: "ferramenta", label: "Ferramenta" },
  { value: "seguranca", label: "Segurança" },
  { value: "outro", label: "Outro" },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.map((c) => [c.value, c.label]),
);

function emptyForm(householdId: string, roomId: string | null): AssetInput {
  return {
    household_id: householdId,
    room_id: roomId,
    name: "",
    category: "outro",
    brand: "",
    model: "",
    serial: "",
    purchase_date: "",
    purchase_price: null,
    store: "",
    warranty_expires: "",
    extended_warranty_expires: "",
    useful_life_months: null,
    photo_url: null,
    notes: "",
  };
}

function fromAsset(asset: Asset, fallbackRoom: string | null): AssetInput {
  return {
    household_id: asset.household_id,
    room_id: asset.room_id ?? fallbackRoom,
    name: asset.name,
    category: asset.category,
    brand: asset.brand ?? "",
    model: asset.model ?? "",
    serial: asset.serial ?? "",
    purchase_date: asset.purchase_date ?? "",
    purchase_price: asset.purchase_price,
    store: asset.store ?? "",
    warranty_expires: asset.warranty_expires ?? "",
    extended_warranty_expires: asset.extended_warranty_expires ?? "",
    useful_life_months: asset.useful_life_months,
    photo_url: asset.photo_url,
    notes: asset.notes ?? "",
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  rooms: Room[];
  defaultRoomId?: string | null;
  asset?: Asset | null;
}

/** A ficha do objeto: criação e edição, com foto guardada no cofre da casa. */
export function AssetForm({
  open,
  onOpenChange,
  householdId,
  rooms,
  defaultRoomId,
  asset,
}: Props) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<AssetInput>(() =>
    emptyForm(householdId, defaultRoomId ?? null),
  );
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoLabel, setPhotoLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(asset ? fromAsset(asset, defaultRoomId ?? null) : emptyForm(householdId, defaultRoomId ?? null));
    setPhotoPath(asset?.photo_url ?? null);
    setPhotoLabel(asset?.photo_url ? asset.photo_url.split("/").pop() ?? null : null);
  }, [open, asset, householdId, defaultRoomId]);

  function set<K extends keyof AssetInput>(key: K, value: AssetInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function pickPhoto(file: File | null) {
    if (!file) return;
    const safe = file.name.replace(/[^\w.-]+/g, "_").slice(0, 60);
    const path = `${householdId}/photos/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage
      .from("documents")
      .upload(path, file, { contentType: file.type || "image/jpeg" });
    if (error) {
      toast.error("Não deu para guardar a foto", { description: error.message });
      return;
    }
    setPhotoPath(path);
    setPhotoLabel(file.name);
    set("photo_url", path);
  }

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Dê um nome ao objeto.");
      return;
    }
    setBusy(true);
    try {
      if (asset) {
        await updateAsset({ data: { assetId: asset.id, ...form } });
      } else {
        await createAsset({ data: form });
      }
      await queryClient.invalidateQueries();
      toast.success(asset ? "Ficha atualizada" : "Objeto registrado", {
        description: "A ficha viva já guarda o que você contou.",
      });
      onOpenChange(false);
    } catch (error) {
      toast.error("Não foi possível salvar", {
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
          <DialogTitle className="font-display text-2xl">
            {asset ? "Editar a ficha" : "Registrar um objeto"}
          </DialogTitle>
          <DialogDescription>
            Só o essencial já basta. O resto você preenche quando quiser.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="asset-name">O que é?</Label>
            <Input
              id="asset-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Geladeira da cozinha"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={form.category}
              onValueChange={(v) => set("category", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Onde fica</Label>
            <Select
              value={form.room_id ?? "none"}
              onValueChange={(v) => set("room_id", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem cômodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem cômodo</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-brand">Marca</Label>
            <Input
              id="asset-brand"
              value={form.brand ?? ""}
              onChange={(e) => set("brand", e.target.value)}
              placeholder="Ex.: Brastemp"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-model">Modelo</Label>
            <Input
              id="asset-model"
              value={form.model ?? ""}
              onChange={(e) => set("model", e.target.value)}
              placeholder="Ex.: BRM49"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-serial">Nº de série</Label>
            <Input
              id="asset-serial"
              value={form.serial ?? ""}
              onChange={(e) => set("serial", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-store">Onde comprou</Label>
            <Input
              id="asset-store"
              value={form.store ?? ""}
              onChange={(e) => set("store", e.target.value)}
              placeholder="Ex.: Magalu"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-date">Comprou em</Label>
            <Input
              id="asset-date"
              type="date"
              value={form.purchase_date ?? ""}
              onChange={(e) => set("purchase_date", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-price">Pagou quanto?</Label>
            <Input
              id="asset-price"
              inputMode="decimal"
              value={form.purchase_price ?? ""}
              onChange={(e) => set("purchase_price", parseAmount(e.target.value))}
              placeholder="Ex.: 4200"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-warranty">Garantia vence</Label>
            <Input
              id="asset-warranty"
              type="date"
              value={form.warranty_expires ?? ""}
              onChange={(e) => set("warranty_expires", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-extended">Garantia estendida vence</Label>
            <Input
              id="asset-extended"
              type="date"
              value={form.extended_warranty_expires ?? ""}
              onChange={(e) => set("extended_warranty_expires", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="asset-life">Vida útil esperada (meses)</Label>
            <Input
              id="asset-life"
              inputMode="numeric"
              value={form.useful_life_months ?? ""}
              onChange={(e) => set("useful_life_months", parseAmount(e.target.value))}
              placeholder="Ex.: 120"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="asset-photo">Foto do objeto</Label>
            <Input
              id="asset-photo"
              type="file"
              accept="image/*"
              onChange={(e) => void pickPhoto(e.target.files?.[0] ?? null)}
            />
            {photoPath ? (
              <p className="text-xs text-muted-foreground">
                Guardada no cofre: {photoLabel ?? "foto"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Uma foto ajuda a reconhecer o objeto na hora da dúvida.
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="asset-notes">Anotações</Label>
            <Textarea
              id="asset-notes"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="O que vale lembrar sobre esse objeto?"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Deixar para depois
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Um instante…" : asset ? "Salvar a ficha" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
