// Tipos de domínio da Casa Viva. Espelham o schema do Lovable Cloud.
// Datas chegam do servidor serializadas — tratamos como string ISO.

export type MemberRole = "owner" | "manager" | "member" | "viewer" | "guest";

export type HouseholdKind =
  | "casa"
  | "apartamento"
  | "sitio"
  | "praia"
  | "alugado"
  | "outro";

export interface Household {
  id: string;
  name: string;
  kind: HouseholdKind;
  address: string | null;
  timezone: string;
  created_by: string | null;
  created_at: string;
}

export type RoomArea = "interna" | "externa" | "garagem";

export interface RoomLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
  cor?: string;
  icone?: string;
}

export interface Room {
  id: string;
  household_id: string;
  name: string;
  kind: string;
  kind_area: RoomArea;
  layout: RoomLayout | Record<string, never>;
  sort_order: number;
  created_at: string;
}

export interface Asset {
  id: string;
  household_id: string;
  room_id: string | null;
  name: string;
  category: string;
  brand: string | null;
  model: string | null;
  serial: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  store: string | null;
  warranty_expires: string | null;
  extended_warranty_expires: string | null;
  useful_life_months: number | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
}

export type AssetEventKind =
  | "manutencao"
  | "reparo"
  | "substituicao"
  | "observacao";

export interface AssetEvent {
  id: string;
  asset_id: string;
  kind: AssetEventKind;
  date: string;
  description: string;
  cost: number | null;
  provider_id: string | null;
  created_at: string;
}

export interface Provider {
  id: string;
  household_id: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  trusted: boolean;
  notes: string | null;
  created_at: string;
}

export interface ProviderService {
  id: string;
  provider_id: string;
  asset_id: string | null;
  date: string;
  description: string;
  cost: number | null;
  rating: number | null;
  would_hire_again: boolean | null;
  notes: string | null;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  household_id: string;
  room_id: string | null;
  asset_id: string | null;
  vehicle_id: string | null;
  pet_id: string | null;
  title: string;
  category: string;
  expires_at: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
}

export type ObligationKind =
  | "conta"
  | "tributo"
  | "seguro"
  | "revisao"
  | "vacina"
  | "contrato"
  | "outro";

export type ObligationFrequency =
  | "one_time"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly"
  | "custom";

export interface Obligation {
  id: string;
  household_id: string;
  title: string;
  kind: ObligationKind;
  amount: number | null;
  frequency: ObligationFrequency;
  custom_interval_days: number | null;
  next_due: string | null;
  room_id: string | null;
  asset_id: string | null;
  vehicle_id: string | null;
  pet_id: string | null;
  responsible_member_id: string | null;

  auto_renew: boolean;
  notes: string | null;
  created_at: string;
}

export interface ObligationOccurrence {
  id: string;
  obligation_id: string;
  due_date: string;
  status: "pendente" | "pago" | "feito";
  paid_at: string | null;
  amount_paid: number | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  household_id: string;
  name: string;
  plate: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  purchase_date: string | null;
  odometer: number | null;
  created_at: string;
}

export interface Pet {
  id: string;
  household_id: string;
  name: string;
  species: string | null;
  breed: string | null;
  birthdate: string | null;
  weight_kg: number | null;
  photo_url: string | null;
  created_at: string;
}

export interface Plant {
  id: string;
  household_id: string;
  name: string;
  location: string | null;
  watering_interval_days: number | null;
  last_watered: string | null;
  created_at: string;
}

export type ExpenseKind = "fixo" | "variavel" | "eventual" | "sazonal";

