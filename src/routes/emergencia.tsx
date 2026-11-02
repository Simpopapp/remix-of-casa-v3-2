import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  FileText,
  Home,
  Phone,
  Shield,
  Share2,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { guardSession } from "@/lib/auth-guard";
import {
  HOUSEHOLD_KIND_LABEL,
  MEMBER_ROLE_LABEL,
  formatDate,
} from "@/lib/format";
import { getDocumentFileUrl, getEmergencyKit } from "@/lib/queries";

export const Route = createFileRoute("/emergencia")({
  beforeLoad: () => guardSession(),
  component: EmergencyPage,
  head: () => ({
    meta: [
      { title: "Modo emergência — Casa Viva" },
      {
        name: "description",
        content:
          "Onde a casa está, quem vive nela, o prestador de confiança e as apólices — tudo em uma tela, sem depender de rede boa.",
      },
      { property: "og:title", content: "Modo emergência — Casa Viva" },
      {
        property: "og:description",
        content:
          "Onde a casa está, quem vive nela, o prestador de confiança e as apólices — tudo em uma tela, sem depender de rede boa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const SECTION =
  "rounded-3xl border-2 border-foreground/20 bg-card p-6 sm:p-8";
const SECTION_TITLE =
  "flex items-center gap-3 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl";
const BODY = "text-base leading-relaxed text-foreground sm:text-lg";
const MUTED = "text-sm text-muted-foreground sm:text-base";

// Dados do pacote de emergência: buscados no cliente, como nas demais rotas —
// o SSR não tem token de sessão, então o fetch acontece depois de hidratar.
function EmergencyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["emergency-kit"],
    queryFn: () => getEmergencyKit(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-base text-muted-foreground sm:text-lg">Abrindo o registro de emergência…</p>
      </main>
    );
  }

  const household = data?.household ?? null;
  const kit = data ?? { household: null, members: [], providers: [], documents: [], breakerAssets: [] };
  const apolices = (data?.documents ?? []).filter(
    (d) => d.category === "apolice" || d.category === "seguro",
  );
  const outrosPapeis = (data?.documents ?? []).filter(
    (d) => !apolices.some((a) => a.id === d.id) && (d.category === "escritura" || d.category === "laudo"),
  );
  const confianca = (data?.providers ?? []).filter((p) => p.trusted);
  const outros = (data?.providers ?? []).filter((p) => !p.trusted);

  async function openFile(documentId: string) {
    try {
      const { url } = await getDocumentFileUrl({ data: { documentId } });
      if (!url) {
        toast.error("Esse documento não tem arquivo guardado.");
        return;
      }
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error("Não deu para abrir", {
        description: error instanceof Error ? error.message : "Tente de novo.",
      });
    }
  }

  async function share() {
    const lines = ["Registro de emergência"];
    if (household) {
      lines.push(`Casa: ${household.name}`);
      if (household.address) lines.push(`Endereço: ${household.address}`);
      if (kit.members.length > 0) {
        lines.push(`Quem vive aqui: ${kit.members.map((m) => m.name).join(", ")}`);
      }
    }
    if (confianca.length > 0) {
      lines.push(
        `Prestador de confiança: ${confianca
          .map((p) => `${p.name}${p.phone ? ` (${p.phone})` : ""}`)
          .join("; ")}`,
      );
    }
    if (apolices.length > 0) {
      lines.push(`Apólices: ${apolices.map((d) => d.title).join("; ")}`);
    }
    const text = lines.join("\n");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Registro de emergência", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Registro copiado para a área de transferência");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Não deu para compartilhar", {
        description: error instanceof Error ? error.message : "Tente copiar à mão.",
      });
    }
  }

  if (!household) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        <p className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Modo emergência
        </p>
        <p className="max-w-md text-base text-muted-foreground sm:text-lg">
          Nenhuma casa por aqui ainda. Monte a planta para o registro de emergência
          ter o que mostrar.
        </p>
        <Button asChild size="lg" className="min-h-14 px-6 text-lg">
          <Link to="/">
            <ArrowLeft size={20} />
            Voltar para a casa
          </Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="border-b-2 border-foreground/15 px-4 py-6 sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-destructive">
              Modo emergência
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {household.name}
            </h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="lg" className="min-h-12">
              <Link to="/">
                <ArrowLeft size={18} />
                Sair
              </Link>
            </Button>
            <Button size="lg" className="min-h-12" onClick={() => void share()}>
              <Share2 size={18} />
              Compartilhar
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-8">
        {/* Registro geral */}
        <section className={SECTION}>
          <h2 className={SECTION_TITLE}>
            <Home aria-hidden size={24} />
            Onde a casa está
          </h2>
          <div className="mt-4 space-y-2">
            <p className={BODY}>
              <strong>{HOUSEHOLD_KIND_LABEL[household.kind] ?? household.kind}</strong>
              {household.address ? ` — ${household.address}` : " — endereço ainda não registrado"}
            </p>
            {kit.members.length > 0 && (
              <p className={BODY}>
                <strong>Quem vive aqui:</strong>{" "}
                {kit.members
                  .map((m) => `${m.name} (${MEMBER_ROLE_LABEL[m.role] ?? m.role})`)
                  .join(", ")}
              </p>
            )}
            {household.address ? null : (
              <p className={MUTED}>
                Coloque o endereço no lar, na configuração — em uma emergência ele é o
                que você vai precisar dizer primeiro.
              </p>
            )}
          </div>
        </section>

        {/* Disjuntor e registros */}
        <section className={SECTION}>
          <h2 className={SECTION_TITLE}>
            <Zap aria-hidden size={24} />
            Disjuntor, registro e gás
          </h2>
          {kit.breakerAssets.length === 0 ? (
            <p className={`mt-4 ${MUTED}`}>
              Nenhum objeto da casa guarda essa informação ainda. Vale cadastrar o
              disjuntor ou o registro de gás como objeto — o modo emergência o mostra
              aqui na hora em que fizer falta.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {kit.breakerAssets.map(({ asset, room_name }) => (
                <li key={asset.id} className={BODY}>
                  <strong>{asset.name}</strong>
                  {room_name ? ` — ${room_name}` : ""}
                  {asset.notes ? (
                    <span className="block text-sm text-muted-foreground sm:text-base">
                      {asset.notes}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Prestador de confiança */}
        <section className={SECTION}>
          <h2 className={SECTION_TITLE}>
            <Users aria-hidden size={24} />
            Prestador de confiança
          </h2>
          {confianca.length === 0 && outros.length === 0 ? (
            <p className={`mt-4 ${MUTED}`}>
              Nenhum prestador na agenda ainda. Salve o eletricista e o encanador de
              confiança com telefone — é a informação que falta em toda emergência.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {[...confianca, ...outros].map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className={BODY}>
                      <strong>{p.name}</strong>
                      {p.specialty ? ` — ${p.specialty}` : ""}
                      {p.trusted ? (
                        <span className="ml-2 rounded-full border-2 border-foreground/25 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-foreground">
                          Confiança
                        </span>
                      ) : null}
                    </p>
                    {p.notes ? (
                      <p className="text-sm text-muted-foreground sm:text-base">{p.notes}</p>
                    ) : null}
                  </div>
                  {p.phone ? (
                    <Button asChild size="lg" className="min-h-12 px-5 text-base">
                      <a href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>
                        <Phone size={18} />
                        {p.phone}
                      </a>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Apólices e papéis que provam a casa */}
        <section className={SECTION}>
          <h2 className={SECTION_TITLE}>
            <Shield aria-hidden size={24} />
            Apólices e papéis
          </h2>
          {apolices.length === 0 && outrosPapeis.length === 0 ? (
            <p className={`mt-4 ${MUTED}`}>
              Nenhuma apólice no cofre ainda. Guarde a apólice do seguro e a escritura
              lá — o modo emergência abre o arquivo em um toque.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {[...apolices, ...outrosPapeis].map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={BODY}>
                      <strong>{d.title}</strong>
                    </p>
                    {d.expires_at ? (
                      <p className="text-sm text-muted-foreground sm:text-base">
                        Vence em {formatDate(d.expires_at)}
                      </p>
                    ) : null}
                  </div>
                  {d.file_url ? (
                    <Button
                      variant="outline"
                      size="lg"
                      className="min-h-12 px-5 text-base"
                      onClick={() => void openFile(d.id)}
                    >
                      <FileText size={18} />
                      Abrir
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground sm:text-base">
          <Building2 aria-hidden size={16} />
          Tudo aqui vem dos registros reais da casa — nada é decorado.
        </p>
      </div>
    </main>
  );
}
