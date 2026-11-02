import { describe, expect, it } from "vitest";

import { resolveAssetEventTarget } from "@/lib/capture-target";

describe("resolveAssetEventTarget", () => {
  it("usa o objeto já cadastrado quando a pessoa escolheu um", () => {
    expect(
      resolveAssetEventTarget({ assetId: "8f2a-um-id", typedName: "Fogão" }),
    ).toEqual({ ok: true, assetId: "8f2a-um-id", assetName: null });
  });

  it("cadastra o objeto que a IA entendeu quando a casa ainda não o tem", () => {
    expect(
      resolveAssetEventTarget({ assetId: null, extractName: "Geladeira" }),
    ).toEqual({ ok: true, assetId: null, assetName: "Geladeira" });
  });

  it("prefere o nome digitado pela pessoa ao palpite da IA", () => {
    expect(
      resolveAssetEventTarget({ extractName: "Geladeira", typedName: "Geladeira Brastemp" }),
    ).toEqual({ ok: true, assetId: null, assetName: "Geladeira Brastemp" });
  });

  it("pede o objeto quando nada foi informado", () => {
    expect(
      resolveAssetEventTarget({ assetId: null, typedName: "   ", extractName: null }),
    ).toEqual({ ok: false, error: "Diga a qual objeto isso aconteceu." });
  });
});
