// Server functions de leitura — nomes canônicos usados por todas as rotas.
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { buildLoadMap } from "@/lib/load-map";

import type {
  Asset,
  AssetDetail,
  AssetEventWithProvider,
  Capture,
  CaptureQueue,
  ChatCitation,
  ChatEntry,
  DocumentItem,
  EmergencyBreakerAsset,
  EmergencyKit,
  EmergencyMember,
  GardenState,
  Household,
  HouseholdLayer,
  HomeState,
  LoadMapEntry,
  MemberRow,
  MemberRole,
  MembersState,
  MomentsState,
  MoneyState,

  Obligation,
  ObligationOccurrence,
  ObligationWithOccurrences,
  Pet,
  PetDetail,
  PetsState,
  Plant,
  Provider,
  ProviderDirectory,
  ProviderServiceWithAsset,
  ProviderServiceWithProvider,
  Radar,
  RadarMember,
  RadarObligation,
  Room,
  RoomDetail,
  SearchEntry,
  SettingsState,
  Vault,
  Vehicle,
  VehicleDetail,
  VehiclesState,
  ZeladorThread,
} from "@/lib/types";


/** Estado da home: o lar primário do usuário, seus cômodos, membresia e os dados que alimentam o pulso. */
export const getHomeState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HomeState> => {
    const { supabase, userId } = context;

    const { data: memberships, error: mErr } = await supabase
      .from("household_members")
      .select("id, household_id, role, user_id, invited_email, expires_at, created_at")
      .eq("user_id", userId);

    if (mErr) throw new Error(mErr.message);
    const active = (memberships ?? []).filter(
      (m) => !m.expires_at || new Date(m.expires_at) > new Date(),
    );
    if (active.length === 0) {
      return emptyState();
    }

    const ids = active.map((m) => m.household_id);
    const { data: households, error: hErr } = await supabase
      .from("households")
      .select("*")
      .in("id", ids);

    if (hErr) throw new Error(hErr.message);
    const household = (households ?? []).sort(
      (a, b) => a.created_at.localeCompare(b.created_at),
    )[0] as unknown as HomeState["household"];
    if (!household) return emptyState();

    const membership = (active.find(
      (m) => m.household_id === household.id,
    ) ?? null) as unknown as HomeState["membership"];

    const { data: rooms, error: rErr } = await supabase
      .from("rooms")
      .select("*")
      .eq("household_id", household.id)
      .order("sort_order");

    if (rErr) throw new Error(rErr.message);

    // Dados do pulso: assets, obrigações (com ocorrências) e documentos.
    const [assetsRes, obligationsRes, docsRes] = await Promise.all([
      supabase
        .from("assets")
        .select("id, room_id, name, warranty_expires, extended_warranty_expires")
        .eq("household_id", household.id),
      supabase
        .from("obligations")
        .select(
          "id, room_id, title, kind, next_due, amount, frequency, custom_interval_days",
        )
        .eq("household_id", household.id),
      supabase
        .from("documents")
        .select("id, room_id, title, expires_at")
        .eq("household_id", household.id),
    ]);
    if (assetsRes.error) throw new Error(assetsRes.error.message);
    if (obligationsRes.error) throw new Error(obligationsRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);

    const obligationsRaw = (obligationsRes.data ?? []) as unknown as Array<{
      id: string;
      room_id: string | null;
      title: string;
      kind: string;
      next_due: string | null;
    }>;

    const oblIds = obligationsRaw.map((o) => o.id);
    let occurrences: Array<{
      obligation_id: string;
      due_date: string;
      status: string;
    }> = [];
    if (oblIds.length > 0) {
      const { data: occ, error: occErr } = await supabase
        .from("obligation_occurrences")
        .select("obligation_id, due_date, status")
        .in("obligation_id", oblIds);
      if (occErr) throw new Error(occErr.message);
      occurrences = (occ ?? []) as unknown as typeof occurrences;
    }

    const obligations: ObligationWithOccurrences[] = obligationsRaw.map((o) => ({
      ...o,
      occurrences: occurrences.filter((occ) => occ.obligation_id === o.id),
    })) as unknown as ObligationWithOccurrences[];

    return {
      household,
      rooms: (rooms ?? []) as unknown as HomeState["rooms"],
      membership,
      assets: (assetsRes.data ?? []) as unknown as HomeState["assets"],
      obligations,
      documents: (docsRes.data ?? []) as unknown as HomeState["documents"],
    };
  });

function emptyState(): HomeState {
  return { household: null, rooms: [], membership: null, assets: [], obligations: [], documents: [] };
}

