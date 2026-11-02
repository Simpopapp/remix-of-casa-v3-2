import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";

import { AppNav } from "@/components/app-nav";
import { LayerFicha } from "@/components/layer-ficha";
import { guardSession } from "@/lib/auth-guard";
import { formatDate } from "@/lib/format";
import { getVehicleDetail } from "@/lib/queries";

const vehicleOptions = (vehicleId: string) =>
  queryOptions({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => getVehicleDetail({ data: { vehicleId } }),
  });

export const Route = createFileRoute("/veiculo/$vehicleId")({
  beforeLoad: () => guardSession(),
  // No servidor não há token: a busca acontece no navegador, após a hidratação.
  loader: ({ params, context }) =>
    typeof window === "undefined"
      ? undefined
      : context.queryClient.ensureQueryData(vehicleOptions(params.vehicleId)),
  component: VehicleFichaPage,
  head: () => ({
    meta: [
      { title: "Ficha do veículo — Casa Viva" },
      {
        name: "description",
        content:
          "A ficha de um veículo da casa: o que ele é, o que vence (revisão, IPVA, seguro) e os papéis que comprovam.",
      },
      { property: "og:title", content: "Ficha do veículo — Casa Viva" },
      {
        property: "og:description",
        content:
          "A ficha de um veículo da casa: o que ele é, o que vence (revisão, IPVA, seguro) e os papéis que comprovam.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function VehicleFichaPage() {
  const { vehicleId } = Route.useParams();
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
          <VehicleContent vehicleId={vehicleId} />
        </div>
      </Suspense>
    </div>
  );
}

function VehicleContent({ vehicleId }: { vehicleId: string }) {
  const { data } = useSuspenseQuery(vehicleOptions(vehicleId));
  const { vehicle, obligations, documents, members } = data;

  const specs = [
    { label: "Placa", value: vehicle.plate },
    { label: "Marca", value: vehicle.brand },
    { label: "Modelo", value: vehicle.model },
    { label: "Ano", value: vehicle.year != null ? String(vehicle.year) : null },
    { label: "Compra", value: vehicle.purchase_date ? formatDate(vehicle.purchase_date) : null },
    {
      label: "Quilometragem",
      value: vehicle.odometer != null ? vehicle.odometer.toLocaleString("pt-BR") : null,
    },
  ].filter((s) => s.value);

  return (
    <>
      <Link
        to="/veiculos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} />
        A garagem
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary">
            O que vive na garagem
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
            {vehicle.name}
          </h1>
        </div>
        {vehicle.plate ? (
          <span className="rounded-lg border border-border bg-secondary px-3 py-1.5 font-mono text-sm font-semibold tracking-wide text-secondary-foreground">
            {vehicle.plate}
          </span>
        ) : null}
      </header>

      {specs.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
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
          householdId={vehicle.household_id}
          link={{ vehicle_id: vehicle.id }}
          obligations={obligations}
          documents={documents}
          members={members}
          subject="veículo"
        />
      </div>
    </>
  );
}
