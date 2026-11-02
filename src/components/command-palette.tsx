import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getSearchIndex } from "@/lib/queries";

/**
 * Busca universal (Ctrl/⌘+K): qualquer coisa da casa em instantes.
 * O índice vem do servidor uma vez e a filtragem acontece no cliente.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["search-index"],
    queryFn: () => getSearchIndex(),
    staleTime: 60_000,
    enabled: open,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const groups = new Map<string, typeof data>();
  for (const entry of data ?? []) {
    const list = groups.get(entry.group) ?? [];
    list.push(entry);
    groups.set(entry.group, list);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar na casa"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Search size={15} />
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden rounded-md border border-border px-1 text-[10px] text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar cômodo, objeto, documento, conta…" />
        <CommandList>
          <CommandEmpty>Nada na casa com esse nome ainda.</CommandEmpty>
          {[...groups.entries()].map(([group, entries]) => (
            <CommandGroup key={group} heading={group}>
              {(entries ?? []).map((entry) => (
                <CommandItem
                  key={`${entry.group}-${entry.id}`}
                  value={`${entry.label} ${entry.hint ?? ""}`}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: entry.to });
                  }}
                >
                  <span className="flex-1 truncate">{entry.label}</span>
                  {entry.hint && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {entry.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