/** Interior de um cômodo: a ficha do cômodo, inventário e o que alimenta seu pulso. */
export const getRoomDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { roomId: string })
  .handler(async ({ data, context }): Promise<RoomDetail> => {
    const { supabase } = context;

    const { data: room, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", data.roomId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!room) throw new Error("Cômodo não encontrado.");
    const found = room as unknown as Room;

    const [assetsRes, obligationsRes, docsRes, siblingsRes] = await Promise.all([
      supabase
        .from("assets")
        .select("*")
        .eq("room_id", found.id)
        .order("name"),
      supabase
        .from("obligations")
        .select("*")
        .eq("room_id", found.id)
        .order("next_due"),
      supabase
        .from("documents")
        .select("*")
        .eq("room_id", found.id)
        .order("title"),
      supabase
        .from("rooms")
        .select("*")
        .eq("household_id", found.household_id)
        .order("sort_order"),
    ]);
    if (assetsRes.error) throw new Error(assetsRes.error.message);
    if (obligationsRes.error) throw new Error(obligationsRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);
    if (siblingsRes.error) throw new Error(siblingsRes.error.message);

    const obligationsRaw = (obligationsRes.data ?? []) as unknown as Array<{
      id: string;
      room_id: string | null;
      title: string;
      kind: string;
      next_due: string | null;
    }>;
    const oblIds = obligationsRaw.map((o) => o.id);
    let occurrences: Array<{
      obligation_id: string;
      due_date: string;
      status: string;
    }> = [];
    if (oblIds.length > 0) {
      const { data: occ, error: occErr } = await supabase
        .from("obligation_occurrences")
        .select("obligation_id, due_date, status")
        .in("obligation_id", oblIds);
      if (occErr) throw new Error(occErr.message);
      occurrences = (occ ?? []) as unknown as typeof occurrences;
    }

    const obligations: ObligationWithOccurrences[] = obligationsRaw.map((o) => ({
      ...o,
      occurrences: occurrences.filter((occ) => occ.obligation_id === o.id),
    })) as unknown as ObligationWithOccurrences[];

    return {
      room: found,
      assets: (assetsRes.data ?? []) as unknown as RoomDetail["assets"],
      obligations,
      documents: (docsRes.data ?? []) as unknown as RoomDetail["documents"],
      rooms: (siblingsRes.data ?? []) as unknown as Room[],
    };
  });

// ─── Fichas vivas, memória de prestador e cofre ──────────────────────────────

/** O lar primário do usuário: o mais antigo entre os que ele habilita. */
export async function primaryHousehold(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Household | null> {
  const { data: memberships, error } = await supabase
    .from("household_members")
    .select("household_id, expires_at")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  const active = (memberships ?? []).filter(
    (m) => !m.expires_at || new Date(m.expires_at) > new Date(),
  );
  if (active.length === 0) return null;

  const { data: households, error: hErr } = await supabase
    .from("households")
    .select("*")
    .in("id", active.map((m) => m.household_id))
    .order("created_at");
  if (hErr) throw new Error(hErr.message);

  return ((households ?? [])[0] ?? null) as unknown as Household | null;
}

/** A ficha viva de um objeto: o que ele é, o que foi feito nele e o que comprova. */
export const getAssetDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { assetId: string })
  .handler(async ({ data, context }): Promise<AssetDetail> => {
    const { supabase } = context;

    const { data: assetRow, error } = await supabase
      .from("assets")
      .select("*")
      .eq("id", data.assetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!assetRow) throw new Error("Esse objeto não está na sua casa.");
    const asset = assetRow as unknown as Asset;

    const [roomRes, eventsRes, servicesRes, docsRes, roomsRes, providersRes] =
      await Promise.all([
      asset.room_id
        ? supabase.from("rooms").select("*").eq("id", asset.room_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("asset_events")
        .select("*")
        .eq("asset_id", asset.id)
        .order("date", { ascending: false }),
      supabase
        .from("provider_services")
        .select("*, providers(name)")
        .eq("asset_id", asset.id)
        .order("date", { ascending: false }),
      supabase.from("documents").select("*").eq("asset_id", asset.id).order("title"),
      supabase
        .from("rooms")
        .select("*")
        .eq("household_id", asset.household_id)
        .order("sort_order"),
      supabase
        .from("providers")
        .select("*")
        .eq("household_id", asset.household_id)
        .order("name"),
    ]);
    if (eventsRes.error) throw new Error(eventsRes.error.message);
    if (servicesRes.error) throw new Error(servicesRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);

    // asset_events.provider_id não declara vínculo com providers, então o nome
    // vem da lista de prestadores do próprio lar — a RLS continua valendo.
    const providerIds = (eventsRes.data ?? [])
      .map((e) => e.provider_id)
      .filter((id): id is string => Boolean(id));
    const providerNames = new Map<string, string>();
    if (providerIds.length > 0) {
      const { data: names, error: nErr } = await supabase
        .from("providers")
        .select("id, name")
        .eq("household_id", asset.household_id)
        .in("id", providerIds);
      if (nErr) throw new Error(nErr.message);
      for (const p of names ?? []) providerNames.set(p.id, p.name);
    }

    const events = (eventsRes.data ?? []).map((e) => ({
      ...e,
      provider_name: e.provider_id ? providerNames.get(e.provider_id) ?? null : null,
    })) as unknown as AssetEventWithProvider[];

    const services = (servicesRes.data ?? []).map((s) => ({
      ...s,
      provider_name:
        (s as { providers?: { name: string } | null }).providers?.name ?? null,
    })) as unknown as ProviderServiceWithProvider[];

    let photo_src: string | null = null;
    if (asset.photo_url) {
      const { data: signed } = await supabase.storage
        .from("documents")
        .createSignedUrl(asset.photo_url, 600);
      photo_src = signed?.signedUrl ?? null;
    }

    return {
      asset,
      room: (roomRes.data ?? null) as unknown as Room | null,
      events,
      services,
      documents: (docsRes.data ?? []) as unknown as DocumentItem[],
      photo_src,
      rooms: (roomsRes.data ?? []) as unknown as Room[],
      providers: (providersRes.data ?? []) as unknown as Provider[],
    };
  });

/** A agenda de prestadores, com a memória do que cada um já fez na casa. */
export const getProviderDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProviderDirectory> => {
    const { supabase, userId } = context;
    const household = await primaryHousehold(supabase, userId);
    if (!household) return { household: null, providers: [] };

    const { data: providers, error } = await supabase
      .from("providers")
      .select("*")
      .eq("household_id", household.id)
      .order("name");
    if (error) throw new Error(error.message);

    const ids = (providers ?? []).map((p) => p.id);
    let services: ProviderServiceWithAsset[] = [];
    if (ids.length > 0) {
      const { data: rows, error: sErr } = await supabase
        .from("provider_services")
        .select("*, assets(name)")
        .in("provider_id", ids)
        .order("date");
      if (sErr) throw new Error(sErr.message);
      services = (rows ?? []).map((s) => ({
        ...s,
        asset_name: (s as { assets?: { name: string } | null }).assets?.name ?? null,
      })) as unknown as ProviderServiceWithAsset[];
    }

    return {
      household,
      providers: (providers ?? []).map((p) => ({
        provider: p as unknown as Provider,
        services: services.filter((s) => s.provider_id === p.id),
      })),
    };
  });

/** O cofre: tudo que a casa guarda, com o que cada papel pertence. */
export const getVault = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Vault> => {
    const { supabase, userId } = context;
    const household = await primaryHousehold(supabase, userId);
    if (!household) return { household: null, documents: [], rooms: [], assets: [] };

    const [docsRes, roomsRes, assetsRes] = await Promise.all([
      supabase
        .from("documents")
        .select("*, rooms(name), assets(name)")
        .eq("household_id", household.id),
      supabase
        .from("rooms")
        .select("*")
        .eq("household_id", household.id)
        .order("sort_order"),
      supabase
        .from("assets")
        .select("*")
        .eq("household_id", household.id)
        .order("name"),
    ]);
    if (docsRes.error) throw new Error(docsRes.error.message);
    if (roomsRes.error) throw new Error(roomsRes.error.message);
    if (assetsRes.error) throw new Error(assetsRes.error.message);

    return {
      household,
      documents: (docsRes.data ?? []).map((d) => ({
        document: d as unknown as DocumentItem,
        room_name: (d as { rooms?: { name: string } | null }).rooms?.name ?? null,
        asset_name: (d as { assets?: { name: string } | null }).assets?.name ?? null,
      })),
      rooms: (roomsRes.data ?? []) as unknown as Room[],
      assets: (assetsRes.data ?? []) as unknown as Asset[],
    };
  });

