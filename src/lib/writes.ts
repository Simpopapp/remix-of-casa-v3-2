// Server functions de escrita — sempre com middleware de autenticação.
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { resolveAssetEventTarget } from "@/lib/capture-target";
import { primaryHousehold } from "@/lib/queries";
import { nextDueAfter, occurrenceDates } from "@/lib/recurrence";

import type {
  Asset,
  CaptureExtract,
  ChatCitation,
  DocumentItem,
  Household,
  LayerKey,
  MemberRole,
  Pet,

  Plant,
  Provider,
  Vehicle,
} from "@/lib/types";


export const createHousehold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      input as { name: string; kind: string; address?: string | null },
  )
  .handler(async ({ data, context }): Promise<Household> => {
    const { supabase, userId } = context;
    const name = data.name?.trim();
    if (!name) throw new Error("O lar precisa de um nome.");

    // Atômico: cria o lar e já registra o criador como owner.
    // (Um INSERT com RETURNING falha em RLS enquanto o criador ainda não é
    // membro — por isso a função no banco.)
    const { data: household, error } = await supabase.rpc("create_household", {
      _name: name,
      _kind: data.kind || "casa",
      ...(data.address ? { _address: data.address } : {}),
    });

    if (error) throw new Error(error.message);
    if (!household) throw new Error("Não foi possível criar o lar.");
    const created = (Array.isArray(household) ? household[0] : household) as unknown as Household;
    if (!created) throw new Error("Não foi possível criar o lar.");
    void userId;
    return created;
  });

export interface RoomInput {
  name: string;
  kind: string;
  kind_area: string;
  layout: { x: number; y: number; w: number; h: number };
}

/** Salva de uma vez os cômodos montados no construtor da planta. */
export const saveRooms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      input as { household_id: string; rooms: RoomInput[] },
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const rooms = (data.rooms ?? []).filter((r) => r.name?.trim());
    if (rooms.length === 0) return [];

    const { data: inserted, error } = await supabase
      .from("rooms")
      .insert(
        rooms.map((r, i) => ({
          household_id: data.household_id,
          name: r.name.trim(),
          kind: r.kind,
          kind_area: r.kind_area as "interna" | "externa" | "garagem",
          sort_order: i,
          layout: r.layout,
        })),
      )
      .select("id");

    if (error) throw new Error(error.message);
    return inserted ?? [];
  });