export interface Expense {
  id: string;
  household_id: string;
  room_id: string | null;
  asset_id: string | null;
  category: string;
  amount: number;
  date: string;
  kind: ExpenseKind;
  description: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  household_id: string;
  name: string;
  budget_planned: number | null;
  budget_spent: number;
  status: "planejado" | "andamento" | "concluido";
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface Capture {
  id: string;
  household_id: string;
  kind: "foto" | "texto" | "email";
  raw_text: string | null;
  image_url: string | null;
  ai_status: "pendente" | "processando" | "pronto" | "erro";
  ai_extract: CaptureExtract | null;
  review_status: "pendente" | "aplicado" | "descartado";
  created_at: string;
}

export interface ChatMessage {
  id: string;
  household_id: string;
  member_id: string | null;
  role: "user" | "assistant";
  content: string;
  citations: unknown;
  created_at: string;
}

export interface HouseholdMembership {
  id: string;
  household_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: MemberRole;
  expires_at: string | null;
  created_at: string;
}

export interface HomeState {
  household: Household | null;
  rooms: Room[];
  membership: HouseholdMembership | null;
  assets: Asset[];
  obligations: ObligationWithOccurrences[];
  documents: DocumentItem[];
}

export interface ObligationWithOccurrences extends Obligation {
  occurrences: ObligationOccurrence[];
}

export interface RoomDetail {
  room: Room;
  assets: Asset[];
  obligations: ObligationWithOccurrences[];
  documents: DocumentItem[];
  /** Os irmãos deste cômodo, para realocar um objeto sem sair daqui. */
  rooms: Room[];
}

// ─── Fichas vivas, memória de prestador e cofre ──────────────────────────────

export interface AssetEventWithProvider extends AssetEvent {
  provider_name: string | null;
}

export interface ProviderServiceWithProvider extends ProviderService {
  provider_name: string | null;
}

export interface ProviderServiceWithAsset extends ProviderService {
  asset_name: string | null;
}

/** A ficha viva: o objeto, seu cômodo, o que foi feito nele e o que comprova. */
export interface AssetDetail {
  asset: Asset;
  room: Room | null;
  events: AssetEventWithProvider[];
  services: ProviderServiceWithProvider[];
  documents: DocumentItem[];
  /** URL temporária da foto, quando há uma guardada no cofre. */
  photo_src: string | null;
  /** As opções para realocar o objeto e ligar um serviço a um prestador. */
  rooms: Room[];
  providers: Provider[];
}

export interface ProviderWithServices {
  provider: Provider;
  services: ProviderServiceWithAsset[];
}

export interface ProviderDirectory {
  household: Household | null;
  providers: ProviderWithServices[];
}

export interface DocumentWithLinks {
  document: DocumentItem;
  room_name: string | null;
  asset_name: string | null;
}

/** O cofre: documentos do lar com o que cada um pertence, e as opções de vínculo. */
export interface Vault {
  household: Household | null;
  documents: DocumentWithLinks[];
  rooms: Room[];
  assets: Asset[];
}

// ─── Radar temporal ──────────────────────────────────────────────────────────

export interface RadarMember {
  id: string;
  role: MemberRole;
  user_id: string | null;
  invited_email: string | null;
  /** Nome de exibição resolvido (perfil ou e-mail convidado). */
  display_name: string;
}

export interface RadarObligation extends ObligationWithOccurrences {
  room_name: string | null;
  asset_name: string | null;
  vehicle_name: string | null;
  pet_name: string | null;
  responsible_name: string | null;
}

/** O radar: obrigações do lar com ocorrências, cômodos, camadas e responsáveis. */
export interface Radar {
  household: Household | null;
  obligations: RadarObligation[];
  rooms: Room[];
  assets: Asset[];
  members: RadarMember[];
  /** Opções de vínculo das camadas ligadas, para o diálogo de obrigação. */
  vehicles: Array<{ id: string; name: string }>;
  pets: Array<{ id: string; name: string }>;
  /** Camada jardim: a rega entra no radar a partir destas plantas. */
  plants: Plant[];
  /** O estado dos interruptores, para o radar só mostrar camadas ligadas. */
  layers: HouseholdLayer[];
}



// ─── Captura sem atrito ──────────────────────────────────────────────────────

/** O que a IA extraiu de uma foto ou frase — sempre uma proposta editável. */
export interface CaptureExtract {
  kind: "asset" | "document" | "obligation" | "expense" | "asset_event" | "unknown";
  title: string;
  summary: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  store: string | null;
  warranty_expires: string | null;
  doc_category: string | null;
  expires_at: string | null;
  amount: number | null;
  frequency: ObligationFrequency | null;
  next_due: string | null;
  expense_date: string | null;
  event_kind: AssetEventKind | null;
  event_date: string | null;
  cost: number | null;
  room_guess: string | null;
  /** Para asset_event: o objeto envolvido ("Geladeira"), quando entendido. */
  asset_name: string | null;
}

/** A fila de revisão: capturas pendentes com o que a IA propôs para cada uma. */
export interface CaptureQueue {
  household: Household | null;
  captures: Capture[];
  rooms: Room[];
  assets: Asset[];
}

// ── Zelador digital ────────────────────────────────────────────────────────

/** Uma ficha citada na resposta do zelador — leva a pessoa até a origem. */
export interface ChatCitation {
  label: string;
  to: string;
}

export interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ChatCitation[];
  created_at: string;
}

export interface ZeladorThread {
  household: Household | null;
  messages: ChatEntry[];
}

// ── Modo emergência ────────────────────────────────────────────────────────

/** Quem vive na casa, com nome resolvido (perfil ou e-mail de convite). */
export interface EmergencyMember {
  name: string;
  role: MemberRole;
}

/** Um objeto que pode segurar a chave de uma emergência (disjuntor, registro). */
export interface EmergencyBreakerAsset {
  asset: Asset;
  room_name: string | null;
}

/** O pacote de emergência: dados reais do lar, pré-carregados no loader. */
export interface EmergencyKit {
  household: Household | null;
  members: EmergencyMember[];
  /** Prestadores com os de confiança primeiro. */
  providers: Provider[];
  /** Apólices e papéis que provam a casa, com arquivo quando existe. */
  documents: DocumentItem[];
  breakerAssets: EmergencyBreakerAsset[];
}

// ── Dinheiro da casa ───────────────────────────────────────────────────────

