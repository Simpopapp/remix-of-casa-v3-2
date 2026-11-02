// Planta isométrica da casa — SVG puro, sem dependência de mapas.
// Cada cômodo é um volume extrudado; a cor do topo respira com o pulso.

import { useRouter } from "@tanstack/react-router";

import { CELL_H, CELL_W, WALL_H, isoProject } from "@/lib/plant";
import { pulseColor, type PulseResult } from "@/lib/pulse";
import type { Room, RoomLayout } from "@/lib/types";

interface PlantaIsometricaProps {
  rooms: Room[];
  pulses: Map<string, PulseResult>;
}

const LEVEL_ANIM: Record<string, string> = {
  tranquilo: "pulso-tranquilo",
  atencao: "pulso-atencao",
  urgente: "pulso-urgente",
};

export function layoutOf(room: Room): { x: number; y: number; w: number; h: number } {
  const l = (room.layout ?? {}) as Partial<RoomLayout> | null;
  return {
    x: typeof l?.x === "number" ? l.x : 0,
    y: typeof l?.y === "number" ? l.y : 0,
    w: typeof l?.w === "number" && l.w > 0 ? l.w : 2,
    h: typeof l?.h === "number" && l.h > 0 ? l.h : 2,
  };
}

export function PlantaIsometrica({ rooms, pulses }: PlantaIsometricaProps) {
  const router = useRouter();
  if (rooms.length === 0) return null;

  // De trás para frente, para os volumes da frente cobrirem os de trás.
  const ordered = [...rooms].sort(
    (a, b) =>
      layoutOf(a).x + layoutOf(a).y - (layoutOf(b).x + layoutOf(b).y),
  );

  const corners = rooms.flatMap((room) => {
    const { x, y, w, h } = layoutOf(room);
    return [
      isoProject(x, y),
      isoProject(x + w, y),
      isoProject(x + w, y + h),
      isoProject(x, y + h),
    ];
  });
  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x));
  const minY = Math.min(...corners.map((c) => c.y));
  const maxY = Math.max(
    ...rooms.map((r) => isoProject(layoutOf(r).x, layoutOf(r).y + layoutOf(r).h).y + WALL_H),
  );
  const pad = 28;

  function open(room: Room) {
    void router.navigate({ to: "/comodo/$roomId", params: { roomId: room.id } });
  }

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      className="mx-auto block h-auto w-full max-w-3xl"
      role="img"
      aria-label="Planta isométrica da casa"
    >
      {ordered.map((room) => {
        const { x, y, w, h } = layoutOf(room);
        const A = isoProject(x, y);
        const B = isoProject(x + w, y);
        const C = isoProject(x + w, y + h);
        const D = isoProject(x, y + h);
        const pulse = pulses.get(room.id);
        const level = pulse?.level ?? "tranquilo";
        const color = pulseColor(level);
        const topCx = (A.x + C.x) / 2;
        const topCy = (A.y + C.y) / 2;
        const levelLabel =
          level === "tranquilo" ? "Tranquilo" : level === "atencao" ? "Atenção" : "Urgente";

        return (
          <g
            key={room.id}
            role="link"
            tabIndex={0}
            aria-label={`Abrir ${room.name} — pulso ${levelLabel}`}
            className="cursor-pointer transition-transform duration-300 hover:-translate-y-1.5 focus-visible:-translate-y-1.5"
            onClick={() => open(room)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                open(room);
              }
            }}
          >
            {/* Parede esquerda */}
            <polygon
              points={`${D.x},${D.y} ${C.x},${C.y} ${C.x},${C.y + WALL_H} ${D.x},${D.y + WALL_H}`}
              fill="var(--secondary)"
              stroke="var(--border)"
              strokeWidth="1"
            />
            {/* Parede direita */}
            <polygon
              points={`${B.x},${B.y} ${C.x},${C.y} ${C.x},${C.y + WALL_H} ${B.x},${B.y + WALL_H}`}
              fill="var(--muted)"
              stroke="var(--border)"
              strokeWidth="1"
            />
            {/* Topo respira com o pulso do cômodo */}
            <polygon
              points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}`}
              fill={color}
              fillOpacity="0.3"
              stroke="var(--tinta)"
              strokeOpacity="0.45"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <circle
              cx={topCx}
              cy={topCy - 4}
              r="3.5"
              fill={color}
              style={{
                animation: `pulso-${level} 2.8s ease-in-out infinite`,
              }}
            />
            <text
              x={topCx}
              y={topCy + 14}
              textAnchor="middle"
              fontSize="12.5"
              fontWeight="600"
              fill="var(--tinta)"
              style={{ pointerEvents: "none" }}
            >
              {room.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