/** Reposiciona ou redimensiona um cômodo existente. */
export const updateRoomLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      input as { roomId: string; layout: { x: number; y: number; w: number; h: number } },
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("rooms")
      .update({ layout: data.layout })
      .eq("id", data.roomId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove um cômodo e desvincula o que estava nele. */
export const deleteRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { roomId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Desvincula antes de apagar: nada de ativo, obrigação ou documento perde o lugar.
    await supabase.from("assets").update({ room_id: null }).eq("room_id", data.roomId);
    await supabase.from("obligations").update({ room_id: null }).eq("room_id", data.roomId);
    await supabase.from("documents").update({ room_id: null }).eq("room_id", data.roomId);
    const { error } = await supabase.from("rooms").delete().eq("id", data.roomId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Fichas vivas: os objetos da casa ────────────────────────────────────────

export interface AssetInput {
  household_id: string;
  room_id?: string | null;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  store?: string | null;
  warranty_expires?: string | null;
  extended_warranty_expires?: string | null;
  useful_life_months?: number | null;
  photo_url?: string | null;
  notes?: string | null;
}

function assetValues(input: AssetInput) {
  return {
    household_id: input.household_id,
    room_id: input.room_id ?? null,
    name: input.name.trim(),
    category: input.category || "outro",
    brand: input.brand?.trim() || null,
    model: input.model?.trim() || null,
    serial: input.serial?.trim() || null,
    purchase_date: input.purchase_date || null,
    purchase_price: input.purchase_price ?? null,
    store: input.store?.trim() || null,
    warranty_expires: input.warranty_expires || null,
    extended_warranty_expires: input.extended_warranty_expires || null,
    useful_life_months: input.useful_life_months ?? null,
    photo_url: input.photo_url ?? null,
    notes: input.notes?.trim() || null,
  };
}

export const createAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as AssetInput)
  .handler(async ({ data, context }): Promise<Asset> => {
    const { supabase } = context;
    if (!data.name?.trim()) throw new Error("O objeto precisa de um nome.");
    const { data: created, error } = await supabase
      .from("assets")
      .insert(assetValues(data))
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Não foi possível registrar o objeto.");
    return created as unknown as Asset;
  });

export const updateAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { assetId: string } & AssetInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.name?.trim()) throw new Error("O objeto precisa de um nome.");
    const { error } = await supabase
      .from("assets")
      .update(assetValues(data))
      .eq("id", data.assetId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { assetId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("assets").delete().eq("id", data.assetId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface AssetEventInput {
  asset_id: string;
  kind: string;
  date: string;
  description: string;
  cost?: number | null;
  provider_id?: string | null;
}

/** Registra o que foi feito no objeto — a memória que a ficha viva guarda. */
export const addAssetEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as AssetEventInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.description?.trim()) throw new Error("Conte o que aconteceu com o objeto.");
    const { error } = await supabase.from("asset_events").insert({
      asset_id: data.asset_id,
      kind: (data.kind || "observacao") as "manutencao" | "observacao" | "reparo" | "substituicao",
      date: data.date,
      description: data.description.trim(),
      cost: data.cost ?? null,
      provider_id: data.provider_id ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Prestadores com memória ─────────────────────────────────────────────────

export interface ProviderInput {
  household_id: string;
  name: string;
  specialty?: string | null;
  phone?: string | null;
  trusted?: boolean;
  notes?: string | null;
}

function providerValues(input: ProviderInput) {
  return {
    household_id: input.household_id,
    name: input.name.trim(),
    specialty: input.specialty?.trim() || null,
    phone: input.phone?.trim() || null,
    trusted: input.trusted ?? false,
    notes: input.notes?.trim() || null,
  };
}

export const createProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as ProviderInput)
  .handler(async ({ data, context }): Promise<Provider> => {
    const { supabase } = context;
    if (!data.name?.trim()) throw new Error("O prestador precisa de um nome.");
    const { data: created, error } = await supabase
      .from("providers")
      .insert(providerValues(data))
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Não foi possível registrar o prestador.");
    return created as unknown as Provider;
  });

export const updateProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { providerId: string } & ProviderInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.name?.trim()) throw new Error("O prestador precisa de um nome.");
    const { error } = await supabase
      .from("providers")
      .update(providerValues(data))
      .eq("id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { providerId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("providers")
      .delete()
      .eq("id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface ProviderServiceInput {
  provider_id: string;
  asset_id?: string | null;
  date: string;
  description: string;
  cost?: number | null;
  rating?: number | null;
  would_hire_again?: boolean | null;
  notes?: string | null;
}

/** Um serviço prestado: o que foi feito, quanto custou e se vale chamar de novo. */
export const recordProviderService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as ProviderServiceInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.description?.trim()) throw new Error("Conte qual foi o serviço.");
    const { error } = await supabase.from("provider_services").insert({
      provider_id: data.provider_id,
      asset_id: data.asset_id ?? null,
      date: data.date,
      description: data.description.trim(),
      cost: data.cost ?? null,
      rating: data.rating ?? null,
      would_hire_again: data.would_hire_again ?? null,
      notes: data.notes?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Cofre ───────────────────────────────────────────────────────────────────

export interface DocumentInput {
  household_id: string;
  title: string;
  category: string;
  room_id?: string | null;
  asset_id?: string | null;
  vehicle_id?: string | null;
  pet_id?: string | null;
  expires_at?: string | null;

  file_url?: string | null;
  notes?: string | null;
}

export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as DocumentInput)
  .handler(async ({ data, context }): Promise<DocumentItem> => {
    const { supabase } = context;
    if (!data.title?.trim()) throw new Error("O documento precisa de um título.");
    const { data: created, error } = await supabase
      .from("documents")
      .insert({
        household_id: data.household_id,
        title: data.title.trim(),
        category: data.category || "outro",
        room_id: data.room_id ?? null,
        asset_id: data.asset_id ?? null,
        vehicle_id: data.vehicle_id ?? null,
        pet_id: data.pet_id ?? null,
        expires_at: data.expires_at || null,

        file_url: data.file_url ?? null,
        notes: data.notes?.trim() || null,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Não foi possível guardar o documento.");
    return created as unknown as DocumentItem;
  });

/** Apaga o papel do cofre e o arquivo que estava guardado com ele. */
export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { documentId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: doc, error: fErr } = await supabase
      .from("documents")
      .select("file_url")
      .eq("id", data.documentId)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (doc?.file_url) {
      await supabase.storage.from("documents").remove([doc.file_url]);
    }
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Radar temporal: obrigações e ocorrências ────────────────────────────────

export interface ObligationInput {
  household_id: string;
  title: string;
  kind: string;
  amount?: number | null;
  frequency: string;
  custom_interval_days?: number | null;
  next_due: string;
  room_id?: string | null;
  asset_id?: string | null;
  vehicle_id?: string | null;
  pet_id?: string | null;
  responsible_member_id?: string | null;

  auto_renew?: boolean;
  notes?: string | null;
}

function obligationValues(input: ObligationInput) {
  return {
    household_id: input.household_id,
    title: input.title.trim(),
    kind: (input.kind || "outro") as
      | "conta" | "tributo" | "seguro" | "revisao" | "vacina" | "contrato" | "outro",
    amount: input.amount ?? null,
    frequency: (input.frequency || "one_time") as
      | "one_time" | "monthly" | "quarterly" | "semiannual" | "yearly" | "custom",
    custom_interval_days: input.custom_interval_days ?? null,
    next_due: input.next_due,
    room_id: input.room_id ?? null,
    asset_id: input.asset_id ?? null,
    vehicle_id: input.vehicle_id ?? null,
    pet_id: input.pet_id ?? null,
    responsible_member_id: input.responsible_member_id ?? null,

    auto_renew: input.auto_renew ?? false,
    notes: input.notes?.trim() || null,
  };
}

/**
 * Garante que a obrigação tem ocorrências pelos próximos 12 meses.
 * Idempotente: o índice único (obligation_id, due_date) segura repetições.
 */
async function ensureOccurrencesFor(
  supabase: SupabaseClient<Database>,
  obligationId: string,
): Promise<void> {
  const { data: obligation, error } = await supabase
    .from("obligations")
    .select("id, next_due, frequency, custom_interval_days")
    .eq("id", obligationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!obligation?.next_due) return;

  const until = new Date();
  until.setMonth(until.getMonth() + 12);
  const wanted = occurrenceDates({
    nextDue: obligation.next_due,
    frequency: obligation.frequency,
    customIntervalDays: obligation.custom_interval_days,
    until,
  });
  if (wanted.length === 0) return;

  const { error: insErr } = await supabase
    .from("obligation_occurrences")
    .upsert(
      wanted.map((due_date) => ({ obligation_id: obligationId, due_date })),
      { onConflict: "obligation_id,due_date", ignoreDuplicates: true },
    );
  if (insErr) throw new Error(insErr.message);
}

/** Preenche as ocorrências dos próximos 12 meses de todas as obrigações do lar. */
export const ensureRadarOccurrences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { household_id: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: obligations, error } = await supabase
      .from("obligations")
      .select("id")
      .eq("household_id", data.household_id)
      .not("next_due", "is", null);
    if (error) throw new Error(error.message);
    for (const o of obligations ?? []) {
      await ensureOccurrencesFor(supabase, o.id);
    }
    return { ok: true, count: (obligations ?? []).length };
  });

export const createObligation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as ObligationInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.title?.trim()) throw new Error("A obrigação precisa de um título.");
    if (!data.next_due) throw new Error("Diga quando vence a primeira vez.");
    const { data: created, error } = await supabase
      .from("obligations")
      .insert(obligationValues(data))
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Não foi possível criar a obrigação.");
    await ensureOccurrencesFor(supabase, created.id);
    return { ok: true, id: created.id };
  });

export const updateObligation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { obligationId: string } & ObligationInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.title?.trim()) throw new Error("A obrigação precisa de um título.");
    const { error } = await supabase
      .from("obligations")
      .update(obligationValues(data))
      .eq("id", data.obligationId);
    if (error) throw new Error(error.message);
    await ensureOccurrencesFor(supabase, data.obligationId);
    return { ok: true };
  });

