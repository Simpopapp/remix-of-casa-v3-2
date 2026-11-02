// Grade e geometria da planta da casa — pure functions, testáveis.
// A planta isométrica (SVG) e o construtor do onboarding usam este módulo.

import type { RoomArea } from "@/lib/types";

/** Grade do construtor, em células. */
export const GRID_W = 12;
export const GRID_H = 8;

export interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomPlacement extends Placement {
  name: string;
  kind: string;
  kind_area: RoomArea;
}

export interface RoomTemplate {
  kind: string;
  label: string;
  area: RoomArea;
  w: number;
  h: number;
}

/** Modelos de cômodo — o construtor parte daqui, o nome o usuário troca. */
export const ROOM_TEMPLATES: RoomTemplate[] = [
  { kind: "sala", label: "Sala", area: "interna", w: 3, h: 3 },
  { kind: "cozinha", label: "Cozinha", area: "interna", w: 2, h: 2 },
  { kind: "quarto", label: "Quarto", area: "interna", w: 3, h: 2 },
  { kind: "banheiro", label: "Banheiro", area: "interna", w: 1, h: 1 },
  { kind: "lavanderia", label: "Lavanderia", area: "interna", w: 2, h: 1 },
  { kind: "escritorio", label: "Escritório", area: "interna", w: 2, h: 2 },
  { kind: "closet", label: "Closet", area: "interna", w: 1, h: 2 },
  { kind: "despensa", label: "Despensa", area: "interna", w: 1, h: 1 },
  { kind: "garagem", label: "Garagem", area: "garagem", w: 3, h: 2 },
  { kind: "varanda", label: "Varanda", area: "externa", w: 3, h: 1 },
  { kind: "quintal", label: "Quintal", area: "externa", w: 4, h: 3 },
];

/** O cômodo cabe dentro da grade? */
export function fitsInGrid(p: Placement): boolean {
  return (
    p.x >= 0 &&
    p.y >= 0 &&
    p.w > 0 &&
    p.h > 0 &&
    p.x + p.w <= GRID_W &&
    p.y + p.h <= GRID_H
  );
}

/** Dois retângulos se sobrepõem (bordas encostadas não contam). */
export function overlaps(a: Placement, b: Placement): boolean {
  return (
    a.x < b.x + b.w &&
    b.x < a.x + a.w &&
    a.y < b.y + b.h &&
    b.y < a.y + a.h
  );
}

/** Pode posicionar `candidate` sem sair da grade nem invadir outro cômodo? */
export function canPlace(
  candidate: Placement,
  placed: Placement[],
  ignoreIndex?: number,
): boolean {
  if (!fitsInGrid(candidate)) return false;
  return placed.every(
    (p, i) => i === ignoreIndex || !overlaps(candidate, p),
  );
}

/**
 * Projeção isométrica 2:1 (dimétrica). Coordenadas de célula → tela.
 * +x anda para a direita-baixo, +y para a esquerda-baixo.
 */
export function isoProject(cx: number, cy: number): { x: number; y: number } {
  return { x: (cx - cy) * (CELL_W / 2), y: (cx + cy) * (CELL_H / 2) };
}

/** Tamanho da célula na planta isométrica, em px de SVG. */
export const CELL_W = 64;
export const CELL_H = 32;
/** Altura das paredes extrudadas. */
export const WALL_H = 34;
