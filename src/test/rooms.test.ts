import { describe, expect, it } from "vitest";

import { GRID_H, GRID_W, canPlace, fitsInGrid, overlaps } from "@/lib/plant";
import { roomPulses } from "@/lib/pulse";

describe("Construtor da planta", () => {
  it("não deixa um cômodo invadir outro", () => {
    const sala = { x: 0, y: 0, w: 3, h: 3 };
    const cozinhaInvadindo = { x: 2, y: 0, w: 2, h: 2 };
    expect(canPlace(cozinhaInvadindo, [sala])).toBe(false);
  });

  it("permite cômodos encostados, sem sobrepor", () => {
    const sala = { x: 0, y: 0, w: 3, h: 3 };
    const cozinhaEncostada = { x: 3, y: 0, w: 2, h: 2 };
    expect(overlaps(sala, cozinhaEncostada)).toBe(false);
    expect(canPlace(cozinhaEncostada, [sala])).toBe(true);
  });

  it("não deixa um cômodo sair da grade", () => {
    expect(canPlace({ x: GRID_W - 1, y: 0, w: 3, h: 1 }, [])).toBe(false);
    expect(canPlace({ x: 0, y: GRID_H - 1, w: 1, h: 3 }, [])).toBe(false);
    expect(canPlace({ x: -1, y: 0, w: 1, h: 1 }, [])).toBe(false);
    expect(fitsInGrid({ x: 0, y: 0, w: GRID_W, h: GRID_H })).toBe(true);
  });

  it("mover um cômodo ignora a posição atual dele", () => {
    const sala = { x: 0, y: 0, w: 3, h: 3 };
    // mover a própria sala para (2, 2) colidiria com ela mesma se não ignorasse
    expect(canPlace({ x: 2, y: 2, w: 3, h: 3 }, [sala], 0)).toBe(true);
  });
});

describe("Pulso por cômodo", () => {
  it("reflete apenas o que está dentro do cômodo", () => {
    const pulses = roomPulses(["cozinha", "sala"], {
      obligations: [
        {
          room_id: "cozinha",
          next_due: "2026-10-01",
          occurrences: [{ status: "pendente", due_date: "2026-10-01" }],
        },
      ],
      assets: [],
      documents: [],
    });
    const cozinha = pulses.get("cozinha");
    const sala = pulses.get("sala");
    expect(cozinha).toBeDefined();
    expect(sala).toBeDefined();
    expect(cozinha!.score).toBeLessThan(sala!.score);
    expect(sala!.level).toBe("tranquilo");
  });
});