/** Um link curto e temporário para abrir ou baixar um documento do cofre. */
export const getDocumentFileUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { documentId: string })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: doc, error } = await supabase
      .from("documents")
      .select("file_url")
      .eq("id", data.documentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc?.file_url) return { url: null as string | null };

    const { data: signed, error: sErr } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_url, 600);
    if (sErr) throw new Error(sErr.message);
    return { url: signed?.signedUrl ?? null };
  });

// ─── Radar temporal ──────────────────────────────────────────────────────────

/** O radar: obrigações do lar com ocorrências, cômodos, objetos e responsáveis. */
export const getRadar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Radar> => {
    const { supabase, userId } = context;
    const household = await primaryHousehold(supabase, userId);
    if (!household) {
      return {
        household: null,
        obligations: [],
        rooms: [],
        assets: [],
        members: [],
        vehicles: [],
        pets: [],
        plants: [],
        layers: [],
      };

    }

    const [
      obligationsRes,
      roomsRes,
      assetsRes,
      membersRes,
      vehiclesRes,
      petsRes,
      plantsRes,
      layersRes,
    ] = await Promise.all([
      supabase
        .from("obligations")
        .select("*")
        .eq("household_id", household.id)
        .order("next_due"),
      supabase
        .from("rooms")
        .select("*")
        .eq("household_id", household.id)
        .order("sort_order"),
      supabase
        .from("assets")
        .select("id, name")
        .eq("household_id", household.id)
        .order("name"),
      supabase
        .from("household_members")
        .select("id, role, user_id, invited_email")
        .eq("household_id", household.id),
      supabase
        .from("vehicles")
        .select("id, name")
        .eq("household_id", household.id)
        .order("name"),
      supabase
        .from("pets")
        .select("id, name")
        .eq("household_id", household.id)
        .order("name"),
      supabase
        .from("plants")
        .select("*")
        .eq("household_id", household.id)
        .order("name"),
      supabase
        .from("household_layers")
        .select("*")
        .eq("household_id", household.id),
    ]);
    if (obligationsRes.error) throw new Error(obligationsRes.error.message);
    if (roomsRes.error) throw new Error(roomsRes.error.message);
    if (assetsRes.error) throw new Error(assetsRes.error.message);
    if (membersRes.error) throw new Error(membersRes.error.message);
    if (vehiclesRes.error) throw new Error(vehiclesRes.error.message);
    if (petsRes.error) throw new Error(petsRes.error.message);
    if (plantsRes.error) throw new Error(plantsRes.error.message);
    if (layersRes.error) throw new Error(layersRes.error.message);

    const rooms = (roomsRes.data ?? []) as unknown as Room[];
    const roomNames = new Map(rooms.map((r) => [r.id, r.name]));
    const assetNames = new Map(
      ((assetsRes.data ?? []) as Array<{ id: string; name: string }>).map((a) => [a.id, a.name]),
    );
    const vehicleNames = new Map(
      ((vehiclesRes.data ?? []) as Array<{ id: string; name: string }>).map((v) => [v.id, v.name]),
    );
    const petNames = new Map(
      ((petsRes.data ?? []) as Array<{ id: string; name: string }>).map((p) => [p.id, p.name]),
    );


    // Nome de exibição: perfil quando há conta, e-mail quando é convite.
    const memberRows = (membersRes.data ?? []) as Array<{
      id: string;
      role: RadarMember["role"];
      user_id: string | null;
      invited_email: string | null;
    }>;
    const userIds = memberRows.map((m) => m.user_id).filter((id): id is string => Boolean(id));
    const profileNames = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileNames.set(p.id, p.name || p.email || "Morador");
      }
    }
    const members: RadarMember[] = memberRows.map((m) => ({
      ...m,
      display_name: m.user_id
        ? profileNames.get(m.user_id) ?? "Morador"
        : m.invited_email ?? "Convidado",
    }));
    const memberNames = new Map(members.map((m) => [m.id, m.display_name]));

    const obligationsRaw = (obligationsRes.data ?? []) as unknown as Obligation[];
    const oblIds = obligationsRaw.map((o) => o.id);
    let occurrences: ObligationOccurrence[] = [];
    if (oblIds.length > 0) {
      const { data: occ, error: occErr } = await supabase
        .from("obligation_occurrences")
        .select("*")
        .in("obligation_id", oblIds)
        .order("due_date");
      if (occErr) throw new Error(occErr.message);
      occurrences = (occ ?? []) as unknown as ObligationOccurrence[];
    }

    const obligations: RadarObligation[] = obligationsRaw.map((o) => ({
      ...o,
      occurrences: occurrences.filter((occ) => occ.obligation_id === o.id),
      room_name: o.room_id ? roomNames.get(o.room_id) ?? null : null,
      asset_name: o.asset_id ? assetNames.get(o.asset_id) ?? null : null,
      vehicle_name: o.vehicle_id ? vehicleNames.get(o.vehicle_id) ?? null : null,
      pet_name: o.pet_id ? petNames.get(o.pet_id) ?? null : null,
      responsible_name: o.responsible_member_id
        ? memberNames.get(o.responsible_member_id) ?? null
        : null,
    }));

    return {
      household,
      obligations,
      rooms,
      assets: (assetsRes.data ?? []) as unknown as Asset[],
      members,
      vehicles: (vehiclesRes.data ?? []) as unknown as Array<{ id: string; name: string }>,
      pets: (petsRes.data ?? []) as unknown as Array<{ id: string; name: string }>,
      plants: (plantsRes.data ?? []) as unknown as Plant[],
      layers: (layersRes.data ?? []) as unknown as HouseholdLayer[],
    };
  });



