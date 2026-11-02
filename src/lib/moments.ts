// Momentos de virada — regras puras e testadas.
// Mudança, dossiê do imóvel, sinistro e retrospectiva anual, todos montados
// a partir dos registros reais da casa (cômodos, objetos, documentos, gastos).

// ─── Mudança: checklist por cômodo ─────────────────────────────────────────

export interface MovingItem {
  id: string;
  name: string;
}

export interface MovingRoom {
  room_id: string;
  room_name: string;
  items: MovingItem[];
}

/**
 * O checklist de mudança nasce do inventário: cada cômodo vira um grupo de
 * caixas e cada objeto dele vira um item a embalar. Cômodo sem objeto ainda
 * aparece — tem sempre o que desmontar, limpar ou conferir.
 */
export function buildMovingChecklist(
  rooms: Array<{ id: string; name: string; sort_order: number }>,
  assets: Array<{ id: string; name: string; room_id: string | null }>,
): MovingRoom[] {
  const byRoom = new Map<string, MovingItem[]>();
  const loose: MovingItem[] = [];
  for (const a of assets) {
    const item = { id: a.id, name: a.name };
    if (a.room_id && byRoom.has(a.room_id)) byRoom.get(a.room_id)!.push(item);
    else if (a.room_id) byRoom.set(a.room_id, [item]);
    else loose.push(item);
  }
  const groups = [...rooms]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({
      room_id: r.id,
      room_name: r.name,
      items: byRoom.get(r.id) ?? [],
    }));
  if (loose.length > 0) {
    groups.push({ room_id: "sem-comodo", room_name: "Sem cômodo", items: loose });
  }
  return groups;
}

/** Progresso da mudança: itens marcados sobre o total. */
export function movingProgress(
  checklist: MovingRoom[],
  done: ReadonlySet<string>,
): { done: number; total: number; pct: number } {
  const total = checklist.reduce((sum, r) => sum + r.items.length, 0);
  const doneCount = checklist.reduce(
    (sum, r) => sum + r.items.filter((i) => done.has(i.id)).length,
    0,
  );
  return {
    done: doneCount,
    total,
    pct: total === 0 ? 0 : Math.round((doneCount / total) * 100),
  };
}

// ─── Dossiê do imóvel ──────────────────────────────────────────────────────

export interface DossierAsset {
  name: string;
  category: string;
  purchase_date: string | null;
  purchase_price: number | null;
  warranty_expires: string | null;
  maintenances: number;
}

export interface DossierSection {
  room_name: string;
  assets: DossierAsset[];
}

export interface Dossier {
  sections: DossierSection[];
  /** Documentos da casa inteira (sem cômodo): escritura, apólices, IPTU. */
  houseDocuments: Array<{ title: string; category: string; expires_at: string | null }>;
  totalAssets: number;
  totalMaintenances: number;
}

/**
 * O dossiê conta a história do imóvel para quem compra ou herda: o que cada
 * cômodo tem, o que já foi mantido e quais documentos provam a casa.
 */
export function buildDossier(
  rooms: Array<{ id: string; name: string; sort_order: number }>,
  assets: Array<{
    id: string;
    name: string;
    category: string;
    room_id: string | null;
    purchase_date: string | null;
    purchase_price: number | null;
    warranty_expires: string | null;
  }>,
  events: Array<{ asset_id: string }>,
  documents: Array<{
    title: string;
    category: string;
    room_id: string | null;
    expires_at: string | null;
  }>,
): Dossier {
  const maintenanceCount = new Map<string, number>();
  for (const e of events) {
    maintenanceCount.set(e.asset_id, (maintenanceCount.get(e.asset_id) ?? 0) + 1);
  }

  const toDossierAsset = (a: (typeof assets)[number]): DossierAsset => ({
    name: a.name,
    category: a.category,
    purchase_date: a.purchase_date,
    purchase_price: a.purchase_price,
    warranty_expires: a.warranty_expires,
    maintenances: maintenanceCount.get(a.id) ?? 0,
  });

  const sections: DossierSection[] = [...rooms]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({
      room_name: r.name,
      assets: assets.filter((a) => a.room_id === r.id).map(toDossierAsset),
    }))
    .filter((s) => s.assets.length > 0);

  const unroomed = assets.filter((a) => !a.room_id).map(toDossierAsset);
  if (unroomed.length > 0) {
    sections.push({ room_name: "Sem cômodo", assets: unroomed });
  }

  return {
    sections,
    houseDocuments: documents
      .filter((d) => !d.room_id)
      .map((d) => ({
        title: d.title,
        category: d.category,
        expires_at: d.expires_at,
      })),
    totalAssets: assets.length,
    totalMaintenances: events.length,
  };
}

