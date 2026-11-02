import { describe, expect, it } from "vitest";

import {
  assetLife,
  documentState,
  providerMemory,
  sortByUrgency,
  warrantyState,
} from "@/lib/inventory";

// 2026-11-01T12:00:00Z — o "hoje" fixo de todos os testes desta fase.
const TODAY = Date.parse("2026-11-01T12:00:00Z");

describe("Garantia da ficha viva", () => {
  it("usa a garantia estendida quando ela existe", () => {
    const info = warrantyState(
      { warranty_expires: "2026-11-10", extended_warranty_expires: "2027-06-01" },
      TODAY,
    );
    expect(info.ref).toBe("2027-06-01");
    expect(info.state).toBe("valida");
  });

  it("avisa quando a garantia acaba em até 30 dias", () => {
    const info = warrantyState(
      { warranty_expires: "2026-11-20", extended_warranty_expires: null },
      TODAY,
    );
    expect(info.state).toBe("vencendo");
    expect(info.days).toBe(19);
  });

  it("marca como vencida uma garantia do mês passado", () => {
    const info = warrantyState(
      { warranty_expires: "2026-10-02", extended_warranty_expires: null },
      TODAY,
    );
    expect(info.state).toBe("vencida");
    expect(info.days).toBe(-30);
  });

  it("diz que não há garantia registrada", () => {
    const info = warrantyState(
      { warranty_expires: null, extended_warranty_expires: null },
      TODAY,
    );
    expect(info.state).toBe("sem_garantia");
  });
});

describe("Vida útil e custo acumulado", () => {
  const geladeira = {
    purchase_date: "2024-05-01",
    purchase_price: 4000,
    useful_life_months: 120,
  };

  it("soma o que a casa já gastou cuidando do objeto", () => {
    const life = assetLife(geladeira, [{ cost: 380 }, { cost: null }, { cost: 120 }], TODAY);
    expect(life.spentOnCare).toBe(500);
  });

  it("levanta a conversa sobre trocar quando o cuidado passou de metade de um novo", () => {
    const life = assetLife(geladeira, [{ cost: 1600 }, { cost: 600 }], TODAY);
    expect(life.careVsNew).toBe(0.55);
    expect(life.worthReplacing).toBe(true);
  });

  it("não sugere troca enquanto o cuidado for barato diante de um novo", () => {
    const life = assetLife(geladeira, [{ cost: 200 }], TODAY);
    expect(life.worthReplacing).toBe(false);
  });

  it("calcula quanto tempo de vida resta", () => {
    const life = assetLife(geladeira, [], TODAY);
    // comprada em mai/2024, hoje nov/2026 → 30 meses de uso, de uma vida de 120
    expect(life.ageMonths).toBe(30);
    expect(life.remainingMonths).toBe(90);
  });

  it("não inventa estimativa sem preço de compra", () => {
    const life = assetLife(
      { purchase_date: null, purchase_price: null, useful_life_months: null },
      [{ cost: 100 }],
      TODAY,
    );
    expect(life.careVsNew).toBeNull();
    expect(life.worthReplacing).toBe(false);
    expect(life.remainingMonths).toBeNull();
  });
});

describe("Memória de prestador", () => {
  it("resume notas, gastos e a disposição de chamar de novo", () => {
    const memory = providerMemory([
      { date: "2026-03-10", cost: 380, rating: 5, would_hire_again: true },
      { date: "2026-08-02", cost: 220, rating: 4, would_hire_again: true },
      { date: "2026-09-15", cost: null, rating: null, would_hire_again: false },
    ]);
    expect(memory.services).toBe(3);
    expect(memory.totalSpent).toBe(600);
    expect(memory.avgRating).toBe(4.5);
    expect(memory.wouldHireAgain).toBeCloseTo(2 / 3, 5);
    expect(memory.lastService).toBe("2026-09-15");
    expect(memory.verdict).toBe("confia");
  });

  it("recomenda evitar quem a casa não chamaria de novo", () => {
    const memory = providerMemory([
      { date: "2026-01-05", cost: 900, rating: 1, would_hire_again: false },
      { date: "2026-02-11", cost: 400, rating: 2, would_hire_again: false },
    ]);
    expect(memory.verdict).toBe("evitar");
  });

  it("fica neutro quando ainda não há opinião registrada", () => {
    const memory = providerMemory([
      { date: "2026-05-01", cost: 150, rating: null, would_hire_again: null },
    ]);
    expect(memory.verdict).toBe("neutro");
    expect(memory.avgRating).toBeNull();
    expect(memory.wouldHireAgain).toBeNull();
  });
});

describe("Validade no cofre", () => {
  it("separa o que vence em breve do que está em dia", () => {
    expect(documentState({ expires_at: "2026-11-15" }, TODAY).state).toBe("vence_breve");
    expect(documentState({ expires_at: "2027-04-15" }, TODAY).state).toBe("em_dia");
    expect(documentState({ expires_at: "2026-10-20" }, TODAY).state).toBe("vencido");
    expect(documentState({ expires_at: null }, TODAY).state).toBe("sem_validade");
  });

  it("põe primeiro o que pede ação, e deixa o sem validade por último", () => {
    const docs = [
      { id: "apólice", expires_at: "2027-09-01" },
      { id: "matrícula", expires_at: null },
      { id: "laudo", expires_at: "2026-10-15" },
      { id: "certidão", expires_at: "2026-11-20" },
    ];
    expect(sortByUrgency(docs, TODAY).map((d) => d.id)).toEqual([
      "laudo",
      "certidão",
      "apólice",
      "matrícula",
    ]);
  });
});
