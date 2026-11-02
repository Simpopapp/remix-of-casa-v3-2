import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUp, MessagesSquare, Quote } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { guardSession } from "@/lib/auth-guard";
import { getZeladorHistory } from "@/lib/queries";
import type { ChatCitation, ChatEntry } from "@/lib/types";
import { askZelador } from "@/lib/writes";

export const Route = createFileRoute("/zelador")({
  beforeLoad: () => guardSession(),
  component: ZeladorPage,
  head: () => ({
    meta: [
      { title: "Zelador da casa — Casa Viva" },
      {
        name: "description",
        content:
          "Pergunte em voz alta o que você já saberia de cabeça: quanto saiu, o que vence, o que ainda está na garantia. O zelador responde com os registros reais da sua casa.",
      },
      { property: "og:title", content: "Zelador da casa — Casa Viva" },
      {
        property: "og:description",
        content:
          "Pergunte em voz alta o que você já saberia de cabeça. O zelador responde com os registros reais da sua casa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SUGGESTIONS = [
  "Quanto gastei com a cozinha nos últimos dois anos?",
  "O que vence nos próximos três meses?",
  "Quais garantias estão perto de acabar?",
];

type CitationLink =
  | { kind: "plain"; to: "/obrigacoes" | "/documentos" }
  | { kind: "room"; to: "/comodo/$roomId"; params: { roomId: string } }
  | { kind: "asset"; to: "/ativo/$assetId"; params: { assetId: string } };

/** Só citamos fichas que as ferramentas realmente consultaram. */
function citationLink(to: string): CitationLink | null {
  if (to === "/obrigacoes" || to === "/documentos") return { kind: "plain", to };
  const room = /^\/comodo\/([^/]+)$/.exec(to);
  if (room?.[1]) return { kind: "room", to: "/comodo/$roomId", params: { roomId: room[1] } };
  const asset = /^\/ativo\/([^/]+)$/.exec(to);
  if (asset?.[1]) return { kind: "asset", to: "/ativo/$assetId", params: { assetId: asset[1] } };
  return null;
}

function CitationRow({ citations }: { citations: ChatCitation[] }) {
  const usable = citations
    .map((c) => ({ c, link: citationLink(c.to) }))
    .filter((x): x is { c: ChatCitation; link: CitationLink } => x.link !== null);
  if (usable.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
      <Quote size={12} className="text-muted-foreground" aria-hidden />
      {usable.map(({ c, link }) => (
        <Link
          key={c.to}
          {...link}
          className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-primary/15 hover:text-primary"
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}

/** O modelo responde com marcação leve; mostramos o destaque, não os asteriscos. */
function richText(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const bold = /^\*\*(.+)\*\*$/.exec(part)?.[1];
    return bold === undefined ? (
      <span key={i}>{part}</span>
    ) : (
      <strong key={i} className="font-semibold">
        {bold}
      </strong>
    );
  });
}

function Bubble({ entry }: { entry: ChatEntry }) {
  const mine = entry.role === "user";
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-3xl px-4 py-3 sm:max-w-[70%] ${
          mine
            ? "rounded-br-lg bg-primary text-primary-foreground"
            : "rounded-bl-lg border border-border bg-card"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{richText(entry.content)}</p>
        {!mine && <CitationRow citations={entry.citations} />}
      </div>
    </li>
  );
}

function ZeladorPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["zelador"],
    queryFn: () => getZeladorHistory(),
    staleTime: 10_000,
  });
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [extra, setExtra] = useState<ChatEntry[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const messages: ChatEntry[] = [...(data?.messages ?? []), ...extra];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setDraft("");
    setPending(true);
    setExtra((prev) => [
      ...prev,
      {
        id: `local-${prev.length}`,
        role: "user",
        content: q,
        citations: [],
        created_at: new Date().toISOString(),
      },
    ]);
    try {
      const res = await askZelador({ data: { question: q } });
      setExtra((prev) => [
        ...prev,
        {
          id: `local-a-${prev.length}`,
          role: "assistant",
          content: res.answer,
          citations: res.citations,
          created_at: new Date().toISOString(),
        },
      ]);
      // Espera a casa reler a conversa antes de soltar as cópias locais.
      await queryClient.refetchQueries({ queryKey: ["zelador"] });
      setExtra([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "O zelador não conseguiu responder.");
      setExtra([]);
    } finally {
      setPending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary/20" />
      </div>
    );
  }

  if (!data?.household) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-3xl font-semibold text-foreground">
            O zelador ainda não tem casa
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Monte a planta primeiro — aí ele passa a conhecer os cômodos, os gastos e o que vence.
          </p>
          <Link to="/onboarding" className="mt-6 inline-block">
            <Button size="lg">Montar minha casa</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-6">
      <AppNav />
      <header className="mx-auto w-full max-w-3xl px-4 pt-8">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          Quem cuida da {data.household.name}
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
          Fale com o zelador
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pergunte como se fala em casa. Ele só responde com o que está nos registros — e mostra de
          onde tirou.
        </p>
      </header>

      <main id="conteudo" className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        {messages.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 p-6 text-center">
            <MessagesSquare className="mx-auto text-muted-foreground" size={26} aria-hidden />
            <h2 className="mt-3 font-display text-xl font-semibold text-foreground">
              Comece por uma dessas
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  className="w-full justify-start text-left"
                  onClick={() => void send(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) => (
              <Bubble key={m.id} entry={m} />
            ))}
            {pending && (
              <li className="flex justify-start">
                <div className="rounded-3xl rounded-bl-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  Procurando nos registros…
                </div>
              </li>
            )}
            <div ref={endRef} />
          </ul>
        )}

        <form
          className="sticky bottom-4 mt-6 flex items-end gap-2 rounded-3xl border border-border bg-card p-2 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <label className="sr-only" htmlFor="zelador-pergunta">
            Sua pergunta
          </label>
          <Textarea
            id="zelador-pergunta"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ex.: quanto gastei com a cozinha nos últimos dois anos?"
            className="max-h-40 min-h-11 flex-1 resize-none border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={pending || !draft.trim()} aria-label="Perguntar">
            <ArrowUp size={18} />
          </Button>
        </form>
      </main>
    </div>
  );
}