// ─── Captura sem atrito ──────────────────────────────────────────────────────

/** A fila de revisão: capturas pendentes, cômodos e objetos para vincular. */
export const getCaptureQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CaptureQueue> => {
    const { supabase, userId } = context;
    const household = await primaryHousehold(supabase, userId);
    if (!household) return { household: null, captures: [], rooms: [], assets: [] };

    const [capturesRes, roomsRes, assetsRes] = await Promise.all([
      supabase
        .from("captures")
        .select("*")
        .eq("household_id", household.id)
        .eq("review_status", "pendente")
        .order("created_at", { ascending: false }),
      supabase
        .from("rooms")
        .select("*")
        .eq("household_id", household.id)
        .order("sort_order"),
      supabase
        .from("assets")
        .select("id, name")
        .eq("household_id", household.id)
        .order("name"),
    ]);
    if (capturesRes.error) throw new Error(capturesRes.error.message);
    if (roomsRes.error) throw new Error(roomsRes.error.message);
    if (assetsRes.error) throw new Error(assetsRes.error.message);

    return {
      household,
      captures: (capturesRes.data ?? []) as unknown as Capture[],
      rooms: (roomsRes.data ?? []) as unknown as Room[],
      assets: (assetsRes.data ?? []) as unknown as Asset[],
    };
  });
/** A conversa com o zelador, para abrir a rota com a memória da casa no lugar. */
export const getZeladorHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ZeladorThread> => {
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) return { household: null, messages: [] };

    const { data, error } = await context.supabase
      .from("chat_messages")
      .select("id, role, content, citations, created_at")
      .eq("household_id", household.id)
      .order("created_at")
      .limit(80);
    if (error) throw new Error(error.message);

    const messages: ChatEntry[] = (data ?? []).map((m) => ({
      id: m.id,
      role: m.role as ChatEntry["role"],
      content: m.content,
      citations: Array.isArray(m.citations) ? (m.citations as unknown as ChatCitation[]) : [],
      created_at: m.created_at,
    }));

    return { household, messages };
  });

// ─── Modo emergência ─────────────────────────────────────────────────────────

/** O pacote de emergência: onde a casa está, quem vive nela, prestadores de
 *  confiança, apólices e os objetos que podem segurar uma emergência.
 *  Tudo do próprio lar — pré-carregado no loader da rota para rede ruim. */
