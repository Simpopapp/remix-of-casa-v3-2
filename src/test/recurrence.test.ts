import { describe, expect, it } from "vitest";

import { advanceDate, nextDueAfter, occurrenceDates } from "@/lib/recurrence";

const UNTIL = new Date("2027-06-30T12:00:00");

describe("advanceDate", () => {
  it("compromisso único não se repete", () => {
    expect(advanceDate("2026-06-10", "one_time")).toBeNull();
  });

  it("mensal avança um mês mantendo o dia", () => {
    expect(advanceDate("2026-01-10", "monthly")).toBe("2026-02-10");
  });

  it("mensal no dia 31 cai no último dia de fevereiro, sem pular mês", () => {
    expect(advanceDate("2026-01-31", "monthly")).toBe("2026-02-28");
  });

  it("trimestral avança três meses", () => {
    expect(advanceDate("2026-01-15", "quarterly")).toBe("2026-04-15");
  });

  it("semestral avança seis meses", () => {
    expect(advanceDate("2026-03-20", "semiannual")).toBe("2026-09-20");
  });

  it("anual respeita ano bissexto", () => {
    expect(advanceDate("2026-02-28", "yearly")).toBe("2027-02-28");
  });

  it("custom avança o intervalo em dias", () => {
    expect(advanceDate("2026-01-01", "custom", 45)).toBe("2026-02-15");
  });

  it("custom sem intervalo cai no padrão de 30 dias", () => {
    expect(advanceDate("2026-01-01", "custom", null)).toBe("2026-01-31");
  });
});

describe("occurrenceDates", () => {
  it("compromisso único gera uma só data", () => {
    expect(
      occurrenceDates({ nextDue: "2026-08-05", frequency: "one_time", until: UNTIL }),
    ).toEqual(["2026-08-05"]);
  });

  it("mensal gera uma data por mês até o limite", () => {
    const dates = occurrenceDates({
      nextDue: "2026-06-10",
      frequency: "monthly",
      until: new Date("2026-09-30T12:00:00"),
    });
    expect(dates).toEqual(["2026-06-10", "2026-07-10", "2026-08-10", "2026-09-10"]);
  });

  it("não inclui datas depois do limite", () => {
    const dates = occurrenceDates({
      nextDue: "2027-08-01",
      frequency: "monthly",
      until: UNTIL,
    });
    expect(dates).toEqual([]);
  });

  it("anual dentro da janela de 12 meses gera no máximo duas datas", () => {
    const dates = occurrenceDates({
      nextDue: "2026-07-01",
      frequency: "yearly",
      until: new Date("2027-07-01T12:00:00"),
    });
    expect(dates).toEqual(["2026-07-01", "2027-07-01"]);
  });
});

describe("nextDueAfter", () => {
  it("ao concluir uma mensal, o próximo vencimento é o mês seguinte", () => {
    expect(nextDueAfter("2026-06-10", "monthly")).toBe("2026-07-10");
  });

  it("ao concluir uma única, não há próximo vencimento", () => {
    expect(nextDueAfter("2026-06-10", "one_time")).toBeNull();
  });
});