export const deleteObligation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { obligationId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("obligations")
      .delete()
      .eq("id", data.obligationId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Marca uma ocorrência como paga/feita. Se a obrigação se repete, o próximo
 * vencimento avança e a ocorrência seguinte já nasce no radar.
 */
export const completeOccurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      input as { occurrenceId: string; status?: "pago" | "feito"; amountPaid?: number | null },
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: occurrence, error } = await supabase
      .from("obligation_occurrences")
      .select("id, obligation_id, due_date")
      .eq("id", data.occurrenceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!occurrence) throw new Error("Ocorrência não encontrada.");

    const { error: upErr } = await supabase
      .from("obligation_occurrences")
      .update({
        status: data.status === "feito" ? "feito" : "pago",
        paid_at: new Date().toISOString(),
        amount_paid: data.amountPaid ?? null,
      })
      .eq("id", data.occurrenceId);
    if (upErr) throw new Error(upErr.message);

    const { data: obligation, error: oErr } = await supabase
      .from("obligations")
      .select("id, frequency, custom_interval_days")
      .eq("id", occurrence.obligation_id)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);

    if (obligation && obligation.frequency !== "one_time") {
      const next = nextDueAfter(
        occurrence.due_date,
        obligation.frequency,
        obligation.custom_interval_days,
      );
      if (next) {
        const { error: nErr } = await supabase
          .from("obligations")
          .update({ next_due: next })
          .eq("id", obligation.id);
        if (nErr) throw new Error(nErr.message);
        await ensureOccurrencesFor(supabase, obligation.id);
      }
    }
    return { ok: true };
  });

