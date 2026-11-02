// As ferramentas do zelador: consultas honestas ao banco do próprio lar.
// Server-only — roda com o client do usuário autenticado, então a RLS vale
// para cada consulta. Toda ferramenta devolve também as fichas que usou,
// para a resposta poder citar a origem em vez de inventar.
import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export interface Citation {
  label: string;
  to: string;
}

export interface ZeladorCtx {
  supabase: SupabaseClient<Database>;
  householdId: string;
  citations: Citation[];
}

type Client = SupabaseClient<Database>;

const EMPTY = "Nada encontrado nos registros desta casa.";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateBefore(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function dateAfter(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function cite(ctx: ZeladorCtx, citation: Citation) {
  if (!ctx.citations.some((c) => c.to === citation.to)) ctx.citations.push(citation);
}

/** Casa o nome dito pela pessoa com um cômodo real da casa (sem acento/caixa). */
async function findRoom(ctx: ZeladorCtx, nome: string) {
  const { data, error } = await ctx.supabase
    .from("rooms")
    .select("id, name")
    .eq("household_id", ctx.householdId)
    .ilike("name", `%${nome.trim()}%`);
  if (error) throw new Error(error.message);
  return (data ?? [])[0] ?? null;
}

async function roomAssetIds(client: Client, householdId: string, roomId: string) {
  const { data, error } = await client
    .from("assets")
    .select("id")
    .eq("household_id", householdId)
    .eq("room_id", roomId);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((a) => a.id));
}

/** Os gastos que pertencem a um cômodo: os lançados nele e os dos objetos dele. */
async function roomExpenses(ctx: ZeladorCtx, roomId: string, since: string) {
  const assetIds = await roomAssetIds(ctx.supabase, ctx.householdId, roomId);
  const { data, error } = await ctx.supabase
    .from("expenses")
    .select("id, amount, date, description, category, room_id, asset_id")
    .eq("household_id", ctx.householdId)
    .gte("date", since);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((e) => e.room_id === roomId || (e.asset_id && assetIds.has(e.asset_id)));
}

export function buildZeladorTools(ctx: ZeladorCtx) {
  return {
    gastos_por_comodo: tool({
      description:
        "Quanto a casa gastou com um cômodo num período. Use para perguntas de dinheiro por cômodo (cozinha, quarto…).",
      inputSchema: z.object({
        comodo: z.string().describe("Nome do cômodo, ex.: Cozinha"),
        anos: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(2)
          .describe("Quantos anos para trás considerar"),
      }),
      execute: async ({ comodo, anos }) => {
        const room = await findRoom(ctx, comodo);
        if (!room) return { erro: `Não achei o cômodo "${comodo}" nesta casa.` };
        const since = dateBefore(anos);
        const rows = await roomExpenses(ctx, room.id, since);
        const total = rows.reduce((s, e) => s + Number(e.amount ?? 0), 0);
        cite(ctx, { label: room.name, to: `/comodo/${room.id}` });
        return {
          comodo: room.name,
          desde: since,
          total,
          lancamentos: rows.length,
          exemplos: rows
            .slice(0, 5)
            .map((e) => `${e.date}: ${e.description ?? e.category} — ${Number(e.amount)}`),
        };
      },
    }),

    gastos_gerais: tool({
      description: "Quanto a casa gastou no total num período, com quebra por categoria.",
      inputSchema: z.object({
        anos: z.number().int().min(1).max(20).default(1).describe("Quantos anos para trás"),
        categoria: z.string().optional().describe("Filtrar por categoria, se pedirem"),
      }),
      execute: async ({ anos, categoria }) => {
        const since = dateBefore(anos);
        let query = ctx.supabase
          .from("expenses")
          .select("id, amount, date, description, category, kind")
          .eq("household_id", ctx.householdId)
          .gte("date", since);
        if (categoria) query = query.ilike("category", `%${categoria}%`);
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        const rows = data ?? [];
        if (rows.length === 0) return { erro: EMPTY };
        const total = rows.reduce((s, e) => s + Number(e.amount ?? 0), 0);
        const byCat = new Map<string, number>();
        for (const e of rows) {
          byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount ?? 0));
        }
        return {
          desde: since,
          total,
          lancamentos: rows.length,
          por_categoria: [...byCat.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([c, v]) => `${c}: ${v}`),
        };
      },
    }),

    proximas_obrigacoes: tool({
      description:
        "O que vence nos próximos meses (contas, tributos, seguros, revisões), com valor e data.",
      inputSchema: z.object({
        meses: z.number().int().min(1).max(36).default(3).describe("Janela em meses"),
      }),
      execute: async ({ meses }) => {
        const horizon = new Date();
        horizon.setMonth(horizon.getMonth() + meses);
        const horizonISO = horizon.toISOString().slice(0, 10);
        const { data, error } = await ctx.supabase
          .from("obligations")
          .select("id, title, kind, amount, frequency, next_due")
          .eq("household_id", ctx.householdId)
          .gte("next_due", todayISO())
          .lte("next_due", horizonISO)
          .order("next_due")
          .limit(25);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) return { erro: EMPTY };
        cite(ctx, { label: "Radar da casa", to: "/obrigacoes" });
        return {
          itens: data.map((o) => ({
            titulo: o.title,
            tipo: o.kind,
            valor: o.amount == null ? null : Number(o.amount),
            vence: o.next_due,
            frequencia: o.frequency,
          })),
        };
      },
    }),

    garantias_por_vencer: tool({
      description: "Objetos cuja garantia está perto de acabar. Útil antes de chamar um técnico.",
      inputSchema: z.object({
        dias: z.number().int().min(1).max(365).default(60).describe("Janela em dias"),
      }),
      execute: async ({ dias }) => {
        const horizon = dateAfter(dias);
        const { data, error } = await ctx.supabase
          .from("assets")
          .select("id, name, warranty_expires, extended_warranty_expires")
          .eq("household_id", ctx.householdId)
          .not("warranty_expires", "is", null)
          .lte("warranty_expires", horizon)
          .order("warranty_expires")
          .limit(20);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) return { erro: EMPTY };
        for (const a of data) cite(ctx, { label: a.name, to: `/ativo/${a.id}` });
        return {
          janela_dias: dias,
          itens: data.map((a) => ({
            objeto: a.name,
            garantia_ate: a.warranty_expires,
            garantia_estendida_ate: a.extended_warranty_expires,
          })),
        };
      },
    }),

    documentos_por_vencer: tool({
      description: "Documentos do cofre que expiram em breve (laudos, apólices, atestados).",
      inputSchema: z.object({
        dias: z.number().int().min(1).max(365).default(60).describe("Janela em dias"),
      }),
      execute: async ({ dias }) => {
        const horizon = dateAfter(dias);
        const { data, error } = await ctx.supabase
          .from("documents")
          .select("id, title, category, expires_at")
          .eq("household_id", ctx.householdId)
          .not("expires_at", "is", null)
          .gte("expires_at", todayISO())
          .lte("expires_at", horizon)
          .order("expires_at")
          .limit(20);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) return { erro: EMPTY };
        cite(ctx, { label: "Cofre de documentos", to: "/documentos" });
        return {
          itens: data.map((d) => ({ titulo: d.title, tipo: d.category, vence: d.expires_at })),
        };
      },
    }),

    historico_objeto: tool({
      description:
        "O que já aconteceu com um objeto da casa: manutenções, reparos, trocas e o que custou.",
      inputSchema: z.object({
        objeto: z.string().describe("Nome do objeto, ex.: geladeira"),
      }),
      execute: async ({ objeto }) => {
        const { data: assets, error: aErr } = await ctx.supabase
          .from("assets")
          .select("id, name, room_id")
          .eq("household_id", ctx.householdId)
          .ilike("name", `%${objeto.trim()}%`);
        if (aErr) throw new Error(aErr.message);
        const asset = (assets ?? [])[0];
        if (!asset) return { erro: `Não achei "${objeto}" na casa.` };
        const { data, error } = await ctx.supabase
          .from("asset_events")
          .select("id, kind, date, description, cost")
          .eq("asset_id", asset.id)
          .order("date", { ascending: false })
          .limit(15);
        if (error) throw new Error(error.message);
        cite(ctx, { label: asset.name, to: `/ativo/${asset.id}` });
        const custo = (data ?? []).reduce((s, e) => s + Number(e.cost ?? 0), 0);
        return {
          objeto: asset.name,
          gastado_com_ele: custo,
          eventos: (data ?? []).map((e) => ({
            quando: e.date,
            tipo: e.kind,
            descricao: e.description,
            custo: e.cost == null ? null : Number(e.cost),
          })),
        };
      },
    }),
  };
}
