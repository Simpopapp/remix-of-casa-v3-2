import { describe, expect, it } from "vitest";

import {
  buildClaimPackage,
  buildDossier,
  buildMovingChecklist,
  buildYearReview,
  movingProgress,
} from "@/lib/moments";

describe("Momentos de virada — regras declaradas pelo usuário", () => {
  it("checklist de mudança nasce do inventário, cômodo por cômodo", () => {
    const checklist = buildMovingChecklist(
      [
        { id: "r2", name: "Quarto", sort_order: 2 },
        { id: "r1", name: "Cozinha", sort_order: 1 },
      ],
      [
        { id: "a1", name: "Geladeira", room_id: "r1" },
        { id: "a2", name: "Cama", room_id: "r2" },
        { id: "a3", name: "Bicicleta", room_id: null },
      ],
    );
    expect(checklist.map((r) => r.room_name)).toEqual([
      "Cozinha",
      "Quarto",
      "Sem cômodo",
    ]);
    expect(checklist[0]!.items[0]!.name).toBe("Geladeira");
    expect(checklist[2]!.items[0]!.name).toBe("Bicicleta");
  });

  it("progresso da mudança conta os itens marcados sobre o total", () => {
    const checklist = buildMovingChecklist(
      [{ id: "r1", name: "Cozinha", sort_order: 1 }],
      [
        { id: "a1", name: "Geladeira", room_id: "r1" },
        { id: "a2", name: "Fogão", room_id: "r1" },
      ],
    );
    expect(movingProgress(checklist, new Set(["a1"]))).toEqual({
      done: 1,
      total: 2,
      pct: 50,
    });
    expect(movingProgress([], new Set())).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it("dossiê traz o histórico real: manutenções contadas por objeto", () => {
    const dossier = buildDossier(
      [{ id: "r1", name: "Cozinha", sort_order: 1 }],
      [
        {
          id: "a1",
          name: "Geladeira",
          category: "Eletrodoméstico",
          room_id: "r1",
          purchase_date: "2024-01-10",
          purchase_price: 3500,
          warranty_expires: null,
        },
      ],
      [{ asset_id: "a1" }, { asset_id: "a1" }, { asset_id: "a1" }],
      [{ title: "Escritura", category: "Imóvel", room_id: null, expires_at: null }],
    );
    expect(dossier.sections[0]!.assets[0]!.maintenances).toBe(3);
    expect(dossier.totalMaintenances).toBe(3);
    expect(dossier.houseDocuments[0]!.title).toBe("Escritura");
  });

  it("pacote de sinistro soma só o que tem valor e aponta o que falta comprovar", () => {
    const pkg = buildClaimPackage(
      [
        {
          id: "a1",
          name: "Geladeira",
          room_id: "r1",
          purchase_price: 3500,
          purchase_date: "2024-01-10",
        },
        {
          id: "a2",
          name: "TV",
          room_id: "r1",
          purchase_price: 2000,
          purchase_date: null,
        },
        { id: "a3", name: "Banquinho", room_id: "r1", purchase_price: null, purchase_date: null },
      ],
      [{ id: "r1", name: "Cozinha" }],
      [{ asset_id: "a1" }, { asset_id: null }],
    );
    expect(pkg.totalValue).toBe(5500);
    expect(pkg.items).toHaveLength(2);
    expect(pkg.items[0]!.name).toBe("Geladeira");
    expect(pkg.items[0]!.proofs).toBe(1);
    expect(pkg.withoutProof).toBe(1);
  });

  it("retrospectiva soma gastos, eventos e serviços só do ano pedido", () => {
    const review = buildYearReview(
      2026,
      [
        { amount: 400, date: "2026-03-10" },
        { amount: 999, date: "2025-12-31" },
      ],
      [{ cost: 250, date: "2026-03-20" }],
      [{ cost: 380, date: "2026-07-05" }],
    );
    expect(review.totalSpent).toBe(1030);
    expect(review.maintenances).toBe(1);
    expect(review.services).toBe(1);
    expect(review.months).toEqual([
      { month: "2026-03", total: 650 },
      { month: "2026-07", total: 380 },
    ]);
    expect(review.heaviestMonth?.month).toBe("2026-03");
  });

  it("ano sem registros não inventa história", () => {
    const review = buildYearReview(2026, [], [], []);
    expect(review.totalSpent).toBe(0);
    expect(review.months).toEqual([]);
    expect(review.heaviestMonth).toBeNull();
  });
});