/** Desfaz um "pago" feito por engano. */
export const reopenOccurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { occurrenceId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("obligation_occurrences")
      .update({ status: "pendente", paid_at: null, amount_paid: null })
      .eq("id", data.occurrenceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Captura sem atrito: foto ou frase → proposta da IA → confirmação ────────

/** Guarda a captura crua (texto ou foto já enviada ao cofre) na fila. */
export const createCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      input as {
        household_id: string;
        kind: "foto" | "texto";
        raw_text?: string | null;
        image_url?: string | null;
      },
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.kind === "texto" && !data.raw_text?.trim()) {
      throw new Error("Escreva algo para a casa entender.");
    }
    if (data.kind === "foto" && !data.image_url) {
      throw new Error("A foto não chegou — tente enviar de novo.");
    }
    const { data: created, error } = await supabase
      .from("captures")
      .insert({
        household_id: data.household_id,
        kind: data.kind,
        raw_text: data.raw_text?.trim() || null,
        image_url: data.image_url ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Não foi possível guardar a captura.");
    return { ok: true, id: created.id };
  });

/**
 * A IA lê a captura e propõe um registro estruturado. A proposta fica salva
 * em ai_extract — nada é gravado de verdade até a pessoa confirmar.
 */
export const processCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { captureId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: capture, error } = await supabase
      .from("captures")
      .select("*")
      .eq("id", data.captureId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!capture) throw new Error("Captura não encontrada.");

    await supabase
      .from("captures")
      .update({ ai_status: "processando" })
      .eq("id", capture.id);

    try {
      const { extractFromImage, extractFromText } = await import(
        "@/lib/ai-gateway.server"
      );
      let extract;
      if (capture.kind === "foto" && capture.image_url) {
        const { data: file, error: dErr } = await supabase.storage
          .from("documents")
          .download(capture.image_url);
        if (dErr || !file) throw new Error("Não consegui abrir a foto guardada.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        extract = await extractFromImage(bytes, file.type || "image/jpeg");
      } else if (capture.raw_text) {
        extract = await extractFromText(capture.raw_text);
      } else {
        throw new Error("Captura sem conteúdo para ler.");
      }

      const { error: upErr } = await supabase
        .from("captures")
        .update({ ai_status: "pronto", ai_extract: extract })
        .eq("id", capture.id);
      if (upErr) throw new Error(upErr.message);
      return { ok: true, extract };
    } catch (err) {
      await supabase
        .from("captures")
        .update({ ai_status: "erro" })
        .eq("id", capture.id);
      throw err instanceof Error ? err : new Error("A IA não conseguiu ler dessa vez.");
    }
  });

/**
 * Aplica a proposta (já editada pela pessoa): cria o registro de verdade no
 * lugar certo e tira a captura da fila.
 */