export const getEmergencyKit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmergencyKit> => {
    const { supabase, userId } = context;
    const household = await primaryHousehold(supabase, userId);
    if (!household) {
      return { household: null, members: [], providers: [], documents: [], breakerAssets: [] };
    }

    const [membersRes, providersRes, docsRes, assetsRes, roomsRes] = await Promise.all([
      supabase
        .from("household_members")
        .select("id, user_id, invited_email, role, expires_at")
        .eq("household_id", household.id),
      supabase
        .from("providers")
        .select("*")
        .eq("household_id", household.id)
        .order("name"),
      supabase
        .from("documents")
        .select("*")
        .eq("household_id", household.id)
        .order("title"),
      supabase
        .from("assets")
        .select("*")
        .eq("household_id", household.id)
        .order("name"),
      supabase
        .from("rooms")
        .select("*")
        .eq("household_id", household.id)
        .order("sort_order"),
    ]);
    if (membersRes.error) throw new Error(membersRes.error.message);
    if (providersRes.error) throw new Error(providersRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);
    if (assetsRes.error) throw new Error(assetsRes.error.message);
    if (roomsRes.error) throw new Error(roomsRes.error.message);

    // Quem vive aqui: membros ativos, com nome de exibição resolvido.
    const memberRows = (membersRes.data ?? []) as Array<{
      user_id: string | null;
      invited_email: string | null;
      role: MemberRole;
      expires_at: string | null;
    }>;
    const active = memberRows.filter(
      (m) => !m.expires_at || new Date(m.expires_at) > new Date(),
    );
    const userIds = active.map((m) => m.user_id).filter((id): id is string => Boolean(id));
    const profileNames = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileNames.set(p.id, p.name || p.email || "Morador");
      }
    }
    const members: EmergencyMember[] = active.map((m) => ({
      name: m.user_id ? profileNames.get(m.user_id) ?? "Morador" : m.invited_email ?? "Convidado",
      role: m.role,
    }));

    // O que pode segurar uma emergência: disjuntor, registro, quadro, gás.
    const roomNames = new Map(
      ((roomsRes.data ?? []) as Array<{ id: string; name: string }>).map((r) => [r.id, r.name]),
    );
    const BREAKER = /disjuntor|fus[ií]vel|quadro|energia|el[eé]trica|registro|g[aá]s|v[áa]lvula/i;
    const breakerAssets: EmergencyBreakerAsset[] = ((assetsRes.data ?? []) as Asset[])
      .filter((a) => BREAKER.test(a.name) || BREAKER.test(a.category) || BREAKER.test(a.notes ?? ""))
      .map((a) => ({ asset: a, room_name: a.room_id ? roomNames.get(a.room_id) ?? null : null }));

    // Prestadores: os de confiança primeiro.
    const providers = (providersRes.data ?? []) as unknown as Provider[];
    providers.sort((a, b) => Number(b.trusted) - Number(a.trusted) || a.name.localeCompare(b.name));

    return {
      household,
      members,
      providers,
      documents: (docsRes.data ?? []) as unknown as DocumentItem[],
      breakerAssets,
    };
  });

// ─── Dinheiro da casa ────────────────────────────────────────────────────────

/** O dinheiro do lar: gastos, obrigações, objetos, eventos e projetos.
 *  Os números são calculados no cliente (lib/money.ts) a partir destes dados. */
export const getMoneyState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MoneyState> => {
    const { supabase, userId } = context;
    const household = await primaryHousehold(supabase, userId);
    if (!household) {
      return {
        household: null,
        expenses: [],
        obligations: [],
        assets: [],
        events: [],
        services: [],
        projects: [],
        rooms: [],
      };
    }

    // asset_events e provider_services não têm household_id: filtra pelos
    // objetos e prestadores do próprio lar — a RLS continua valendo.
    const providerIdsRes = await supabase
      .from("providers")
      .select("id")
      .eq("household_id", household.id);
    if (providerIdsRes.error) throw new Error(providerIdsRes.error.message);
    const providerIds = (providerIdsRes.data ?? []).map((p) => p.id);


    const [expensesRes, obligationsRes, assetsRes0, projectsRes, roomsRes] = await Promise.all([
      supabase
        .from("expenses")
        .select("id, amount, date, category, kind, description, room_id, asset_id")
        .eq("household_id", household.id)
        .order("date", { ascending: false }),
      supabase
        .from("obligations")
        .select("id, title, amount, frequency, custom_interval_days, next_due")
        .eq("household_id", household.id),
      supabase
        .from("assets")
        .select("id, name, purchase_price, room_id")
        .eq("household_id", household.id)
        .order("name"),
      supabase
        .from("projects")
        .select("*")
        .eq("household_id", household.id)
        .order("start_date", { ascending: false }),
      supabase
        .from("rooms")
        .select("id, name")
        .eq("household_id", household.id)
        .order("sort_order"),
    ]);
    if (expensesRes.error) throw new Error(expensesRes.error.message);
    if (obligationsRes.error) throw new Error(obligationsRes.error.message);
    if (assetsRes0.error) throw new Error(assetsRes0.error.message);
    if (projectsRes.error) throw new Error(projectsRes.error.message);
    if (roomsRes.error) throw new Error(roomsRes.error.message);

    const assetIds = ((assetsRes0.data ?? []) as Array<{ id: string }>).map((a) => a.id);
    const [eventsRes, servicesRes] = await Promise.all([
      assetIds.length > 0
        ? supabase.from("asset_events").select("asset_id, cost").in("asset_id", assetIds)
        : Promise.resolve({ data: [], error: null } as unknown as { data: unknown[]; error: null }),
      providerIds.length > 0
        ? supabase.from("provider_services").select("asset_id, cost").in("provider_id", providerIds)
        : Promise.resolve({ data: [], error: null } as unknown as { data: unknown[]; error: null }),
    ]);
    if (eventsRes.error) throw new Error(eventsRes.error.message);
    if (servicesRes.error) throw new Error(servicesRes.error.message);

    return {
      household,
      expenses: (expensesRes.data ?? []) as unknown as MoneyState["expenses"],
      obligations: (obligationsRes.data ?? []) as unknown as MoneyState["obligations"],
      assets: (assetsRes0.data ?? []) as unknown as MoneyState["assets"],
      events: (eventsRes.data ?? []) as unknown as MoneyState["events"],
      services: (servicesRes.data ?? []) as unknown as MoneyState["services"],
      projects: (projectsRes.data ?? []) as unknown as MoneyState["projects"],
      rooms: (roomsRes.data ?? []) as unknown as Room[],
    };
  });

