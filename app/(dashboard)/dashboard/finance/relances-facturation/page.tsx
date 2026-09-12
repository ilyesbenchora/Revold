export const dynamic = "force-dynamic";

import { CashRecoveryBlock } from "@/components/roi/cash-recovery-block";

/**
 * Finance → Relances facturation : les impayés à relancer (mail pré-rédigé +
 * relances automatiques). Le RÉSULTAT (cash encaissé après relance) vit sur la
 * page « Récupération de cash » — ici on est côté ACTION.
 */
export default function RelancesFacturationPage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Relances facturation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tes factures en retard, à relancer depuis Revold : mail pré-rédigé avec le lien de la facture, renvois
          automatiques jusqu&apos;au paiement (cadence et plafond réglables), arrêt dès l&apos;encaissement. Chaque relance
          suivie alimente la <span className="font-medium text-slate-600">récupération de cash</span>.
        </p>
      </header>

      <CashRecoveryBlock view="relances" />
    </section>
  );
}
