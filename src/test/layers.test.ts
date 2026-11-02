import { describe, expect, it } from "vitest";

import {
  activeLayerKeys,
  isLayerActive,
  nextWatering,
  sortByWatering,
  todayISO,
  wateringStatus,
} from "@/lib/layers";
import type { HouseholdLayer, Plant } from "@/lib/types";

function plant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: crypto.randomUUID(),
    household_id: "h1",
    name: "Samambaia",
    location: null,
    watering_interval_days: null,
    last_watered: null,
    created_at: "2026-11-01",
    ...overrides,
  };
}

function layer(layer: HouseholdLayer["layer"], active: boolean): HouseholdLayer {
  return { household_id: "h1", layer, active, created_at: "2026-11-01" };
}

const TODAY = new Date("2026-11-02T12:00:00");

describe("Camadas de vida — regras declaradas pelo usuário", () => {
  it("desligar uma camada a tira da navegação sem tocar nas outras", () => {
    const layers = [layer("pets", false)];
    expect(activeLayerKeys(layers)).toEqual(["veiculos", "jardim"]);
    expect(isLayerActive(layers, "pets")).toBe(false);
    expect(isLayerActive(layers, "jardim")).toBe(true);
  });

  it("sem interruptor registrado a casa vem com as três camadas ligadas", () => {
    expect(activeLayerKeys([])).toEqual(["veiculos", "pets", "jardim"]);
  });

  it("ligar de novo uma camada desligada a devolve para a navegação", () => {
    const off = [layer("veiculos", false)];
    expect(activeLayerKeys(off)).toEqual(["pets", "jardim"]);
    expect(activeLayerKeys([layer("veiculos", true)])).toEqual([
      "veiculos",
      "pets",
      "jardim",
    ]);
  });

  it("a próxima rega sai da última rega mais o intervalo da planta", () => {
    expect(
      nextWatering(plant({ last_watered: "2026-10-30", watering_interval_days: 3 })),
    ).toBe("2026-11-02");
    // Vira o mês sem escorregar dia: 29/10 + 3 dias = 01/11.
    expect(
      nextWatering(plant({ last_watered: "2026-10-29", watering_interval_days: 3 })),
    ).toBe("2026-11-01");
  });

  it("planta sem intervalo ou sem última rega não tem horário a cumprir", () => {
    expect(nextWatering(plant({ last_watered: "2026-10-30" }))).toBeNull();
    expect(
      nextWatering(plant({ watering_interval_days: 3 })),
    ).toBeNull();
    expect(wateringStatus(plant({ watering_interval_days: 3 }), TODAY)).toEqual({
      status: "sem_horario",
      next: null,
      days_left: null,
    });
  });

  it("o radar chama de atrasada a planta que passou da hora e de logo a que chega", () => {
    expect(
      wateringStatus(plant({ last_watered: "2026-10-25", watering_interval_days: 3 }), TODAY)
        .status,
    ).toBe("atrasada");
    expect(
      wateringStatus(plant({ last_watered: "2026-10-30", watering_interval_days: 3 }), TODAY)
        .status,
    ).toBe("logo");
    expect(
      wateringStatus(plant({ last_watered: "2026-11-01", watering_interval_days: 7 }), TODAY)
        .status,
    ).toBe("em_dia");
  });

  it("o jardim ordena pelo que precisa de água primeiro", () => {
    const rows = sortByWatering(
      [
        plant({ name: "Em dia", last_watered: "2026-11-01", watering_interval_days: 7 }),
        plant({ name: "Atrasada", last_watered: "2026-10-25", watering_interval_days: 3 }),
        plant({ name: "Sem horário" }),
        plant({ name: "Logo", last_watered: "2026-10-30", watering_interval_days: 3 }),
      ],
      TODAY,
    );
    expect(rows.map((r) => r.plant.name)).toEqual([
      "Atrasada",
      "Logo",
      "Em dia",
      "Sem horário",
    ]);
  });

  it("hoje é o dia local de quem usa a casa, não o dia UTC", () => {
    // 23h de 2/11 no fuso local ainda é 2/11, embora UTC já seja 3/11.
    const late = new Date("2026-11-02T23:00:00");
    expect(todayISO(late)).toBe("2026-11-02");
  });
});