export interface MoneyExpenseRow {
  id: string;
  amount: number;
  date: string;
  category: string;
  kind: ExpenseKind;
  description: string | null;
  room_id: string | null;
  asset_id: string | null;
}

export interface MoneyObligationRow {
  id: string;
  title: string;
  amount: number | null;
  frequency: ObligationFrequency;
  custom_interval_days: number | null;
  next_due: string | null;
}

export interface MoneyAssetRow {
  id: string;
  name: string;
  purchase_price: number | null;
  room_id: string | null;
}

export interface MoneyCostRow {
  asset_id: string;
  cost: number | null;
}

/** Tudo que /dinheiro precisa: gastos, obrigações, objetos e projetos do lar. */
export interface MoneyState {
  household: Household | null;
  expenses: MoneyExpenseRow[];
  obligations: MoneyObligationRow[];
  assets: MoneyAssetRow[];
  events: MoneyCostRow[];
  services: MoneyCostRow[];
  projects: Project[];
  rooms: Room[];
}

// ── Camadas de vida: veículos, pets e jardim ───────────────────────────────

export type LayerKey = "veiculos" | "pets" | "jardim";

/**
 * O interruptor de uma camada. Sem linha na tabela a camada está ligada:
 * só um `active = false` explícito a tira da navegação.
 */
export interface HouseholdLayer {
  household_id: string;
  layer: LayerKey;
  active: boolean;
  created_at: string;
}

/** Um veículo com o que ele deve e o que comprova. */
export interface VehicleRow {
  vehicle: Vehicle;
  obligations: ObligationWithOccurrences[];
  documents: DocumentItem[];
}

export interface VehiclesState {
  household: Household | null;
  vehicles: VehicleRow[];
}

/** A ficha de um veículo: o que ele é, o que vence e os papéis dele. */
export interface VehicleDetail {
  vehicle: Vehicle;
  obligations: ObligationWithOccurrences[];
  documents: DocumentItem[];
  members: RadarMember[];
}

/** Um pet com o que ele deve e o que comprova. */
export interface PetRow {
  pet: Pet;
  obligations: ObligationWithOccurrences[];
  documents: DocumentItem[];
}

export interface PetsState {
  household: Household | null;
  pets: PetRow[];
}

/** A ficha de um pet: o que ele é, o que vence e os papéis dele. */
export interface PetDetail {
  pet: Pet;
  obligations: ObligationWithOccurrences[];
  documents: DocumentItem[];
  members: RadarMember[];
}

/** O jardim: as plantas da casa. A rega é calculada no cliente (lib/layers.ts). */
export interface GardenState {
  household: Household | null;
  plants: Plant[];
}

/** O que os Ajustes mostram sobre as camadas da casa. */
export interface SettingsState {
  household: Household | null;
  layers: HouseholdLayer[];
}


/** Um morador da casa: quem é, que papel tem e até quando. */
export interface MemberRow {
  id: string;
  role: MemberRole;
  user_id: string | null;
  invited_email: string | null;
  /** Quando o acesso acaba; null é sem prazo. */
  expires_at: string | null;
  display_name: string;
  /** Já tem conta ligada, ou ainda espera o convite ser aceito. */
  linked: boolean;
}

/** O peso de uma pessoa na casa. */
export interface LoadMapEntry {
  member_id: string | null;
  name: string;
  /** Itens que a pessoa cuida. */
  items: number;
  /** Vencimentos nos próximos 30 dias. */
  due_30: number;
  /** Quanto esses vencimentos somam. */
  amount_30: number;
}

export interface MembersState {
  household: Household | null;
  members: MemberRow[];
  load: LoadMapEntry[];
  /** O que ninguém assumiu ainda. */
  unassigned: { items: number; due_30: number; amount_30: number };
  /** Só quem pode escrever convida, muda papel ou remove alguém. */
  can_manage: boolean;
}

// ── Busca universal ────────────────────────────────────────────────────────

/** Uma entrada da busca: qualquer coisa da casa, com para onde ela leva. */
export interface SearchEntry {
  id: string;
  label: string;
  /** O grupo da paleta: Cômodos, Objetos, Documentos… */
  group: string;
  /** Detalhe em uma linha (cômodo, categoria, vencimento). */
  hint: string | null;
  to: string;
}

// ── Momentos de virada ─────────────────────────────────────────────────────

/** Tudo que /momentos precisa: a casa inteira, crua, para montar no cliente. */
export interface MomentsState {
  household: Household | null;
  rooms: Array<{ id: string; name: string; sort_order: number }>;
  assets: Array<{
    id: string;
    name: string;
    category: string;
    room_id: string | null;
    purchase_date: string | null;
    purchase_price: number | null;
    warranty_expires: string | null;
  }>;
  events: Array<{ asset_id: string; date: string; cost: number | null }>;
  services: Array<{ asset_id: string | null; date: string; cost: number | null }>;
  documents: Array<{
    title: string;
    category: string;
    room_id: string | null;
    asset_id: string | null;
    expires_at: string | null;
  }>;
  expenses: Array<{ amount: number; date: string }>;
}
