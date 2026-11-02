// Mapa de carga da casa — regra pura e testada.
// O peso de cada pessoa sai dos registros reais: quantas obrigações ela
// responde, quantas vencem nos próximos 30 dias e quanto isso soma.

import type { LoadMapEntry } from "@/lib/types";

export interface LoadMapMember {
  id: string;
  display_name: string;
}

export interface LoadMapObligation {
  id: string;
  responsible_member_id: string | null;
  amount: number | null;
}

export interface LoadMapOccurrence {
  obligation_id: string;
  due_date: string;
}

export interface LoadMapResult {
  load: LoadMapEntry[];
  unassigned: { items: number; due_30: number; amount_30: number };
}

const THIRTY_DAYS_MS = 30 * 86_400_000;

/**
 * Monta o mapa de carga. Só entram pessoas com pelo menos uma obrigação;
 * o que ninguém assumiu vai para o balde "Ninguém". Vencimentos contam os
 * pendentes até 30 dias à frente (atrasados inclusos — eles são o peso maior).
 * A ordenação é por impacto: quem tem mais vencimento perto aparece primeiro.
 */
export function buildLoadMap(
  members: LoadMapMember[],
  obligations: LoadMapObligation[],
  pendingOccurrences: LoadMapOccurrence[],
  now: Date = new Date(),
): LoadMapResult {
  const horizon = new Date(now.getTime() + THIRTY_DAYS_MS)
    .toISOString()
    .slice(0, 10);

  const nameOf = new Map(members.map((m) => [m.id, m.display_name]));
  const byObligation = new Map(obligations.map((o) => [o.id, o]));

  const load = new Map<string | null, LoadMapEntry>();
  const entry = (memberId: string | null): LoadMapEntry => {
    const existing = load.get(memberId);
    if (existing) return existing;
    const fresh: LoadMapEntry = {
      member_id: memberId,
      name: (memberId && nameOf.get(memberId)) || "Ninguém",
      items: 0,
      due_30: 0,
      amount_30: 0,
    };
    load.set(memberId, fresh);
    return fresh;
  };

  for (const o of obligations) entry(o.responsible_member_id).items += 1;

  for (const x of pendingOccurrences) {
    if (x.due_date > horizon) continue;
    const o = byObligation.get(x.obligation_id);
    if (!o) continue;
    const e = entry(o.responsible_member_id);
    e.due_30 += 1;
    e.amount_30 += o.amount ?? 0;
  }

  const unassignedEntry = load.get(null);
  load.delete(null);
  const entries = [...load.values()].sort(
    (a, b) => b.due_30 - a.due_30 || b.items - a.items || b.amount_30 - a.amount_30,
  );

  return {
    load: entries,
    unassigned: unassignedEntry ?? { items: 0, due_30: 0, amount_30: 0 },
  };
}
