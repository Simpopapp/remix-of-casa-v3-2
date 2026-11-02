// Regras das camadas de vida: veículos, pets e jardim.
// Puro de propósito — nada aqui toca o banco, para que as regras possam ser
// testadas e reutilizadas pelo nav, pelas páginas de camada e pelo radar.

import type { HouseholdLayer, LayerKey, Plant } from "@/lib/types";

/** A ordem em que as camadas aparecem na casa. */
export const LAYER_KEYS = ["veiculos", "pets", "jardim"] as const;

export const LAYER_META = {
  veiculos: {
    label: "Veículos",
    to: "/veiculos",
    eyebrow: "O que vive na garagem",
    hint: "Revisão, IPVA e seguro de cada carro — com a ficha e os papéis do veículo.",
  },
  pets: {
    label: "Pets",
    to: "/pets",
    eyebrow: "Quem tem quatro patas",
    hint: "Vacinas, consultas e documentos de cada pet, no mesmo radar do resto da casa.",
  },
  jardim: {
    label: "Jardim",
    to: "/jardim",
    eyebrow: "O que vive fora das paredes",
    hint: "Rega, poda e adubação por planta — a casa avisa quando é hora de molhar.",
  },
} as const satisfies Record<LayerKey, { label: string; to: string; eyebrow: string; hint: string }>;

/**
 * Uma camada só está desligada quando a casa diz isso explicitamente.
 * Sem linha nenhuma na tabela, todas as três estão ligadas — é o padrão de
 * quem acabou de montar a casa e ainda não passou pelos Ajustes.
 */
export function activeLayerKeys(layers: HouseholdLayer[]): LayerKey[] {
  const off = new Set(layers.filter((l) => !l.active).map((l) => l.layer));
  return LAYER_KEYS.filter((key) => !off.has(key));
}

export function isLayerActive(layers: HouseholdLayer[], key: LayerKey): boolean {
  return activeLayerKeys(layers).includes(key);
}

/** "2026-11-02" lido ao meio-dia local: evita a casa escorregar um dia no fuso. */
function parseDay(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

/** Formata em "AAAA-MM-DD" a partir dos campos locais, sem passar por UTC. */
function formatDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** O dia de hoje no fuso de quem usa a casa — "hoje" não é o dia UTC. */
export function todayISO(today: Date = new Date()): string {
  return formatDay(today);
}


/**
 * Quando regar de novo: a última rega + o intervalo da planta.
 * Sem intervalo ou sem última rega não há horário a cumprir.
 */
export function nextWatering(plant: Plant): string | null {
  if (!plant.last_watered) return null;
  const interval = plant.watering_interval_days;
  if (!interval || interval <= 0) return null;
  const next = parseDay(plant.last_watered);
  next.setDate(next.getDate() + interval);
  return formatDay(next);
}

export type WateringStatus = "sem_horario" | "em_dia" | "logo" | "atrasada";

export interface WateringInfo {
  status: WateringStatus;
  /** A data da próxima rega, quando a planta tem horário. */
  next: string | null;
  /** Dias até lá (negativo = já passou). */
  days_left: number | null;
}

/** O estado da rega de uma planta, hoje. */
export function wateringStatus(plant: Plant, today: Date = new Date()): WateringInfo {
  const next = nextWatering(plant);
  if (!next) return { status: "sem_horario", next: null, days_left: null };

  const daysLeft = Math.ceil(
    (parseDay(next).getTime() - parseDay(formatDay(today)).getTime()) / 86_400_000,
  );
  const status: WateringStatus = daysLeft < 0 ? "atrasada" : daysLeft <= 2 ? "logo" : "em_dia";
  return { status, next, days_left: daysLeft };
}

/**
 * O que precisa de água primeiro: atrasadas, depois as que chegam mais cedo.
 * Plantas sem horário ficam no fim, sem inventar urgência.
 */
export function sortByWatering(
  plants: Plant[],
  today: Date = new Date(),
): Array<{ plant: Plant; watering: WateringInfo }> {
  const rows = plants.map((plant) => ({ plant, watering: wateringStatus(plant, today) }));
  const rank: Record<WateringStatus, number> = {
    atrasada: 0,
    logo: 1,
    em_dia: 2,
    sem_horario: 3,
  };
  return rows.sort(
    (a, b) =>
      rank[a.watering.status] - rank[b.watering.status] ||
      (a.watering.days_left ?? 1e9) - (b.watering.days_left ?? 1e9) ||
      a.plant.name.localeCompare(b.plant.name),
  );
}
