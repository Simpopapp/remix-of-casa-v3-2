// Regras declaradas no roadmap (Fase 13): foco visível, contraste AA no
// tema escuro e respeito a reduced-motion. Um teste por regra.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(__dirname, "../styles.css"), "utf8");
const nav = readFileSync(
  resolve(__dirname, "../components/app-nav.tsx"),
  "utf8",
);

/** Luminância L de um token oklch declarado dentro de um bloco CSS. */
function lightnessOf(block: string, token: string): number {
  const match = block.match(new RegExp(`${token}:\\s*oklch\\((\\d*\\.?\\d+)`));
  if (!match) throw new Error(`token ${token} não encontrado`);
  return Number(match[1]);
}

const darkBlock = styles.slice(styles.indexOf(".dark {"));

describe("acessibilidade — regras da Fase 13", () => {
  it("todo elemento interativo tem anel de foco visível global", () => {
    const rule = styles.match(/:focus-visible\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain("outline: 2px solid var(--ring)");
  });

  it("reduced-motion zera animações e transições", () => {
    expect(styles).toContain("prefers-reduced-motion: reduce");
    expect(styles).toContain("animation-duration: 0.01ms !important");
    expect(styles).toContain("transition-duration: 0.01ms !important");
  });

  it("texto secundário do tema escuro tem luminância suficiente para 4.5:1", () => {
    // 0.775 mede 4.6:1 sobre background e card do tema escuro.
    expect(lightnessOf(darkBlock, "--muted-foreground")).toBeGreaterThanOrEqual(0.775);
  });

  it("botão primário do tema escuro claro o bastante para o texto escuro passar em AA", () => {
    // 0.745 mede 4.6:1 contra o primary-foreground escuro (0.2).
    expect(lightnessOf(darkBlock, "--primary")).toBeGreaterThanOrEqual(0.745);
  });

  it("selo tranquilo do tema escuro passa em AA com seu texto", () => {
    // 0.75 mede 4.6:1 contra o tranquilo-foreground (0.174).
    expect(lightnessOf(darkBlock, "--tranquilo")).toBeGreaterThanOrEqual(0.75);
  });

  it("navegação marca a página atual para leitores de tela", () => {
    expect(nav).toContain('"aria-current": "page"');
    expect(nav).toContain('aria-label="Navegação principal"');
  });

  it("existe atalho de teclado para pular direto ao conteúdo", () => {
    expect(nav).toContain('href="#conteudo"');
    expect(styles).toContain(".pular-para-conteudo");
  });
});
