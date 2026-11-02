import { describe, expect, it } from "vitest";

import { warrantySuggestions } from "@/lib/suggestions";
import type { Asset } from "@/lib/types";

const TODAY = new Date("2026-11-02T12:00:00");

function asset(over: Partial<Asset>): Asset {
  return {
    id: "a1",
    household_id: "h1",
    room_id: null,
    name: "Geladeira",
    category: "eletrodomestico",
    brand: null,
    model: null,
    serial: null,
    purchase_date: null,
    purchase_price: null,
    store: null,
    warranty_expires: null,
    extended_warranty_expires: null,
    useful_life_months: null,
    photo_url: null,
    notes: null,
    created_at: "2026-01-01T00:00:00",
    ...over,
  };
}

describe("sugestão de garantia na home", () => {
  it("sugere o objeto cuja garantia vence em 20 dias", () => {
    const got = warrantySuggestions([asset({ warranty_expires: "2026-11-22" })], TODAY);
    expect(got).toHaveLength(1);
    expect(got[0]?.name).toBe("Geladeira");
    expect(got[0]?.daysLeft).toBe(20);
  });

  it("usa a garantia estendida quando ela cobre mais", () => {
    const got = warrantySuggestions(
      [asset({ warranty_expires: "2026-11-05", extended_warranty_expires: "2026-12-20" })],
      TODAY,
    );
    expect(got[0]?.coversUntil).toBe("2026-12-20");
    expect(got[0]?.daysLeft).toBe(48);
  });

  it("não sugere garantia já vencida nem cobertura distante", () => {
    const got = warrantySuggestions(
      [
        asset({ id: "v", name: "Forno", warranty_expires: "2026-10-01" }),
        asset({ id: "d", name: "Sofá", warranty_expires: "2027-06-01" }),
      ],
      TODAY,
    );
    expect(got).toEqual([]);
  });

  it("ordena por quem vence primeiro", () => {
    const got = warrantySuggestions(
      [
        asset({ id: "b", name: "Depois", warranty_expires: "2026-12-15" }),
        asset({ id: "a", name: "Antes", warranty_expires: "2026-11-10" }),
      ],
      TODAY,
    );
    expect(got.map((s) => s.name)).toEqual(["Antes", "Depois"]);
  });
});