// ─── Camadas de vida: veículos, pets e jardim ────────────────────────────────

/** As obrigações do lar com ocorrências — de um veículo ou pet quando pedido. */
async function loadObligations(
  supabase: SupabaseClient<Database>,
  householdId: string,
  link?: { column: "vehicle_id" | "pet_id"; value: string },
): Promise<ObligationWithOccurrences[]> {
  const base = supabase
    .from("obligations")
    .select("*")
    .eq("household_id", householdId);

  const { data, error } = await (link ? base.eq(link.column, link.value) : base).order("next_due");
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Obligation[];
  const ids = rows.map((o) => o.id);
  let occurrences: ObligationOccurrence[] = [];
  if (ids.length > 0) {
    const { data: occ, error: occErr } = await supabase
      .from("obligation_occurrences")
      .select("*")
      .in("obligation_id", ids)
      .order("due_date");
    if (occErr) throw new Error(occErr.message);
    occurrences = (occ ?? []) as unknown as ObligationOccurrence[];
  }

  return rows.map((o) => ({
    ...o,
    occurrences: occurrences.filter((x) => x.obligation_id === o.id),
  }));
}

/** Os papéis do lar com nome de exibição resolvido (perfil ou convite). */
async function loadRadarMembers(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<RadarMember[]> {
  const { data, error } = await supabase
    .from("household_members")
    .select("id, role, user_id, invited_email")
    .eq("household_id", householdId);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    id: string;
    role: MemberRole;
    user_id: string | null;
    invited_email: string | null;
  }>;
  const userIds = rows.map((m) => m.user_id).filter((id): id is string => Boolean(id));
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);
    for (const p of profiles ?? []) names.set(p.id, p.name || p.email || "Morador");
  }

  return rows.map((m) => ({
    ...m,
    display_name: m.user_id ? names.get(m.user_id) ?? "Morador" : m.invited_email ?? "Convidado",
  }));
}

/** Os interruptores das camadas — a navegação decide o que mostra com isto. */
export const getLayerNav = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HouseholdLayer[]> => {
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) return [];

    const { data, error } = await context.supabase
      .from("household_layers")
      .select("*")
      .eq("household_id", household.id);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as HouseholdLayer[];
  });

/** A garagem: cada veículo com o que ele deve e os papéis que o comprovam. */
export const getVehiclesPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<VehiclesState> => {
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) return { household: null, vehicles: [] };

    const [vehiclesRes, obligations, docsRes] = await Promise.all([
      context.supabase
        .from("vehicles")
        .select("*")
        .eq("household_id", household.id)
        .order("name"),
      loadObligations(context.supabase, household.id),
      context.supabase
        .from("documents")
        .select("*")
        .eq("household_id", household.id)
        .order("title"),
    ]);
    if (vehiclesRes.error) throw new Error(vehiclesRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);

    const documents = (docsRes.data ?? []) as unknown as DocumentItem[];
    return {
      household,
      vehicles: ((vehiclesRes.data ?? []) as unknown as Vehicle[]).map((vehicle) => ({
        vehicle,
        obligations: obligations.filter((o) => o.vehicle_id === vehicle.id),
        documents: documents.filter((d) => d.vehicle_id === vehicle.id),
      })),
    };
  });

/** A ficha de um veículo: o que ele é, o que vence e o que comprova. */
export const getVehicleDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { vehicleId: string })
  .handler(async ({ data, context }): Promise<VehicleDetail> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("vehicles")
      .select("*")
      .eq("id", data.vehicleId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Esse veículo não está na sua casa.");
    const vehicle = row as unknown as Vehicle;

    const [obligations, docsRes, members] = await Promise.all([
      loadObligations(supabase, vehicle.household_id, {
        column: "vehicle_id",
        value: vehicle.id,
      }),
      supabase
        .from("documents")
        .select("*")
        .eq("vehicle_id", vehicle.id)
        .order("title"),
      loadRadarMembers(supabase, vehicle.household_id),
    ]);
    if (docsRes.error) throw new Error(docsRes.error.message);

    return {
      vehicle,
      obligations,
      documents: (docsRes.data ?? []) as unknown as DocumentItem[],
      members,
    };
  });

