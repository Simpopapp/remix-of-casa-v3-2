// IA da captura — SOMENTE SERVIDOR. Nunca importar de componente ou rota cliente.
// A chave fica em process.env["LOVABLE_API_KEY"], lida dentro de cada chamada.
import { createOpenAI } from "@ai-sdk/openai";
import {
  Output,
  generateText,
  isStepCount,
  streamText,
  type ModelMessage,
  type ToolSet,
} from "ai";
import { z } from "zod";

const GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";
const RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

/** Fetch que propaga o run-id do gateway dentro de uma mesma chamada. */
function createRunIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(RUN_ID_HEADER)) headers.set(RUN_ID_HEADER, runId);
    const response = await fetch(input, { ...init, headers });
    runId ??= response.headers.get(RUN_ID_HEADER)?.trim() || undefined;
    return response;
  };
}

// Schema estrito: tudo obrigatório, opcionais nullable — contrato do gateway.
export const captureExtractSchema = z.object({
  kind: z.enum(["asset", "document", "obligation", "expense", "asset_event", "unknown"]),
  title: z.string(),
  summary: z.string(),
  category: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  serial: z.string().nullable(),
  purchase_date: z.string().nullable(),
  purchase_price: z.number().nullable(),
  store: z.string().nullable(),
  warranty_expires: z.string().nullable(),
  doc_category: z.string().nullable(),
  expires_at: z.string().nullable(),
  amount: z.number().nullable(),
  frequency: z
    .enum(["one_time", "monthly", "quarterly", "semiannual", "yearly", "custom"])
    .nullable(),
  next_due: z.string().nullable(),
  expense_date: z.string().nullable(),
  event_kind: z.enum(["manutencao", "reparo", "substituicao", "observacao"]).nullable(),
  event_date: z.string().nullable(),
  cost: z.number().nullable(),
  room_guess: z.string().nullable(),
  asset_name: z.string().nullable(),
});

export type CaptureExtract = z.infer<typeof captureExtractSchema>;

const SYSTEM = `Você é o leitor da Casa Viva, o sistema operacional de um lar brasileiro.
Sua tarefa: receber um texto solto ou a foto de um documento (nota fiscal, etiqueta de
equipamento, boleto, apólice, manual) e extrair um registro estruturado da casa.

Decida o "kind":
- "asset": um objeto/equipamento da casa (eletrodoméstico, móvel, sistema).
- "document": um papel para o cofre (escritura, apólice, contrato, nota fiscal, manual).
- "obligation": algo que vence ou se repete (conta, tributo, seguro, revisão, vacina).
- "expense": um gasto já feito.
- "asset_event": algo que aconteceu com um objeto ("troquei o filtro da geladeira").
- "unknown": não deu para entender.

Regras:
- Datas sempre em ISO (AAAA-MM-DD). Hoje é ${new Date().toISOString().slice(0, 10)}.
- Valores em número (350.50), nunca texto.
- "troquei", "consertei", "chamei o eletricista" → asset_event com event_kind adequado.
- "vence", "todo mês", "anual" → obligation com frequency e next_due.
- room_guess: o cômodo mais provável em português (ex.: "Cozinha"), ou null.
- asset_name: quando kind for "asset_event", o nome do objeto envolvido em
  português ("Geladeira", "Filtro da geladeira") — nunca o nome do evento.
  Para os outros kinds, null.
- summary: uma frase humana do que foi entendido, em pt-BR.
- Não invente dados que não estão no texto/imagem; prefira null.`;

async function runExtraction(messages: ModelMessage[]): Promise<CaptureExtract> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A IA da casa não está configurada neste ambiente.");

  const provider = createOpenAI({
    baseURL: GATEWAY_BASE_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createRunIdFetch(),
  });

  const result = streamText({
    model: provider.responses(MODEL),
    system: SYSTEM,
    messages,
    output: Output.object({ schema: captureExtractSchema }),
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const object = await result.output;
  if (!object) throw new Error("A IA não conseguiu ler dessa vez.");
  return object;
}

/** Extrai um registro estruturado de um texto solto ("troquei o filtro hoje"). */
export function extractFromText(text: string): Promise<CaptureExtract> {
  return runExtraction([
    {
      role: "user",
      content: [{ type: "text", text: `Extraia o registro desta frase:\n\n${text}` }],
    },
  ]);
}

/** Extrai de uma foto (nota fiscal, etiqueta, boleto, apólice). */
export function extractFromImage(image: Uint8Array, mediaType: string): Promise<CaptureExtract> {
  return runExtraction([
    {
      role: "user",
      content: [
        { type: "text", text: "Leia esta imagem e extraia o registro da casa." },
        { type: "image", image, mediaType },
      ],
    },
  ]);
}

/**
 * Conversa do zelador: roda o laço de ferramentas (até 8 passos) contra o banco
 * do próprio lar e devolve a resposta final. As fichas citadas ficam no array
 * que as ferramentas preenchem — a resposta nunca cita o que não consultou.
 */
export async function askHouseholdAssistant(opts: {
  system: string;
  messages: ModelMessage[];
  tools: ToolSet;
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A IA da casa não está configurada neste ambiente.");

  const provider = createOpenAI({
    baseURL: GATEWAY_BASE_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createRunIdFetch(),
  });

  const { text } = await generateText({
    model: provider.responses(MODEL),
    system: opts.system,
    messages: opts.messages,
    tools: opts.tools,
    stopWhen: isStepCount(8),
    providerOptions: { openai: { store: false } },
  });

  return text.trim() || "Não consegui responder dessa vez.";
}
