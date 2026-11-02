import { describe, expect, it } from "vitest";

import { buildLoadMap } from "@/lib/load-map";

const NOW = new Date("2026-11-02T12:00:00");

describe("Mapa de carga — regras declaradas pelo usuário", () => {
  it("o mapa reflete os responsáveis reais das obrigações", () => {
    const result = buildLoadMap(
      [
        { id: "m1", display_name: "Ana" },
        { id: "m2", display_name: "Beto" },
      ],
      [
        { id: "o1", responsible_member_id: "m1", amount: 100 },
        { id: "o2", responsible_member_id: "m1", amount: 50 },
        { id: "o3", responsible_member_id: "m2", amount: 200 },
      ],
      [],
      NOW,
    );
    const ana = result.load.find((e) => e.member_id === "m1");
    const beto = result.load.find((e) => e.member_id === "m2");
    expect(ana!.items).toBe(2);
    expect(beto!.items).toBe(1);
  });

  it("obrigação sem responsável cai no balde de ninguém", () => {
    const result = buildLoadMap(
      [{ id: "m1", display_name: "Ana" }],
      [
        { id: "o1", responsible_member_id: null, amount: 80 },
        { id: "o2", responsible_member_id: "m1", amount: 100 },
      ],
      [],
      NOW,
    );
    expect(result.unassigned.items).toBe(1);
    expect(result.load).toHaveLength(1);
  });

  it("vencimento além de 30 dias não pesa no mapa", () => {
    const result = buildLoadMap(
      [{ id: "m1", display_name: "Ana" }],
      [{ id: "o1", responsible_member_id: "m1", amount: 300 }],
      [
        { obligation_id: "o1", due_date: "2026-11-20" }, // dentro de 30 dias
        { obligation_id: "o1", due_date: "2027-02-01" }, // fora da janela
      ],
      NOW,
    );
    const ana = result.load[0]!;
    expect(ana.due_30).toBe(1);
    expect(ana.amount_30).toBe(300);
  });

  it("vencimento atrasado conta — é o peso maior", () => {
    const result = buildLoadMap(
      [{ id: "m1", display_name: "Ana" }],
      [{ id: "o1", responsible_member_id: "m1", amount: 150 }],
      [{ obligation_id: "o1", due_date: "2026-10-01" }],
      NOW,
    );
    expect(result.load[0]!.due_30).toBe(1);
    expect(result.load[0]!.amount_30).toBe(150);
  });

  it("a ordem é por impacto: mais vencimentos perto vem primeiro", () => {
    const result = buildLoadMap(
      [
        { id: "m1", display_name: "Ana" },
        { id: "m2", display_name: "Beto" },
      ],
      [
        { id: "o1", responsible_member_id: "m1", amount: 10 },
        { id: "o2", responsible_member_id: "m2", amount: 20 },
      ],
      [
        { obligation_id: "o2", due_date: "2026-11-10" },
        { obligation_id: "o2", due_date: "2026-11-15" },
        { obligation_id: "o1", due_date: "2026-11-12" },
      ],
      NOW,
    );
    expect(result.load[0]!.member_id).toBe("m2");
    expect(result.load[1]!.member_id).toBe("m1");
  });

  it("casa sem obrigações tem mapa vazio e nada sem dono", () => {
    const result = buildLoadMap([{ id: "m1", display_name: "Ana" }], [], [], NOW);
    expect(result.load).toHaveLength(0);
    expect(result.unassigned).toEqual({ items: 0, due_30: 0, amount_30: 0 });
  });
});