/** A casa com patas: cada pet com vacinas, consultas e documentos. */
export const getPetsPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PetsState> => {
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) return { household: null, pets: [] };

    const [petsRes, obligations, docsRes] = await Promise.all([
      context.supabase
        .from("pets")
        .select("*")
        .eq("household_id", household.id)
        .order("name"),
      loadObligations(context.supabase, household.id),
      context.supabase
        .from("documents")
        .select("*")
        .eq("household_id", household.id)
        .order("title"),
    ]);
    if (petsRes.error) throw new Error(petsRes.error.message);
    if (docsRes.error) throw new Error(docsRes.error.message);

    const documents = (docsRes.data ?? []) as unknown as DocumentItem[];
    return {
      household,
      pets: ((petsRes.data ?? []) as unknown as Pet[]).map((pet) => ({
        pet,
        obligations: obligations.filter((o) => o.pet_id === pet.id),
        documents: documents.filter((d) => d.pet_id === pet.id),
      })),
    };
  });

/** A ficha de um pet: o que ele é, o que vence e o que comprova. */
export const getPetDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input as { petId: string })
  .handler(async ({ data, context }): Promise<PetDetail> => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("pets")
      .select("*")
      .eq("id", data.petId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Esse pet não está na sua casa.");
    const pet = row as unknown as Pet;

    const [obligations, docsRes, members] = await Promise.all([
      loadObligations(supabase, pet.household_id, { column: "pet_id", value: pet.id }),
      supabase.from("documents").select("*").eq("pet_id", pet.id).order("title"),
      loadRadarMembers(supabase, pet.household_id),
    ]);
    if (docsRes.error) throw new Error(docsRes.error.message);

    return {
      pet,
      obligations,
      documents: (docsRes.data ?? []) as unknown as DocumentItem[],
      members,
    };
  });

/** O jardim: as plantas da casa. A rega é calculada no cliente (lib/layers.ts). */
export const getGardenPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GardenState> => {
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) return { household: null, plants: [] };

    const { data, error } = await context.supabase
      .from("plants")
      .select("*")
      .eq("household_id", household.id)
      .order("name");
    if (error) throw new Error(error.message);
    return { household, plants: (data ?? []) as unknown as Plant[] };
  });

/** O que os Ajustes mostram: o estado dos interruptores de cada camada. */
export const getSettingsState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SettingsState> => {
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) return { household: null, layers: [] };

    const { data, error } = await context.supabase
      .from("household_layers")
      .select("*")
      .eq("household_id", household.id);
    if (error) throw new Error(error.message);
    return { household, layers: (data ?? []) as unknown as HouseholdLayer[] };
  });

/**
 * A casa dividida entre quem mora: os moradores com papel e prazo, e o peso
 * real de cada um (itens cuidados, vencimentos dos próximos 30 dias e o valor
 * que pesa junto). É o mapa de carga da Fase 11, feito de registros reais.
 */
export const getMembersState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MembersState> => {
    const empty = {
      household: null,
      members: [],
      load: [],
      unassigned: { items: 0, due_30: 0, amount_30: 0 },
      can_manage: false,
    };
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) return empty;

    const horizon = new Date(Date.now() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const [membersRes, obligationsRes, occRes, canWriteRes] = await Promise.all([
      context.supabase
        .from("household_members")
        .select("id, role, user_id, invited_email, expires_at")
        .eq("household_id", household.id),
      context.supabase
        .from("obligations")
        .select("id, responsible_member_id, amount")
        .eq("household_id", household.id),
      context.supabase
        .from("obligation_occurrences")
        .select("obligation_id, due_date")
        .eq("status", "pendente")
        .lte("due_date", horizon),
      context.supabase.rpc("can_write", { _household_id: household.id }),
    ]);
    if (membersRes.error) throw new Error(membersRes.error.message);

    const rows = (membersRes.data ?? []) as Array<{
      id: string;
      role: MemberRole;
      user_id: string | null;
      invited_email: string | null;
      expires_at: string | null;
    }>;

    const names = new Map<string, string>();
    const userIds = rows.map((m) => m.user_id).filter((id): id is string => Boolean(id));
    if (userIds.length > 0) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);
      for (const p of profiles ?? []) names.set(p.id, p.name || p.email || "Morador");
    }

    const members: MemberRow[] = rows.map((m) => ({
      ...m,
      display_name: m.user_id
        ? names.get(m.user_id) ?? "Morador"
        : m.invited_email ?? "Convidado",
      linked: Boolean(m.user_id),
    }));

    const obligations = (obligationsRes.data ?? []) as Array<{
      id: string;
      responsible_member_id: string | null;
      amount: number | null;
    }>;

    // A regra do mapa mora em lib/load-map.ts (pura e testada): quem cuida
    // de quê, o que vence em 30 dias e o que ficou sem dono.
    const { load, unassigned } = buildLoadMap(
      members.map((m) => ({ id: m.id, display_name: m.display_name })),
      obligations,
      (occRes.data ?? []) as Array<{ obligation_id: string; due_date: string }>,
    );

    return {
      household,
      members,
      load,
      unassigned,
      can_manage: Boolean(canWriteRes.data),
    };
  });

