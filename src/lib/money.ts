// O dinheiro da casa — matemática pura e testável, usada por /dinheiro.
// Regra de ouro: nenhum número inventado. O que não tem registro não soma.

import { pulseTimeline, type TimelineObligation } from "@/lib/pulse";


import type { Project } from "@/lib/types";

/** Gasto com a origem resolvida, para agrupar por cômodo ou objeto. */
export interface MoneyExpense {
  id: string;
  amount: number;
  date: string;
  room_id: string | null;
  room_name: string | null;
  asset_name: string | null;
}

export interface OwnershipInput {
  purchase_price: number | null;
  events: Array<{ cost: number | null }>;
  services: Array<{ cost: number | null }>;
}

/** Custo de propriedade: o que o objeto custou + tudo que foi gasto nele. */
export function ownershipCost(asset: OwnershipInput): number {
  const purchase = asset.purchase_price ?? 0;
  const events = asset.events.reduce((sum, e) => sum + (e.cost ?? 0), 0);
  const services = asset.services.reduce((sum, s) => sum + (s.cost ?? 0), 0);
  return round2(purchase + events + services);
}

/** Média mensal real dos gastos: soma dos últimos `months` meses dividida por eles. */
export function monthlyAverage(
  expenses: Array<{ date: string; amount: number }>,
  months = 12,
  today = new Date(),
): number {
  if (expenses.length === 0) return 0;
  const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1, 12);
  const startISO = isoDate(start);
  const inWindow = expenses.filter((e) => e.date >= startISO);
  if (inWindow.length === 0) return 0;
  const total = inWindow.reduce((sum, e) => sum + e.amount, 0);
  const firstDate = inWindow.reduce(
    (min, e) => (e.date < min ? e.date : min),
    inWindow[0]?.date ?? "",
  );
  // Meses efetivamente cobertos pelos registros — não meses corridos sem dado.
  const first = new Date(`${firstDate}T12:00:00`);
  const covered =
    (today.getFullYear() - first.getFullYear()) * 12 +
    (today.getMonth() - first.getMonth()) +
    1;
  return round2(total / Math.max(1, covered));
}

export interface RoomCost {
  room_id: string | null;
  room_name: string;
  total: number;
}

/** Total gasto por cômodo, em ordem decrescente; o que não tem cômodo vem por último. */
export function costByRoom(expenses: MoneyExpense[]): RoomCost[] {
  const totals = new Map<string, { room_id: string | null; room_name: string; total: number }>();
  for (const e of expenses) {
    const key = e.room_id ?? "sem-comodo";
    const entry = totals.get(key) ?? {
      room_id: e.room_id,
      room_name: e.room_name ?? "Sem cômodo",
      total: 0,
    };
    entry.total = round2(entry.total + e.amount);
    totals.set(key, entry);
  }
  return [...totals.values()].sort(
    (a, b) => b.total - a.total || a.room_name.localeCompare(b.room_name),
  );
}

/** Os próximos 12 meses da casa, a partir das recorrências reais das obrigações. */
export function forecast12Months(
  obligations: TimelineObligation[],
  today = new Date(),
): { months: ReturnType<typeof pulseTimeline>; total: number } {
  const months = pulseTimeline(obligations, today, 12);
  return { months, total: round2(months.reduce((sum, m) => sum + m.expected, 0)) };
}

/**
 * Reserva sugerida: 3 meses do custo mensal previsto (o que se repete de
 * compromisso), o mesmo que a casa já prova saber pagar. Com previsão zero,
 * usa a média real dos gastos — nunca devolve número sem fonte.
 */
export function reserveSuggestion(
  forecastMonthlyAverage: number,
  realMonthlyAverage: number,
): number {
  const base = forecastMonthlyAverage > 0 ? forecastMonthlyAverage : realMonthlyAverage;
  return round2(base * 3);
}

export interface ProjectProgress {
  pct: number | null;
  planned: number | null;
  spent: number;
}

/** Planejado vs realizado; sem orçamento planejado, não há porcentagem. */
export function projectProgress(project: Project): ProjectProgress {
  const spent = project.budget_spent ?? 0;
  if (project.budget_planned == null || project.budget_planned <= 0) {
    return { pct: null, planned: project.budget_planned, spent };
  }
  return {
    pct: Math.round((spent / project.budget_planned) * 100),
    planned: project.budget_planned,
    spent,
  };
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
