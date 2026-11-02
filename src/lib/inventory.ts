// Regras de domínio das fichas vivas, da memória de prestadores e do cofre.
// Funções puras: o que o produto afirma sobre a casa vem daqui, e é testável.

const DAY = 86_400_000;

/** Dias até uma data (negativo = já passou). Sem data, nunca vence. */
export function daysUntil(iso: string | null | undefined, today: number = Date.now()): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return Math.ceil((date.getTime() - today) / DAY);
}

/** Meses cheios entre duas datas, no calendário real (não em dias/30). */
export function monthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

// ─── Garantia ────────────────────────────────────────────────────────────────

export type WarrantyState = "sem_garantia" | "valida" | "vencendo" | "vencida";

export interface WarrantyInfo {
  state: WarrantyState;
  /** A data que manda: a estendida, quando existe, senão a padrão. */
  ref: string | null;
  days: number;
}

export function warrantyState(
  asset: {
    warranty_expires: string | null;
    extended_warranty_expires: string | null;
  },
  today: number = Date.now(),
): WarrantyInfo {
  const ref = asset.extended_warranty_expires ?? asset.warranty_expires;
  if (!ref) return { state: "sem_garantia", ref: null, days: Number.POSITIVE_INFINITY };
  const days = daysUntil(ref, today);
  if (days < 0) return { state: "vencida", ref, days };
  if (days <= 30) return { state: "vencendo", ref, days };
  return { state: "valida", ref, days };
}

export const WARRANTY_LABEL: Record<WarrantyState, string> = {
  sem_garantia: "Sem garantia registrada",
  valida: "Na garantia",
  vencendo: "Garantia acabando",
  vencida: "Garantia vencida",
};

// ─── Vida útil e custo acumulado ─────────────────────────────────────────────

export interface AssetLife {
  /** Quanto a casa já gastou cuidando deste objeto. */
  spentOnCare: number;
  purchasePrice: number | null;
  /** Cuidado ÷ preço de um novo. Null sem preço de compra. */
  careVsNew: number | null;
  ageMonths: number | null;
  remainingMonths: number | null;
  /** Honestidade: já custou metade de um novo? Hora de conversar sobre trocar. */
  worthReplacing: boolean;
}

export function assetLife(
  asset: {
    purchase_date: string | null;
    purchase_price: number | null;
    useful_life_months: number | null;
  },
  events: Array<{ cost: number | null }>,
  today: number = Date.now(),
): AssetLife {
  const spentOnCare = events.reduce((sum, e) => sum + (e.cost ?? 0), 0);
  const price = asset.purchase_price ?? null;
  const careVsNew = price && price > 0 ? spentOnCare / price : null;

  let ageMonths: number | null = null;
  if (asset.purchase_date) {
    const bought = new Date(
      asset.purchase_date.length === 10 ? `${asset.purchase_date}T12:00:00` : asset.purchase_date,
    );
    if (!Number.isNaN(bought.getTime())) {
      ageMonths = monthsBetween(bought, new Date(today));
    }
  }

  const remainingMonths =
    asset.useful_life_months != null && ageMonths != null
      ? asset.useful_life_months - ageMonths
      : null;

  return {
    spentOnCare,
    purchasePrice: price,
    careVsNew,
    ageMonths,
    remainingMonths,
    worthReplacing: careVsNew != null && careVsNew >= 0.5,
  };
}

// ─── Memória de prestador ────────────────────────────────────────────────────

export interface ProviderMemory {
  services: number;
  totalSpent: number;
  avgRating: number | null;
  /** Fração de quem responderia "chamaria de novo" (0–1). Null sem respostas. */
  wouldHireAgain: number | null;
  lastService: string | null;
  verdict: "confia" | "neutro" | "evitar";
}

export function providerMemory(
  services: Array<{
    date: string;
    cost: number | null;
    rating: number | null;
    would_hire_again: boolean | null;
  }>,
): ProviderMemory {
  const totalSpent = services.reduce((sum, s) => sum + (s.cost ?? 0), 0);
  const rated = services.filter((s) => s.rating != null);
  const avgRating = rated.length
    ? rated.reduce((sum, s) => sum + (s.rating ?? 0), 0) / rated.length
    : null;

  const answered = services.filter((s) => s.would_hire_again != null);
  const wouldHireAgain = answered.length
    ? answered.filter((s) => s.would_hire_again).length / answered.length
    : null;

  const lastService = services
    .map((s) => s.date)
    .sort()
    .at(-1) ?? null;

  let verdict: ProviderMemory["verdict"] = "neutro";
  if (wouldHireAgain != null) {
    if (wouldHireAgain >= 0.6 && (avgRating == null || avgRating >= 3.5)) verdict = "confia";
    else if (wouldHireAgain <= 0.4 || (avgRating != null && avgRating < 2.5)) verdict = "evitar";
  }

  return {
    services: services.length,
    totalSpent,
    avgRating,
    wouldHireAgain,
    lastService,
    verdict,
  };
}

export const VERDICT_LABEL: Record<ProviderMemory["verdict"], string> = {
  confia: "Vale chamar",
  neutro: "Sem histórico suficiente",
  evitar: "Melhor evitar",
};

// ─── Validade no cofre ───────────────────────────────────────────────────────

export type DocumentState = "sem_validade" | "em_dia" | "vence_breve" | "vencido";

export interface DocumentExpiry {
  state: DocumentState;
  days: number;
}

export function documentState(
  doc: { expires_at: string | null },
  today: number = Date.now(),
): DocumentExpiry {
  if (!doc.expires_at) return { state: "sem_validade", days: Number.POSITIVE_INFINITY };
  const days = daysUntil(doc.expires_at, today);
  if (days < 0) return { state: "vencido", days };
  if (days <= 30) return { state: "vence_breve", days };
  return { state: "em_dia", days };
}

export const DOCUMENT_STATE_LABEL: Record<DocumentState, string> = {
  sem_validade: "Sem validade",
  em_dia: "Em dia",
  vence_breve: "Vence em breve",
  vencido: "Vencido",
};

/** Ordem do cofre: o que urge primeiro aparece no topo, a partir de onde a validade estiver. */
export function sortByUrgencyBy<T>(
  items: T[],
  expiresAtOf: (item: T) => string | null,
  today: number = Date.now(),
): T[] {
  return [...items].sort((a, b) => {
    const da = daysUntil(expiresAtOf(a), today);
    const db = daysUntil(expiresAtOf(b), today);
    if (da !== db) return da - db;
    return 0;
  });
}

export function sortByUrgency<T extends { expires_at: string | null }>(
  docs: T[],
  today: number = Date.now(),
): T[] {
  return sortByUrgencyBy(docs, (d) => d.expires_at, today);
}
