import { describe, expect, it } from "vitest";

import {
  costByRoom,
  forecast12Months,
  monthlyAverage,
  ownershipCost,
  projectProgress,
  reserveSuggestion,
} from "@/lib/money";
import type { MoneyExpense } from "@/lib/money";

function expense(roomId: string | null, roomName: string | null, amount: number, date: string): MoneyExpense {
  return {
    id: crypto.randomUUID(),
    amount,
    date,
    room_id: roomId,
    room_name: roomName,
    asset_name: null,
  };
}

describe("Dinheiro da casa — regras declaradas pelo usuário", () => {
  it("média mensal usa só os últimos 12 meses e divide pelos meses com registro", () => {
    // 3 lançamentos no mesmo mês: total 300, um mês coberto → média 300.
    const expenses = [
      expense("r1", "Cozinha", 100, "2026-11-05"),
      expense("r1", "Cozinha", 100, "2026-11-10"),
      expense("r2", "Jardim", 100, "2026-11-15"),
    ];
    const avg = monthlyAverage(expenses, 12, new Date("2026-11-20T12:00:00"));
    expect(avg).toBe(300);
  });

  it("gasto mais velho que 12 meses não entra na média", () => {
    const expenses = [
      expense(null, null, 1200, "2025-05-01"),
      expense(null, null, 200, "2026-10-01"),
    ];
    const avg = monthlyAverage(expenses, 12, new Date("2026-11-02T12:00:00"));
    // Só o gasto de 2026-10 entra: 200 em 2 meses cobertos → 100.
    expect(avg).toBe(100);
  });

  it("custo por cômodo agrupa e ordena do maior para o menor", () => {
    const byRoom = costByRoom([
      expense("r1", "Cozinha", 250, "2026-10-01"),
      expense("r2", "Jardim", 90, "2026-10-02"),
      expense("r1", "Cozinha", 60, "2026-10-03"),
      expense(null, null, 40, "2026-10-04"),
    ]);
    expect(byRoom[0]).toMatchObject({ room_name: "Cozinha", total: 310 });
    expect(byRoom[1]).toMatchObject({ room_name: "Jardim", total: 90 });
    expect(byRoom[2]).toMatchObject({ room_name: "Sem cômodo", total: 40 });
  });

  it("custo de propriedade soma compra + eventos + serviços", () => {
    expect(
      ownershipCost({
        purchase_price: 1000,
        events: [{ cost: 120 }, { cost: null }],
        services: [{ cost: 80 }],
      }),
    ).toBe(1200);
  });

  it("previsão de 12 meses projeta a recorrência mensal real", () => {
    const { total } = forecast12Months(
      [
        {
          title: "IPTU",
          amount: 350,
          next_due: "2026-11-10",
          frequency: "monthly",
          custom_interval_days: null,
        },
      ],
      new Date("2026-11-02T12:00:00"),
    );
    // 12 parcelas de 350 nos próximos 12 meses.
    expect(total).toBe(4200);
  });

  it("reserva sugerida é 3 meses do previsto; sem previsão, usa a média real", () => {
    expect(reserveSuggestion(350, 900)).toBe(1050);
    expect(reserveSuggestion(0, 900)).toBe(2700);
  });

  it("projeto mostra porcentagem só quando há orçamento planejado", () => {
    const withPlan = projectProgress({
      id: "p1",
      household_id: "h1",
      name: "Cozinha",
      budget_planned: 1000,
      budget_spent: 250,
      status: "andamento",
      start_date: null,
      end_date: null,
      notes: null,
      created_at: "2026-11-01",
    });
    expect(withPlan.pct).toBe(25);

    const noPlan = projectProgress({
      id: "p2",
      household_id: "h1",
      name: "Varanda",
      budget_planned: null,
      budget_spent: 300,
      status: "andamento",
      start_date: null,
      end_date: null,
      notes: null,
      created_at: "2026-11-01",
    });
    expect(noPlan.pct).toBeNull();
    expect(noPlan.spent).toBe(300);
  });
});
