// O Pulso da Casa — cálculo honesto, usado por /, cômodos e pelo zelador.
// Não é gamificação: cada ponto ruim tem um motivo nomeado e uma saída.

import { occurrenceDates } from "@/lib/recurrence";
import type { ObligationFrequency } from "@/lib/types";

export type PulseLevel = "tranquilo" | "atencao" | "urgente";

export interface PulseFactor {
  label: string;
  /** Peso em pontos, sempre positivo; o painel explica o que melhoraria. */
  points: number;
  detail: string;
  /** O que fazer para recuperar esses pontos. */
  action: string;
}

export interface PulseInput {
  obligations: Array<{
    next_due: string | null;
    occurrences?: Array<{ status: string; due_date: string }>;
  }>;
  assets: Array<{
    warranty_expires: string | null;
    extended_warranty_expires: string | null;
  }>;
  documents: Array<{ expires_at: string | null }>;
}

export interface PulseResult {
  score: number;
  level: PulseLevel;
  factors: PulseFactor[];
}

function daysUntil(iso: string): number {
  const date = new Date(`${iso}T12:00:00`);
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

function isoOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function computePulse(input: PulseInput): PulseResult {
  const factors: PulseFactor[] = [];
  let penalty = 0;

  const overdue = input.obligations.flatMap((o) => {
    const open = (o.occurrences ?? []).filter(
      (occ) => occ.status === "pendente" && daysUntil(occ.due_date) < 0,
    );
    return open;
  });
  if (overdue.length > 0) {
    const points = Math.min(40, overdue.length * 10);
    penalty += points;
    factors.push({
      label: "Obrigações em atraso",
      points,
      action: "Pagar o que passou da data",
      detail:
        overdue.length === 1
          ? "1 compromisso da casa passou da data."
          : `${overdue.length} compromissos da casa passaram da data.`,
    });
  }

  const nearDue = input.obligations.filter(
    (o) =>
      o.next_due &&
      daysUntil(o.next_due) >= 0 &&
      daysUntil(o.next_due) <= 7,
  );
  if (nearDue.length > 0) {
    const points = Math.min(15, nearDue.length * 3);
    penalty += points;
    factors.push({
      label: "Vencendo nesta semana",
      points,
      action: "Antecipar o que vence nesta semana",
      detail: `${nearDue.length} compromisso(s) vencem nos próximos 7 dias.`,
    });
  }

  const warrantyEnding = input.assets.filter((a) => {
    const ref = a.extended_warranty_expires ?? a.warranty_expires;
    return ref && daysUntil(ref) >= 0 && daysUntil(ref) <= 30;
  });
  if (warrantyEnding.length > 0) {
    const points = Math.min(15, warrantyEnding.length * 5);
    penalty += points;
    factors.push({
      label: "Garantias acabando",
      points,
      action: "Chamar o técnico enquanto a garantia cobre",
      detail:
        warrantyEnding.length === 1
          ? "1 garantia termina em até 30 dias — bom momento para revisar defeitos."
          : `${warrantyEnding.length} garantias terminam em até 30 dias.`,
    });
  }

  const expiredDocs = input.documents.filter(
    (d) => d.expires_at && daysUntil(d.expires_at) < 0,
  );
  if (expiredDocs.length > 0) {
    const points = Math.min(20, expiredDocs.length * 7);
    penalty += points;
    factors.push({
      label: "Documentos vencidos",
      points,
      action: "Renovar os documentos vencidos",
      detail: `${expiredDocs.length} documento(s) precisam de renovação.`,
    });
  }

  const score = Math.max(0, 100 - penalty);
  const level: PulseLevel =
    score >= 80 ? "tranquilo" : score >= 55 ? "atencao" : "urgente";
  return { score, level, factors };
}

// ── O que melhoraria, em ordem de impacto ──────────────────────────────────

export interface Improvement {
  action: string;
  detail: string;
  /** Pontos que voltam ao pulso quando isso é resolvido. */
  recovers: number;
}

/**
 * A lista honesta do que fazer primeiro: o que devolve mais pontos aparece antes.
 * Sem fator nenhum, a casa está em ordem e a lista fica vazia — sem inventar tarefa.
 */
export function pulseImprovements(pulse: PulseResult): Improvement[] {
  return [...pulse.factors]
    .sort((a, b) => b.points - a.points)
    .map((f) => ({ action: f.action, detail: f.detail, recovers: f.points }));
}

// ── Linha do tempo dos próximos meses ──────────────────────────────────────

const MONTH_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export interface TimelineObligation {
  title: string;
  amount: number | null;
  next_due: string | null;
  frequency: ObligationFrequency;
  custom_interval_days?: number | null;
}

export interface TimelineItem {
  title: string;
  date: string;
  amount: number | null;
}

export interface TimelineMonth {
  key: string;
  label: string;
  items: TimelineItem[];
  /** Soma só do que tem valor conhecido — nada de estimativa inventada. */
  expected: number;
}

/**
 * Os próximos `months` meses da casa, mês a mês, a partir das recorrências
 * reais das obrigações. O que já passou não entra; o que não tem valor
 * aparece no calendário, mas não soma no previsto.
 */
export function pulseTimeline(
  obligations: TimelineObligation[],
  today = new Date(),
  months = 12,
): TimelineMonth[] {
  const first = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const buckets = new Map<string, TimelineMonth>();
  for (let i = 0; i < months; i++) {
    const d = new Date(first.getFullYear(), first.getMonth() + i, 1, 12);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      key,
      label: `${MONTH_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      items: [],
      expected: 0,
    });
  }

  const startISO = isoOf(today);
  const horizon = new Date(first.getFullYear(), first.getMonth() + months, 0, 12);
  const endISO = isoOf(horizon);

  for (const o of obligations) {
    if (!o.next_due) continue;
    const dates = occurrenceDates({
      nextDue: o.next_due,
      frequency: o.frequency,
      customIntervalDays: o.custom_interval_days ?? null,
      until: horizon,
    });
    for (const date of dates) {
      if (date < startISO || date > endISO) continue;
      const month = buckets.get(date.slice(0, 7));
      if (!month) continue;
      month.items.push({ title: o.title, date, amount: o.amount });
      month.expected += o.amount ?? 0;
    }
  }

  for (const m of buckets.values()) m.items.sort((a, b) => a.date.localeCompare(b.date));
  return [...buckets.values()];
}

/** Cor do pulso de um cômodo, usada na planta espacial. */
export function pulseColor(level: PulseLevel): string {
  switch (level) {
    case "tranquilo":
      return "var(--tranquilo)";
    case "atencao":
      return "var(--atencao)";
    case "urgente":
      return "var(--urgente)";
  }
}

/** Dados brutos por cômodo — o que vem do banco já recortado por room_id. */
export interface RoomPulseData {
  assets: Array<{
    room_id: string | null;
    warranty_expires: string | null;
    extended_warranty_expires: string | null;
  }>;
  obligations: Array<{
    room_id: string | null;
    next_due: string | null;
    occurrences?: Array<{ status: string; due_date: string }>;
  }>;
  documents: Array<{ room_id: string | null; expires_at: string | null }>;
}

/**
 * Pulso de cada cômodo: recorta assets, obrigações e documentos por room_id
 * e roda o mesmo cálculo da casa. Itens sem cômodo contam só para a casa.
 */
export function roomPulses(
  roomIds: string[],
  data: RoomPulseData,
): Map<string, PulseResult> {
  const map = new Map<string, PulseResult>();
  for (const id of roomIds) {
    map.set(
      id,
      computePulse({
        obligations: data.obligations.filter((o) => o.room_id === id),
        assets: data.assets.filter((a) => a.room_id === id),
        documents: data.documents.filter((d) => d.room_id === id),
      }),
    );
  }
  return map;
}
