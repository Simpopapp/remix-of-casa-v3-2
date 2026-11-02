import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  Car,
  Lock,
  MessagesSquare,
  Package,
  PawPrint,
  Settings,
  Sparkles,
  Siren,
  Sprout,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";

import { CommandPalette } from "@/components/command-palette";
import { activeLayerKeys } from "@/lib/layers";
import { getLayerNav } from "@/lib/queries";

const LINKS = [
  { to: "/", label: "A casa", icon: Warehouse },
  { to: "/obrigacoes", label: "Radar", icon: CalendarClock },
  { to: "/documentos", label: "Cofre", icon: Lock },
  { to: "/prestadores", label: "Prestadores", icon: Users },
  { to: "/dinheiro", label: "Dinheiro", icon: Wallet },
  { to: "/captura", label: "Captura", icon: Sparkles },
  { to: "/zelador", label: "Zelador", icon: MessagesSquare },
  { to: "/momentos", label: "Momentos", icon: Package },
] as const;

const PILL =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

/** Navegação entre os territórios da casa: a planta, o cofre, a agenda e as camadas. */
export function AppNav() {
  // As camadas ligadas mandam no que aparece aqui. Desligar uma tira o atalho,
  // nunca os dados — por isso a consulta é só do interruptor.
  const { data: layers } = useQuery({
    queryKey: ["layer-nav"],
    queryFn: () => getLayerNav(),
    staleTime: 60_000,
  });
  const active = activeLayerKeys(layers ?? []);

  return (
    <nav
      aria-label="Navegação principal"
      className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur"
    >
      <a href="#conteudo" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <Link
          to="/"
          className="shrink-0 font-display text-lg font-semibold tracking-tight text-foreground"
        >
          Casa Viva
        </Link>

        {/* Só o meio rola: a marca e a emergência ficam sempre ao alcance. */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={PILL}
              activeProps={{
                "aria-current": "page",
                className: `${PILL} bg-secondary text-foreground`,
              }}
              activeOptions={{ exact: to === "/" }}
            >
              <Icon size={15} aria-hidden />
              {label}
            </Link>
          ))}

          {active.includes("veiculos") && (
            <Link
              to="/veiculos"
              className={PILL}
              activeProps={{
                "aria-current": "page",
                className: `${PILL} bg-secondary text-foreground`,
              }}
            >
              <Car size={15} aria-hidden />
              Veículos
            </Link>
          )}
          {active.includes("pets") && (
            <Link
              to="/pets"
              className={PILL}
              activeProps={{
                "aria-current": "page",
                className: `${PILL} bg-secondary text-foreground`,
              }}
            >
              <PawPrint size={15} aria-hidden />
              Pets
            </Link>
          )}
          {active.includes("jardim") && (
            <Link
              to="/jardim"
              className={PILL}
              activeProps={{
                "aria-current": "page",
                className: `${PILL} bg-secondary text-foreground`,
              }}
            >
              <Sprout size={15} aria-hidden />
              Jardim
            </Link>
          )}

          <Link
            to="/config"
            className={PILL}
            activeProps={{
              "aria-current": "page",
              className: `${PILL} bg-secondary text-foreground`,
            }}
          >
            <Settings size={15} aria-hidden />
            Ajustes
          </Link>

          <CommandPalette />
        </div>

        <Link
          to="/emergencia"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground"
        >
          <Siren size={15} />
          Emergência
        </Link>
      </div>
    </nav>
  );
}

