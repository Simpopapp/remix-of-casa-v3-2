// Recorrência das obrigações — matemática de datas pura e testável.
// Regra de ouro: mensal no dia 31 cai no último dia de fevereiro, nunca pula mês.

import type { ObligationFrequency } from "@/lib/types";

function parseDay(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Soma meses mantendo o dia quando possível; senão, usa o último dia do mês. */
function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

/** A data seguinte de uma obrigação, ou null quando ela não se repete. */
export function advanceDate(
  iso: string,
  frequency: ObligationFrequency,
  customIntervalDays?: number | null,
): string | null {
  const date = parseDay(iso);
  switch (frequency) {
    case "one_time":
      return null;
    case "monthly":
      return toISODate(addMonthsClamped(date, 1));
    case "quarterly":
      return toISODate(addMonthsClamped(date, 3));
    case "semiannual":
      return toISODate(addMonthsClamped(date, 6));
    case "yearly":
      return toISODate(addMonthsClamped(date, 12));
    case "custom": {
      const days = customIntervalDays && customIntervalDays > 0 ? customIntervalDays : 30;
      return toISODate(new Date(date.getTime() + days * 86_400_000));
    }
  }
}

/**
 * Todas as datas de vencimento de uma obrigação de `nextDue` até `until`
 * (inclusive). Para compromissos únicos, devolve só a data inicial.
 */
export function occurrenceDates(opts: {
  nextDue: string;
  frequency: ObligationFrequency;
  customIntervalDays?: number | null;
  until: Date;
}): string[] {
  const { nextDue, frequency, customIntervalDays, until } = opts;
  const limit = toISODate(until);
  const dates: string[] = [];
  let cursor: string | null = nextDue;
  // Trava de segurança: nenhuma recorrência gera mais de 500 datas em 12 meses.
  for (let i = 0; i < 500 && cursor && cursor <= limit; i++) {
    dates.push(cursor);
    cursor = advanceDate(cursor, frequency, customIntervalDays);
  }
  return dates;
}

/** O próximo vencimento depois de `afterIso` — usado ao concluir uma ocorrência. */
export function nextDueAfter(
  afterIso: string,
  frequency: ObligationFrequency,
  customIntervalDays?: number | null,
): string | null {
  return advanceDate(afterIso, frequency, customIntervalDays);
}
