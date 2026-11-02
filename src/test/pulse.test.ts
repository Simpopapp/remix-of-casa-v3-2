import { describe, expect, it } from "vitest";

import { computePulse, pulseImprovements, pulseTimeline } from "@/lib/pulse";

describe("computePulse", () => {
  it("stays tranquilo with nothing pending", () => {
    const result = computePulse({ obligations: [], assets: [], documents: [] });
    expect(result.score).toBe(100);
    expect(result.level).toBe("tranquilo");
    expect(result.factors).toHaveLength(0);
  });

  it("penalizes overdue obligations more than upcoming ones", () => {
    const base = {
      assets: [],
      documents: [],
    };
    const overdue = computePulse({
      ...base,
      obligations: [
        {
          next_due: "2026-10-01",
          occurrences: [{ status: "pendente", due_date: "2026-10-01" }],
        },
      ],
    });
    const upcoming = computePulse({
      ...base,
      obligations: [
        {
          next_due: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
          occurrences: [],
        },
      ],
    });
    expect(overdue.score).toBeLessThan(100);
    expect(upcoming.score).toBeLessThan(100);
    expect(overdue.score).toBeLessThan(upcoming.score);
  });

  it("drops to urgente with overdue obligations plus expired documents", () => {
    const result = computePulse({
      obligations: Array.from({ length: 5 }, (_, i) => ({
        next_due: "2026-09-01",
        occurrences: [{ status: "pendente", due_date: "2026-09-0" + (i + 1) }],
      })),
      assets: [],
      documents: [
        { expires_at: "2026-09-15" },
        { expires_at: "2026-09-20" },
        { expires_at: "2026-09-25" },
      ],
    });
    expect(result.level).toBe("urgente");
    expect(result.score).toBeLessThan(55);
  });

  it("flags warranties ending within 30 days", () => {
    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const result = computePulse({
      obligations: [],
      assets: [{ warranty_expires: soon, extended_warranty_expires: null }],
      documents: [],
    });
    expect(result.factors.some((f) => f.label === "Garantias acabando")).toBe(true);
  });
});

describe("pulseImprovements", () => {
  it("puts what recovers the most points first", () => {
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    const pulse = computePulse({
      obligations: [
        { next_due: "2026-10-01", occurrences: [{ status: "pendente", due_date: "2026-10-01" }] },
        { next_due: inThreeDays, occurrences: [] },
      ],
      assets: [],
      documents: [],
    });
    const got = pulseImprovements(pulse);
    expect(got[0]).toMatchObject({ action: "Pagar o que passou da data", recovers: 10 });
    expect(got.map((i) => i.recovers)).toEqual([10, 3]);
  });

  it("invents nothing when the house is in order", () => {
    const pulse = computePulse({ obligations: [], assets: [], documents: [] });
    expect(pulseImprovements(pulse)).toEqual([]);
  });
});

describe("pulseTimeline", () => {
  const TODAY = new Date("2026-11-02T12:00:00");

  it("projects a monthly obligation across 12 months with the right totals", () => {
    const months = pulseTimeline(
      [{ title: "IPTU", amount: 350, next_due: "2026-11-10", frequency: "monthly" }],
      TODAY,
    );
    expect(months).toHaveLength(12);
    expect(months[0]?.key).toBe("2026-11");
    expect(months[0]?.expected).toBe(350);
    expect(months[11]?.key).toBe("2027-10");
    expect(months[11]?.expected).toBe(350);
  });

  it("leaves out a one-time obligation whose date already passed", () => {
    const months = pulseTimeline(
      [{ title: "Mudança", amount: 400, next_due: "2026-01-10", frequency: "one_time" }],
      TODAY,
    );
    expect(months.every((m) => m.items.length === 0 && m.expected === 0)).toBe(true);
  });

  it("shows an item without inventing a cost when the amount is unknown", () => {
    const months = pulseTimeline(
      [{ title: "Revisão do carro", amount: null, next_due: "2026-12-05", frequency: "yearly" }],
      TODAY,
    );
    expect(months[1]?.items.map((i) => i.title)).toEqual(["Revisão do carro"]);
    expect(months[1]?.expected).toBe(0);
  });
});
