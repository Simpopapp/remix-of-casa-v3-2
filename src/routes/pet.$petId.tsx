import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

import { AppNav } from "@/components/app-nav";
import { LayerFicha } from "@/components/layer-ficha";
import { guardSession } from "@/lib/auth-guard";
import { formatDate } from "@/lib/format";
import { getPetDetail } from "@/lib/queries";

const petOptions = (petId: string) =>
  queryOptions({
    queryKey: ["pet", petId],
    queryFn: () => getPetDetail({ data: { petId } }),
  });

export const Route = createFileRoute("/pet/$petId")({
  beforeLoad: () => guardSession(),
  // No servidor não há token: a busca acontece no navegador, após a hidratação.
  loader: ({ params, context }) =>
    typeof window === "undefined"
      ? undefined
      : context.queryClient.ensureQueryData(petOptions(params.petId)),
  component: PetFichaPage,
  head: () => ({
    meta: [
      { title: "Ficha do pet — Casa Viva" },
      {
        name: "description",
        content:
          "A ficha de um pet da casa: o que ele é, o que vence (vacina, vermífugo, consulta) e os papéis que comprovam.",
      },
      { property: "og:title", content: "Ficha do pet — Casa Viva" },
      {
        property: "og:description",
        content:
          "A ficha de um pet da casa: o que ele é, o que vence (vacina, vermífugo, consulta) e os papéis que comprovam.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function PetFichaPage() {
  const { petId } = Route.useParams();
  return (
    <div className="min-h-screen bg-background">
      <AppNav />
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <p className="text-sm text-muted-foreground">Abrindo a ficha…</p>
          </div>
        }
      >
        <div className="mx-auto max-w-4xl px-4 pb-16 pt-6">
          <PetContent petId={petId} />
        </div>
      </Suspense>
    </div>
  );
}

function PetContent({ petId }: { petId: string }) {
  const { data } = useSuspenseQuery(petOptions(petId));
  const { pet, obligations, documents, members } = data;

  const specs = [
    { label: "Espécie", value: pet.species },
    { label: "Raça", value: pet.breed },
    { label: "Nascimento", value: pet.birthdate ? formatDate(pet.birthdate) : null },
    { label: "Peso", value: pet.weight_kg != null ? `${pet.weight_kg} kg` : null },
  ].filter((s) => s.value);

  return (
    <>
      <Link
        to="/pets"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        Os pets da casa
      </Link>

      <header className="mt-4">
        <p className="text-xs font-medium uppercase tracking-widest text-primary">
          Quem tem quatro patas
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
          {pet.name}
        </h1>
      </header>

      {specs.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {specs.map((spec) => (
            <div key={spec.label} className="rounded-2xl border border-border bg-card/70 px-4 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {spec.label}
              </dt>
              <dd className="mt-1 font-display text-lg font-semibold text-foreground">
                {spec.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-10">
        <LayerFicha
          householdId={pet.household_id}
          link={{ pet_id: pet.id }}
          obligations={obligations}
          documents={documents}
          members={members}
          subject="pet"
        />
      </div>
    </>
  );
}
