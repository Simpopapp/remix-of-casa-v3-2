// Sugestões contextuais da home: o que vale a pena olhar agora, sem a pessoa pedir.
// Puro e testável — recebe os dados que a home já carrega, devolve cartões.
import type { Asset } from "@/lib/types";

export interface WarrantySuggestion {
  assetId: string;
  name: string;
  /** Fim real da cobertura: a estendida, se houver, vence depois da normal. */
  coversUntil: string;
  daysLeft: number;
}

function dayGap(from: Date, iso: string): number {
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Objetos com cobertura a vencer dentro da janela (em dias). A garantia
 * estendida manda quando existe; já vencida não sugere nada — tarde demais.
 */
export function warrantySuggestions(
  assets: Asset[],
  today = new Date(),
  windowDays = 60,
): WarrantySuggestion[] {
  return assets
    .map((a) => {
      const candidates = [a.warranty_expires, a.extended_warranty_expires].filter(
        (d): d is string => !!d,
      );
      if (candidates.length === 0) return null;
      const coversUntil = candidates.slice().sort().at(-1) as string;
      const daysLeft = dayGap(today, coversUntil);
      if (daysLeft < 0 || daysLeft > windowDays) return null;
      return { assetId: a.id, name: a.name, coversUntil, daysLeft };
    })
    .filter((s): s is WarrantySuggestion => s !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