// ─── Sinistro: pacote de comprovantes ──────────────────────────────────────

export interface ClaimItem {
  name: string;
  room_name: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  /** Documentos ligados ao objeto (nota fiscal, manual, apólice). */
  proofs: number;
}

export interface ClaimPackage {
  items: ClaimItem[];
  totalValue: number;
  /** Itens com valor conhecido mas sem nenhum comprovante ligado. */
  withoutProof: number;
}

/**
 * Na hora do sinistro, o que importa é provar: cada objeto com valor, de
 * qual cômodo, e quantos documentos o comprovam. O total é a soma do que
 * tem preço de compra registrado.
 */
export function buildClaimPackage(
  assets: Array<{
    id: string;
    name: string;
    room_id: string | null;
    purchase_price: number | null;
    purchase_date: string | null;
  }>,
  rooms: Array<{ id: string; name: string }>,
  documents: Array<{ asset_id: string | null }>,
): ClaimPackage {
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const proofCount = new Map<string, number>();
  for (const d of documents) {
    if (d.asset_id) proofCount.set(d.asset_id, (proofCount.get(d.asset_id) ?? 0) + 1);
  }

  const items: ClaimItem[] = assets
    .filter((a) => a.purchase_price != null && a.purchase_price > 0)
    .map((a) => ({
      name: a.name,
      room_name: a.room_id ? (roomName.get(a.room_id) ?? null) : null,
      purchase_price: a.purchase_price,
      purchase_date: a.purchase_date,
      proofs: proofCount.get(a.id) ?? 0,
    }))
    .sort((a, b) => (b.purchase_price ?? 0) - (a.purchase_price ?? 0));

  return {
    items,
    totalValue: items.reduce((sum, i) => sum + (i.purchase_price ?? 0), 0),
    withoutProof: items.filter((i) => i.proofs === 0).length,
  };
}

// ─── Retrospectiva anual ───────────────────────────────────────────────────

export interface YearMonth {
  /** "2026-03" */
  month: string;
  total: number;
}

export interface YearReview {
  year: number;
  totalSpent: number;
  maintenances: number;
  services: number;
  months: YearMonth[];
  /** O mês em que a casa mais pediu. */
  heaviestMonth: YearMonth | null;
}

/**
 * A retrospectiva conta o ano da casa: tudo que foi gasto (gastos, eventos
 * de objetos e serviços de prestadores), quantas manutenções aconteceram e
 * como o dinheiro se distribuiu mês a mês.
 */
export function buildYearReview(
  year: number,
  expenses: Array<{ amount: number; date: string }>,
  events: Array<{ cost: number | null; date: string }>,
  services: Array<{ cost: number | null; date: string }>,
): YearReview {
  const inYear = (date: string) => date.slice(0, 4) === String(year);
  const months = new Map<string, number>();
  const add = (date: string, value: number) => {
    const key = date.slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + value);
  };

  let totalSpent = 0;
  for (const e of expenses) {
    if (!inYear(e.date)) continue;
    totalSpent += e.amount;
    add(e.date, e.amount);
  }
  const yearEvents = events.filter((e) => inYear(e.date));
  const yearServices = services.filter((s) => inYear(s.date));
  for (const e of yearEvents) {
    totalSpent += e.cost ?? 0;
    add(e.date, e.cost ?? 0);
  }
  for (const s of yearServices) {
    totalSpent += s.cost ?? 0;
    add(s.date, s.cost ?? 0);
  }

  const monthList: YearMonth[] = [...months.entries()]
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    year,
    totalSpent,
    maintenances: yearEvents.length,
    services: yearServices.length,
    months: monthList,
    heaviestMonth:
      monthList.length === 0
        ? null
        : monthList.reduce((max, m) => (m.total > max.total ? m : max)),
  };
}
