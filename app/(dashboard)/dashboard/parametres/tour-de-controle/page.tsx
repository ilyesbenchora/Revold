import { ParametresTabs } from "@/components/parametres-tabs";
import { TowerSettingsForm } from "@/components/voice/tower-settings-form";

export default function ParametresTourDeControlePage() {
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mode d&apos;emploi et personnalisation de la tour de contrôle vocale de la page d&apos;accueil.
        </p>
      </header>

      <ParametresTabs />

      <TowerSettingsForm />
    </section>
  );
}
