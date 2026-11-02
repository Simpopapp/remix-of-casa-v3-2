// Regra de resolução do alvo de um acontecimento capturado
// ("troquei o filtro da geladeira hoje"): o objeto pode já existir na casa,
// pode ser novo (nome digitado ou entendido pela IA), ou nada foi informado.
// Pura e testável — aplicada por applyCapture antes de qualquer gravação.

export type AssetEventTarget =
  | { ok: true; assetId: string | null; assetName: string | null }
  | { ok: false; error: string };

export interface AssetEventInput {
  /** Objeto escolhido na pilha de revisão (id de um ativo já cadastrado). */
  assetId?: string | null | undefined;
  /** Nome digitado pela pessoa para um objeto ainda não cadastrado. */
  typedName?: string | null | undefined;
  /** Nome do objeto que a IA entendeu da frase ("Geladeira"). */
  extractName?: string | null | undefined;
}

const MISSING_TARGET = "Diga a qual objeto isso aconteceu.";

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Decide onde o acontecimento entra. Um objeto já cadastrado vence qualquer
 * nome; sem ele, o nome digitado pela pessoa vence o palpite da IA.
 */
export function resolveAssetEventTarget(input: AssetEventInput): AssetEventTarget {
  const assetId = clean(input.assetId);
  if (assetId) return { ok: true, assetId, assetName: null };

  const assetName = clean(input.typedName) ?? clean(input.extractName);
  if (assetName) return { ok: true, assetId: null, assetName };

  return { ok: false, error: MISSING_TARGET };
}