/**
 * A busca universal: qualquer coisa da casa encontrável em instantes.
 * Devolve entradas rasas (nome, grupo, destino) — a paleta filtra no cliente.
 */
export const getSearchIndex = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SearchEntry[]> => {
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) return [];

    const [roomsRes, assetsRes, docsRes, obligationsRes, providersRes] =
      await Promise.all([
        context.supabase
          .from("rooms")
          .select("id, name")
          .eq("household_id", household.id),
        context.supabase
          .from("assets")
          .select("id, name, category, room_id")
          .eq("household_id", household.id),
        context.supabase
          .from("documents")
          .select("id, title, category")
          .eq("household_id", household.id),
        context.supabase
          .from("obligations")
          .select("id, title, next_due")
          .eq("household_id", household.id),
        context.supabase
          .from("providers")
          .select("id, name, specialty")
          .eq("household_id", household.id),
      ]);

    const roomName = new Map(
      ((roomsRes.data ?? []) as Array<{ id: string; name: string }>).map((r) => [
        r.id,
        r.name,
      ]),
    );

    const entries: SearchEntry[] = [];
    for (const r of roomsRes.data ?? []) {
      entries.push({
        id: r.id,
        label: r.name,
        group: "Cômodos",
        hint: null,
        to: `/comodo/${r.id}`,
      });
    }
    for (const a of (assetsRes.data ?? []) as Array<{
      id: string;
      name: string;
      category: string;
      room_id: string | null;
    }>) {
      entries.push({
        id: a.id,
        label: a.name,
        group: "Objetos",
        hint: (a.room_id && roomName.get(a.room_id)) || a.category,
        to: `/ativo/${a.id}`,
      });
    }
    for (const d of (docsRes.data ?? []) as Array<{
      id: string;
      title: string;
      category: string;
    }>) {
      entries.push({
        id: d.id,
        label: d.title,
        group: "Documentos",
        hint: d.category,
        to: "/documentos",
      });
    }
    for (const o of (obligationsRes.data ?? []) as Array<{
      id: string;
      title: string;
      next_due: string | null;
    }>) {
      entries.push({
        id: o.id,
        label: o.title,
        group: "Obrigações",
        hint: o.next_due ? `vence ${o.next_due}` : null,
        to: "/obrigacoes",
      });
    }
    for (const p of (providersRes.data ?? []) as Array<{
      id: string;
      name: string;
      specialty: string | null;
    }>) {
      entries.push({
        id: p.id,
        label: p.name,
        group: "Prestadores",
        hint: p.specialty,
        to: "/prestadores",
      });
    }
    return entries;
  });

/**
 * Os momentos de virada leem a casa inteira: cômodos, objetos, histórico,
 * documentos, obrigações e gastos. Mudança, dossiê, sinistro e retrospectiva
 * são montados no cliente por lib/moments.ts (puro e testado).
 */
export const getMomentsState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MomentsState> => {
    const empty: MomentsState = {
      household: null,
      rooms: [],
      assets: [],
      events: [],
      services: [],
      documents: [],
      expenses: [],
    };
    const household = await primaryHousehold(context.supabase, context.userId);
    if (!household) return empty;

    const [roomsRes, assetsRes, eventsRes, servicesRes, docsRes, expensesRes] =
      await Promise.all([
        context.supabase
          .from("rooms")
          .select("id, name, sort_order")
          .eq("household_id", household.id)
          .order("sort_order"),
        context.supabase
          .from("assets")
          .select(
            "id, name, category, room_id, purchase_date, purchase_price, warranty_expires",
          )
          .eq("household_id", household.id),
        context.supabase
          .from("asset_events")
          .select("asset_id, date, cost")
          .order("date", { ascending: false }),
        context.supabase
          .from("provider_services")
          .select("asset_id, date, cost")
          .order("date", { ascending: false }),
        context.supabase
          .from("documents")
          .select("title, category, room_id, asset_id, expires_at")
          .eq("household_id", household.id),
        context.supabase
          .from("expenses")
          .select("amount, date")
          .eq("household_id", household.id),
      ]);
    if (roomsRes.error) throw new Error(roomsRes.error.message);
    if (assetsRes.error) throw new Error(assetsRes.error.message);

    // Eventos e serviços não têm household_id: filtrar pelos objetos do lar.
    const assetIds = new Set(((assetsRes.data ?? []) as Array<{ id: string }>).map((a) => a.id));
    const events = ((eventsRes.data ?? []) as Array<{ asset_id: string; date: string; cost: number | null }>)
      .filter((e) => assetIds.has(e.asset_id));
    const services = ((servicesRes.data ?? []) as Array<{ asset_id: string | null; date: string; cost: number | null }>)
      .filter((s) => s.asset_id && assetIds.has(s.asset_id));

    return {
      household,
      rooms: (roomsRes.data ?? []) as MomentsState["rooms"],
      assets: (assetsRes.data ?? []) as MomentsState["assets"],
      events,
      services: services as MomentsState["services"],
      documents: (docsRes.data ?? []) as MomentsState["documents"],
      expenses: (expensesRes.data ?? []) as MomentsState["expenses"],
    };
  });
