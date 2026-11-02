// Formatação em pt-BR, moeda BRL — usada por todo o produto.

export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Aceita o jeito brasileiro de digitar (12,5) e devolve número ou nada. */
export function parseAmount(value: string): number | null {
  const clean = value.trim().replace(/\./g, "").replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export const MEMBER_ROLE_LABEL: Record<string, string> = {
  owner: "Responsável",
  manager: "Gerencia",
  member: "Morador",
  viewer: "Só vê",
  guest: "Convidado",
};

export function formatMonthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "há 3 dias", "em 2 meses" — sempre em português, sem jargão. */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - Date.now();
  const days = Math.round(diffMs / 86_400_000);
  const abs = Math.abs(days);
  if (abs === 0) return "hoje";
  if (abs === 1) return days < 0 ? "ontem" : "amanhã";
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (abs < 45) return rtf.format(-days, "day");
  if (abs < 365) return rtf.format(-Math.round(days / 30), "month");
  return rtf.format(-Math.round(days / 365), "year");
}

export const HOUSEHOLD_KIND_LABEL: Record<string, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  sitio: "Sítio",
  praia: "Casa de praia",
  alugado: "Imóvel alugado",
  outro: "Outro",
};