export const applyCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      input as {
        captureId: string;
        household_id: string;
        extract: CaptureExtract;
        room_id?: string | null;
        asset_id?: string | null;
        asset_name?: string | null;
      },
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ex = data.extract;
    if (!ex.title?.trim()) throw new Error("A ficha precisa de um título.");

    if (ex.kind === "asset") {
      const { error } = await supabase.from("assets").insert({
        household_id: data.household_id,
        room_id: data.room_id ?? null,
        name: ex.title.trim(),
        category: ex.category || "outro",
        brand: ex.brand,
        model: ex.model,
        serial: ex.serial,
        purchase_date: ex.purchase_date,
        purchase_price: ex.purchase_price,
        store: ex.store,
        warranty_expires: ex.warranty_expires,
        notes: ex.summary,
      });
      if (error) throw new Error(error.message);
    } else if (ex.kind === "document") {
      const { error } = await supabase.from("documents").insert({
        household_id: data.household_id,
        room_id: data.room_id ?? null,
        asset_id: data.asset_id ?? null,
        title: ex.title.trim(),
        category: ex.doc_category || "outro",
        expires_at: ex.expires_at,
        notes: ex.summary,
      });
      if (error) throw new Error(error.message);
    } else if (ex.kind === "obligation") {
      if (!ex.next_due) throw new Error("Diga quando vence a primeira vez.");
      const { data: created, error } = await supabase
        .from("obligations")
        .insert({
          household_id: data.household_id,
          title: ex.title.trim(),
          kind: "outro",
          amount: ex.amount,
          frequency: ex.frequency ?? "one_time",
          next_due: ex.next_due,
          room_id: data.room_id ?? null,
          notes: ex.summary,
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (created) await ensureOccurrencesFor(supabase, created.id);
    } else if (ex.kind === "expense") {
      if (ex.amount == null) throw new Error("Diga quanto foi o gasto.");
      const { error } = await supabase.from("expenses").insert({
        household_id: data.household_id,
        room_id: data.room_id ?? null,
        asset_id: data.asset_id ?? null,
        category: ex.category || "outro",
        amount: ex.amount,
        date: ex.expense_date || new Date().toISOString().slice(0, 10),
        kind: "variavel",
        description: ex.title.trim(),
      });
      if (error) throw new Error(error.message);
    } else if (ex.kind === "asset_event") {
      const target = resolveAssetEventTarget({
        assetId: data.asset_id,
        typedName: data.asset_name,
        extractName: ex.asset_name,
      });
      if (!target.ok) throw new Error(target.error);

      let assetId = target.assetId;
      if (!assetId) {
        const name = target.assetName ?? "";
        if (!name) throw new Error("Diga a qual objeto isso aconteceu.");
        const { data: createdAsset, error: createErr } = await supabase
          .from("assets")
          .insert({
            household_id: data.household_id,
            room_id: data.room_id ?? null,
            name,
            category: ex.category || "outro",
            notes: "Criado a partir de uma captura rápida.",
          })
          .select("id")
          .maybeSingle();
        if (createErr) throw new Error(createErr.message);
        if (!createdAsset) throw new Error("Não foi possível cadastrar o objeto.");
        assetId = createdAsset.id;
      }

      const { error } = await supabase.from("asset_events").insert({
        asset_id: assetId,
        kind: ex.event_kind ?? "observacao",
        date: ex.event_date || new Date().toISOString().slice(0, 10),
        description: ex.summary || ex.title.trim(),
        cost: ex.cost,
      });
      if (error) throw new Error(error.message);
    } else {
      throw new Error("A IA não entendeu essa captura — descarte ou tente de novo.");
    }

    const { error: upErr } = await supabase
      .from("captures")
      .update({ review_status: "aplicado" })
      .eq("id", data.captureId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

/** Tira a captura da fila sem criar registro. */
export const discardCapture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { captureId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("captures")
      .update({ review_status: "descartado" })
      .eq("id", data.captureId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Zelador digital ────────────────────────────────────────────────────────

type ChatInsert = Database["public"]["Tables"]["chat_messages"]["Insert"];

const zeladorSystem = (householdName: string) => `Você é o zelador de "${householdName}", o
assistente que conhece os registros reais desta casa brasileira. Hoje é ${
  new Date().toISOString().slice(0, 10)
}.

Regras:
- Antes de afirmar qualquer número, data ou item, consulte uma ferramenta. Se nada
  voltar, diga com calma que não encontrou — nunca invente valor, objeto ou histórico.
- Some e compare você mesmo quando a pergunta pedir mais de uma consulta.
- Fale português simples e humano, em frases curtas. Dinheiro em reais (R$).
- Se não souber de qual cômodo ou objeto a pessoa fala, pergunte uma frase só, sem rodeios.
- Não repita a pergunta de volta nem announce as ferramentas que usou.`;

/** Pergunta do zelador: consulta o lar, responde citando as fichas que usou. */
export const askZelador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { question: string })
  .handler(async ({ data, context }): Promise<{ answer: string; citations: ChatCitation[] }> => {
    const question = data.question?.trim();
    if (!question) throw new Error("Escreva sua pergunta.");

    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) throw new Error("Monte sua casa antes de falar com o zelador.");

    const { data: membership } = await context.supabase
      .from("household_members")
      .select("id")
      .eq("household_id", household.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    const { data: history, error: hErr } = await context.supabase
      .from("chat_messages")
      .select("role, content")
      .eq("household_id", household.id)
      .order("created_at", { ascending: false })
      .limit(12);
    if (hErr) throw new Error(hErr.message);

    const { buildZeladorTools } = await import("@/lib/zelador-tools.server");
    const { askHouseholdAssistant } = await import("@/lib/ai-gateway.server");

    const citations: ChatCitation[] = [];
    const answer = await askHouseholdAssistant({
      system: zeladorSystem(household.name),
      messages: [
        ...(history ?? [])
          .slice()
          .reverse()
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: question },
      ],
      tools: buildZeladorTools({
        supabase: context.supabase,
        householdId: household.id,
        citations,
      }),
    });

    const memberId = membership?.id ?? null;
    const rows: ChatInsert[] = [
      { household_id: household.id, member_id: memberId, role: "user", content: question },
      {
        household_id: household.id,
        member_id: memberId,
        role: "assistant",
        content: answer,
        citations: citations as unknown as NonNullable<ChatInsert["citations"]>,
      },
    ];
    const { error: insErr } = await context.supabase.from("chat_messages").insert(rows);
    if (insErr) throw new Error(insErr.message);

    return { answer, citations };
  });

// ─── Camadas de vida: veículos, pets e jardim ────────────────────────────────

export interface VehicleInput {
  household_id: string;
  name: string;
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  purchase_date?: string | null;
  odometer?: number | null;
}

function vehicleValues(input: VehicleInput) {
  return {
    household_id: input.household_id,
    name: input.name.trim(),
    plate: input.plate?.trim().toUpperCase() || null,
    brand: input.brand?.trim() || null,
    model: input.model?.trim() || null,
    year: input.year ?? null,
    purchase_date: input.purchase_date || null,
    odometer: input.odometer ?? null,
  };
}

export const createVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as VehicleInput)
  .handler(async ({ data, context }): Promise<Vehicle> => {
    const { supabase } = context;
    if (!data.name?.trim()) throw new Error("O veículo precisa de um nome.");
    const { data: created, error } = await supabase
      .from("vehicles")
      .insert(vehicleValues(data))
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Não foi possível registrar o veículo.");
    return created as unknown as Vehicle;
  });

export const updateVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { vehicleId: string } & VehicleInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.name?.trim()) throw new Error("O veículo precisa de um nome.");
    const { error } = await supabase
      .from("vehicles")
      .update(vehicleValues(data))
      .eq("id", data.vehicleId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Tira o veículo da casa. O que estava ligado a ele não some: obrigações e
 * documentos perdem só o vínculo (as duas chaves estrangeiras são SET NULL).
 */
export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { vehicleId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("vehicles").delete().eq("id", data.vehicleId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface PetInput {
  household_id: string;
  name: string;
  species?: string | null;
  breed?: string | null;
  birthdate?: string | null;
  weight_kg?: number | null;
  photo_url?: string | null;
}

function petValues(input: PetInput) {
  return {
    household_id: input.household_id,
    name: input.name.trim(),
    species: input.species?.trim() || null,
    breed: input.breed?.trim() || null,
    birthdate: input.birthdate || null,
    weight_kg: input.weight_kg ?? null,
    photo_url: input.photo_url ?? null,
  };
}

export const createPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as PetInput)
  .handler(async ({ data, context }): Promise<Pet> => {
    const { supabase } = context;
    if (!data.name?.trim()) throw new Error("O pet precisa de um nome.");
    const { data: created, error } = await supabase
      .from("pets")
      .insert(petValues(data))
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Não foi possível registrar o pet.");
    return created as unknown as Pet;
  });

export const updatePet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { petId: string } & PetInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.name?.trim()) throw new Error("O pet precisa de um nome.");
    const { error } = await supabase.from("pets").update(petValues(data)).eq("id", data.petId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { petId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("pets").delete().eq("id", data.petId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface PlantInput {
  household_id: string;
  name: string;
  location?: string | null;
  watering_interval_days?: number | null;
  last_watered?: string | null;
}

function plantValues(input: PlantInput) {
  return {
    household_id: input.household_id,
    name: input.name.trim(),
    location: input.location?.trim() || null,
    watering_interval_days: input.watering_interval_days ?? null,
    last_watered: input.last_watered || null,
  };
}

export const createPlant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as PlantInput)
  .handler(async ({ data, context }): Promise<Plant> => {
    const { supabase } = context;
    if (!data.name?.trim()) throw new Error("A planta precisa de um nome.");
    const { data: created, error } = await supabase
      .from("plants")
      .insert(plantValues(data))
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!created) throw new Error("Não foi possível registrar a planta.");
    return created as unknown as Plant;
  });

export const updatePlant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { plantId: string } & PlantInput)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (!data.name?.trim()) throw new Error("A planta precisa de um nome.");
    const { error } = await supabase
      .from("plants")
      .update(plantValues(data))
      .eq("id", data.plantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePlant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { plantId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("plants").delete().eq("id", data.plantId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Rega de hoje: marca a planta como molhada e o radar recalcula a próxima. */
export const waterPlant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { plantId: string; day?: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const day = data.day || new Date().toISOString().slice(0, 10);
    const { error } = await supabase
      .from("plants")
      .update({ last_watered: day })
      .eq("id", data.plantId);
    if (error) throw new Error(error.message);
    return { ok: true, day };
  });

/**
 * Liga ou desliga uma camada. Desligar não apaga nada: só escreve o
 * interruptor. Os veículos, pets e plantas continuam no banco.
 */
export const setLayerActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { layer: LayerKey; active: boolean })
  .handler(async ({ data, context }) => {
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) throw new Error("Monte a casa antes de ajustar as camadas.");

    const { error } = await context.supabase
      .from("household_layers")
      .upsert(
        { household_id: household.id, layer: data.layer, active: data.active },
        { onConflict: "household_id,layer" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Chamar alguém para morar na casa: e-mail, papel e até quando. */
export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    input as { email: string; role: MemberRole; expires_at: string | null },
  )
  .handler(async ({ data, context }) => {
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) throw new Error("Monte a casa antes de convidar.");
    const email = data.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Diga um e-mail completo.");
    if (data.role === "owner") throw new Error("O dono da casa é quem convida.");

    const { error } = await context.supabase.from("household_members").insert({
      household_id: household.id,
      invited_email: email,
      role: data.role,
      expires_at: data.expires_at ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ajustar o papel ou o prazo de quem já mora na casa. */
export const updateMemberAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    input as { memberId: string; role: MemberRole; expires_at: string | null },
  )
  .handler(async ({ data, context }) => {
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) throw new Error("Monte a casa antes de ajustar.");
    if (data.role === "owner") throw new Error("O dono da casa não muda por aqui.");

    const { error } = await context.supabase
      .from("household_members")
      .update({ role: data.role, expires_at: data.expires_at ?? null })
      .eq("id", data.memberId)
      .eq("household_id", household.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Tirar alguém da casa. */
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { memberId: string })
  .handler(async ({ data, context }) => {
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) throw new Error("Monte a casa antes de remover.");

    const { error } = await context.supabase
      .from("household_members")
      .delete()
      .eq("id", data.memberId)
      .eq("household_id", household.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Quem foi convidado por e-mail vira morador ao entrar com a mesma conta.
 * Sem isso o convite fica pendurado sem dono e a pessoa não enxerga a casa.
 */
export const claimInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_invites");
    if (error) throw new Error(error.message);
    return { claimed: Number(data ?? 0) };
  });
