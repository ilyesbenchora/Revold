export const dynamic = "force-dynamic";

import Link from "next/link";
import { getOrgId } from "@/lib/supabase/cached";
import { OrphanContactsConsole } from "@/components/orphan-contacts-console";

/**
 * Hiérarchie comptes → Contacts sans entreprise : l'association EN MASSE de
 * contacts orphelins à une entreprise — la manœuvre que HubSpot ne propose
 * qu'en fiche par fiche. Suggestions automatiques par domaine email +
 * sélection manuelle, écriture HubSpot uniquement à la validation.
 */
export default async function ContactsSansEntreprisePage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  return (
    <section className="space-y-6">
      <header>
        <Link
          href="/dashboard/hierarchie"
          className="text-xs font-medium text-slate-400 transition hover:text-indigo-600"
        >
          ← Hiérarchie comptes
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Contacts sans entreprise</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tous les contacts de ta base sans aucune association d&apos;entreprise, associables{" "}
          <span className="font-medium text-slate-700">en masse</span> — ce que HubSpot ne permet qu&apos;en fiche
          par fiche. Revold pré-suggère l&apos;entreprise par <span className="font-medium text-slate-700">domaine
          email</span> (jean@acme.fr → ACME) ; pour le reste, sélectionne les contacts et choisis l&apos;entreprise
          cible. Chaque validation écrit l&apos;association (entreprise principale) directement dans HubSpot —{" "}
          <span className="font-medium text-slate-700">rien ne part sans ton clic</span>.
        </p>
      </header>

      <OrphanContactsConsole />
    </section>
  );
}
