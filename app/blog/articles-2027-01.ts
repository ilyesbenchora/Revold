import type { BlogArticle } from "./data";

/** Calendrier éditorial — janvier 2027 (mardi et jeudi). Publication automatique à la date (published.ts). */

const AUTHOR = "Ilyes Benchora";
const ROLE = "Expert RevOps";

export const articlesJanuary2027: BlogArticle[] = [
  {
    slug: "sales-ops-ou-revops-quel-poste-ouvrir-en-premier",
    title: "Sales Ops ou RevOps : quel poste ouvrir en premier, et à quel moment",
    description:
      "Quand une entreprise structure ses opérations revenue, faut-il recruter un Sales Ops ou un RevOps ? Critères (taille de l'équipe commerciale, nombre d'outils, symptômes), fiche de poste type de chacun, et ce qu'un outil couvre avant le recrutement.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2027-01-05",
    readTime: "6 min",
    keywords: ["recruter un RevOps", "recruter un Sales Ops", "fiche de poste RevOps", "Sales Ops ou RevOps", "revenue operations manager"],
    related: [
      { href: "/revops-vs-sales-ops", label: "RevOps vs Sales Ops : quelle différence" },
      { href: "/blog/revops-en-pme-par-ou-commencer-sans-recruter", label: "RevOps en PME sans recruter" },
      { href: "/logiciel-revops", label: "Logiciel RevOps : 7 critères" },
      { href: "/equipes/revops", label: "Revold pour le RevOps" },
    ],
    faq: [
      { q: "À partir de quelle taille recruter un Sales Ops ?", a: "Les repères courants situent le premier Sales Ops autour de 8 à 12 commerciaux, quand le manager passe plus d'un jour par semaine sur le CRM, les rapports et les territoires." },
      { q: "À partir de quand recruter un RevOps ?", a: "Quand le problème dépasse les ventes : chiffres marketing, ventes et finance qui ne se réconcilient plus, churn découvert en comptabilité, plusieurs pipelines ou pays. Souvent au-delà de 100 à 200 salariés." },
    ],
    content: `
<p><strong>En bref :</strong> le Sales Ops rend l'équipe commerciale efficace ; le RevOps aligne marketing, ventes, service client et finance sur un revenu commun. Le premier poste dépend du symptôme : un CRM mal tenu et un manager débordé appellent un Sales Ops ; des chiffres qui ne se réconcilient plus entre équipes appellent un RevOps. Dans les deux cas, un outil de réconciliation et de pilotage couvre une bonne part du travail avant le recrutement.</p>

<h2>Les symptômes qui désignent le poste</h2>
<ul>
<li><strong>Sales Ops</strong> : pipeline mal tenu, étapes sautées, rapports refaits à la main, territoires et commissions contestés, onboarding des commerciaux artisanal.</li>
<li><strong>RevOps</strong> : forecast et facturé qui divergent, churn appris par la comptabilité, marketing et ventes qui se renvoient les leads, trois outils sans identifiant commun, plusieurs pipelines ou pays.</li>
</ul>
<p>La différence de périmètre est détaillée dans <a href="/revops-vs-sales-ops">RevOps vs Sales Ops</a>.</p>

<h2>Fiche de poste type : Sales Ops</h2>
<ul>
<li>Administrer le CRM : pipelines, propriétés, workflows, qualité des données.</li>
<li>Produire le reporting commercial et le forecast.</li>
<li>Gérer territoires, quotas et commissions.</li>
<li>Outiller et former les commerciaux.</li>
</ul>
<p>Rattachement : direction commerciale. Mesure : précision du forecast, atteinte des quotas, qualité du CRM.</p>

<h2>Fiche de poste type : RevOps</h2>
<ul>
<li>Définir la source de vérité du revenu : rapprochement CRM × facturation × support.</li>
<li>Porter les indicateurs partagés (ARR, rétention nette, écart signé / facturé, précision du forecast) et les rituels.</li>
<li>Arbitrer les processus entre équipes : passage de lead, facturation à la signature, gestion des renouvellements.</li>
<li>Choisir et administrer la stack revenue.</li>
</ul>
<p>Rattachement : direction générale ou COO. Mesure : revenu prévisible, fuite de revenus, rétention nette.</p>

<h2>Ce qu'un outil couvre avant le poste</h2>
<p>Le rapprochement des données, le calcul des indicateurs, la surveillance des seuils, les briefs et récaps par équipe : tout cela est le travail d'une <a href="/logiciel-revops">plateforme RevOps</a>. Ce qui reste humain : les règles de territoires et de commissions, les arbitrages entre équipes, le choix des priorités. Une PME peut donc tenir longtemps avec un dirigeant outillé (<a href="/blog/revops-en-pme-par-ou-commencer-sans-recruter">RevOps en PME sans recruter</a>) ; le poste vient quand les arbitrages se multiplient.</p>

<h2>L'ordre qui marche</h2>
<ol>
<li>Outiller la réconciliation et le pilotage (semaines).</li>
<li>Recruter un Sales Ops quand l'équipe commerciale dépasse la dizaine.</li>
<li>Recruter un RevOps quand les arbitrages entre équipes deviennent hebdomadaires ; le Sales Ops lui est alors rattaché.</li>
</ol>
<p>La page <a href="/equipes/revops">Revold pour le RevOps</a> décrit ce que la plateforme prend en charge à chaque étape.</p>
`,
  },
  {
    slug: "panier-moyen-calculer-sur-le-facture-pas-le-crm",
    title: "Panier moyen : le calculer sur le facturé, pas sur le montant du CRM",
    description:
      "Le panier moyen calculé sur le montant des deals HubSpot diverge du panier réellement facturé : remises tardives, options, montants annuels vs mensuels. Formule, pièges, lecture par segment et par commercial, et rapprochement avec la facturation.",
    category: "Sales Intelligence",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2027-01-07",
    readTime: "6 min",
    keywords: ["panier moyen", "panier moyen B2B", "calcul panier moyen", "valeur moyenne des deals", "ACV", "montant moyen des contrats"],
    related: [
      { href: "/blog/kpi-commerciaux-2026-formules-benchmarks", label: "Les 12 KPI commerciaux" },
      { href: "/reconciliation-crm-facturation", label: "Réconciliation CRM et facturation" },
      { href: "/blog/fuite-de-revenus-5-cas-concrets-pme", label: "Fuite de revenus : 5 cas concrets" },
      { href: "/glossaire-revops#ecart-signe-facture", label: "Définition : écart signé / facturé" },
    ],
    faq: [
      { q: "Comment calculer le panier moyen en B2B ?", a: "Σ montant des deals gagnés ÷ nombre de deals gagnés sur la période. Pour qu'il soit juste, prenez le montant facturé plutôt que le montant saisi dans le CRM, et séparez nouveaux clients, renouvellements et upsell." },
      { q: "Pourquoi le panier moyen CRM diffère-t-il du facturé ?", a: "Remises accordées après la saisie, options ajoutées ou retirées, montants annuels saisis mensuellement (ou l'inverse), deals gagnés jamais facturés. L'écart est souvent de plusieurs pour cent." },
    ],
    content: `
<p><strong>En bref :</strong> le panier moyen est la valeur moyenne d'un deal gagné. Calculé sur le montant saisi dans le CRM, il est faux dès que les remises, les options ou les conventions de saisie (annuel, mensuel) diffèrent de la facture. Calculé sur le facturé, rapproché deal par deal, il devient un indicateur fiable pour le forecast, les objectifs et le profil de client idéal.</p>

<h2>La formule, et ses trois variantes</h2>
<p><strong>Panier moyen = Σ montant des deals gagnés ÷ nombre de deals gagnés.</strong> Trois variantes à séparer :</p>
<ul>
<li><strong>Nouveaux clients</strong> : la vraie mesure de l'acquisition.</li>
<li><strong>Renouvellements</strong> : souvent plus élevés (indexation) ou plus bas (contraction).</li>
<li><strong>Upsell</strong> : petits montants nombreux, qui écrasent la moyenne s'ils sont mélangés.</li>
</ul>
<p>Un pipeline par type de deal résout le problème à la source.</p>

<h2>CRM ou facturé ?</h2>
<p>Le montant du deal est saisi à la proposition et rarement mis à jour. La facture reflète la négociation finale, les options réellement prises et la convention de facturation. Les cas de l'article sur la <a href="/blog/fuite-de-revenus-5-cas-concrets-pme">fuite de revenus</a> montrent des écarts de 5 à 10 % par deal dans les deux sens. Le panier moyen sur le facturé est le seul qui serve à prévoir la trésorerie et à fixer des objectifs atteignables.</p>

<h2>Lire le panier moyen</h2>
<ul>
<li><strong>Par segment</strong> (taille, secteur) : c'est ce qui définit le profil de client idéal.</li>
<li><strong>Par commercial</strong> : un panier bas et un taux de closing élevé signalent des remises excessives.</li>
<li><strong>Par source de lead</strong> : les canaux ne livrent pas les mêmes paniers.</li>
<li><strong>Dans le temps</strong> : en médiane et en moyenne ; l'écart entre les deux révèle les gros deals.</li>
</ul>

<h2>Le rapprochement qui rend le chiffre juste</h2>
<p>Calculer le panier sur le facturé suppose de savoir quelle facture correspond à quel deal. C'est l'association deal ↔ facture de la <a href="/reconciliation-crm-facturation">réconciliation CRM et facturation</a>, après rapprochement des entreprises par SIREN. Une fois faite, le panier moyen, l'<a href="/glossaire-revops#ecart-signe-facture">écart signé / facturé</a> et la fuite de revenus se lisent sur les mêmes lignes.</p>

<h2>Ce que fait Revold</h2>
<p>Revold rapproche les deals HubSpot des factures Pennylane, Sage, Stripe, Chargebee ou GoCardless, calcule le panier moyen sur le signé et sur le facturé, par pipeline, segment et commercial, et signale les écarts. Les <a href="/blog/kpi-commerciaux-2026-formules-benchmarks">12 KPI commerciaux</a> placent le panier moyen dans l'ensemble du pilotage.</p>
`,
  },
  {
    slug: "rapprochement-bancaire-et-crm-lire-l-encaisse-avec-le-signe",
    title: "Rapprochement bancaire et CRM : lire l'encaissé avec le signé, client par client",
    description:
      "Le rapprochement bancaire vérifie que les paiements correspondent aux factures. Le prolonger jusqu'au CRM permet de lire, pour chaque client, le signé, le facturé et l'encaissé sur une même ligne. Méthode, sources (banque, facturation, CRM), cas d'écart et outil.",
    category: "Intégrations",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2027-01-12",
    readTime: "6 min",
    keywords: ["rapprochement bancaire", "rapprochement bancaire CRM", "encaissements par client", "lettrage factures", "banque et facturation"],
    related: [
      { href: "/plateforme-revenue", label: "Plateforme revenue : du devis à l'encaissement" },
      { href: "/glossaire-revops#signe-facture-encaisse", label: "Définition : signé / facturé / encaissé" },
      { href: "/blog/dso-reduire-delai-de-paiement-depuis-le-crm", label: "DSO : réduire le délai de paiement" },
      { href: "/hubspot-pennylane", label: "HubSpot et Pennylane" },
    ],
    faq: [
      { q: "Qu'est-ce que le rapprochement bancaire ?", a: "L'opération comptable qui associe chaque mouvement bancaire à une facture ou une écriture (le lettrage). Pennylane, Sage ou Stripe le font largement automatiquement ; ce qui manque est le lien avec le CRM." },
      { q: "Pourquoi relier la banque au CRM ?", a: "Pour lire l'encaissement par client et par deal : quel commercial signe des clients qui paient, quel deal signé n'a jamais donné lieu à un paiement, quel client paie toujours en retard. Ces lectures conditionnent le forecast de trésorerie et les commissions." },
    ],
    content: `
<p><strong>En bref :</strong> le rapprochement bancaire (le lettrage) associe les paiements reçus aux factures émises ; les outils de comptabilité le font bien. Ce qui manque presque partout est l'étape suivante : relier la facture payée au deal signé dans le CRM, pour lire par client et par commercial le signé, le facturé et l'encaissé sur une même ligne. C'est la dernière maille de la chaîne du revenu, et la seule qui dise ce qui a réellement été gagné.</p>

<h2>Trois outils, trois vérités</h2>
<ul>
<li><strong>La banque</strong> sait ce qui est entré, quand, de qui (libellé, parfois approximatif).</li>
<li><strong>La facturation</strong> sait ce qui a été facturé, à qui, pour quel montant, et lettre les paiements.</li>
<li><strong>Le CRM</strong> sait ce qui a été signé, par qui, sur quel pipeline.</li>
</ul>
<p>Le lettrage relie les deux premiers. La réconciliation relie le troisième. Sans elle, on ne peut répondre ni à « quels deals signés cette année ont été encaissés ? » ni à « quel commercial signe des clients qui paient ? ».</p>

<h2>La méthode</h2>
<ol>
<li><strong>Rapprocher les clients</strong> par identifiant légal (SIREN, TVA) entre facturation et CRM ; la banque est reliée par le lettrage de la facturation.</li>
<li><strong>Associer factures et deals</strong> par entreprise, montant et période.</li>
<li><strong>Lire par ligne</strong> : deal → facture(s) → paiement(s), avec les dates. Les trous sont les écarts.</li>
</ol>
<p>La définition des trois états est dans le <a href="/glossaire-revops#signe-facture-encaisse">glossaire</a>.</p>

<h2>Les écarts qui apparaissent</h2>
<ul>
<li><strong>Signé, non facturé</strong> : la <a href="/fuite-de-revenus">fuite de revenus</a> classique.</li>
<li><strong>Facturé, non encaissé</strong> : retards et impayés, à relancer par montant (<a href="/blog/dso-reduire-delai-de-paiement-depuis-le-crm">DSO</a>).</li>
<li><strong>Encaissé, sans deal</strong> : revenu non attribué (renouvellements hors CRM), qui fausse les commissions et le forecast.</li>
<li><strong>Encaissé partiellement</strong> : avoirs, remises tardives, litiges.</li>
</ul>

<h2>Ce que cela change</h2>
<p>Les commissions peuvent se calculer sur l'encaissé ; le forecast de trésorerie repose sur les délais de paiement réels par client ; la direction lit un seul tableau au lieu de trois. C'est le périmètre d'une <a href="/plateforme-revenue">plateforme revenue</a>.</p>

<h2>Ce que fait Revold</h2>
<p>Revold lit les factures et leur statut de paiement dans Pennylane, Sage, Stripe, Chargebee ou GoCardless (et les transactions bancaires quand la banque est connectée), rapproche les clients par SIREN avec HubSpot, associe factures et deals, et affiche signé / facturé / encaissé par client avec l'écart. Le score de santé de réconciliation dit quelle part du revenu est suivie de bout en bout. Le guide <a href="/hubspot-pennylane">HubSpot et Pennylane</a> détaille le cas le plus courant.</p>
`,
  },
  {
    slug: "alertes-revops-8-seuils-a-poser",
    title: "Alertes RevOps : les 8 seuils à poser, et ceux qui ne font que du bruit",
    description:
      "Une alerte utile désigne une action, un propriétaire et un montant. Les huit seuils qui changent réellement les comportements (deal stagnant, date dépassée, facture échue, paiement échoué, contraction, objectif en retard, sync en échec, écart signé / facturé) et les alertes à ne pas créer.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2027-01-14",
    readTime: "6 min",
    keywords: ["alertes RevOps", "alertes commerciales", "alertes CRM", "seuils d'alerte KPI", "notifications ventes Slack"],
    related: [
      { href: "/produits/alertes-previsions", label: "Alertes, objectifs et actions" },
      { href: "/glossaire-revops#alerte-de-seuil", label: "Définition : alerte de seuil" },
      { href: "/blog/churn-silencieux-signaux-support-avant-resiliation", label: "Churn silencieux : les signaux" },
      { href: "/kpi-revops", label: "KPI RevOps" },
    ],
    faq: [
      { q: "Quelles alertes mettre en place en RevOps ?", a: "Huit suffisent : deal stagnant au-delà du seuil, date de fermeture dépassée, facture échue au-delà d'un montant, paiement échoué, contraction ou résiliation d'abonnement, objectif en retard à moins de 30 jours, synchronisation en échec, écart signé / facturé au-delà d'un seuil." },
      { q: "Pourquoi les alertes sont-elles ignorées ?", a: "Parce qu'elles sont trop nombreuses, sans destinataire nommé, sans montant, ou déclenchées sur des chiffres que personne ne croit. Une alerte doit désigner une action et une personne." },
    ],
    content: `
<p><strong>En bref :</strong> une alerte n'a de valeur que si elle change un comportement dans la journée. Cela suppose un seuil vérifié sur des données réelles, un destinataire nommé, un montant en jeu et une action évidente. Huit alertes couvrent l'essentiel du pilotage du revenu ; au-delà, chaque alerte supplémentaire réduit l'attention portée aux autres.</p>

<h2>Les huit seuils</h2>
<ol>
<li><strong>Deal stagnant</strong> : ouvert sans changement d'étape depuis plus de N jours (14 à 30). → Propriétaire du deal. Action : prochaine activité ou perdu.</li>
<li><strong>Date de fermeture dépassée</strong> : deal ouvert à date passée. → Propriétaire. Action : nouvelle date justifiée ou perdu.</li>
<li><strong>Facture échue</strong> au-delà d'un montant (par exemple 5 000 €) ou d'une ancienneté (30 jours). → Comptabilité puis commercial selon le palier. Action : relance.</li>
<li><strong>Paiement échoué</strong> sur un abonnement. → Propriétaire du compte, avec le MRR. Action : contact dans les 48 h.</li>
<li><strong>Contraction ou résiliation</strong> d'abonnement. → Propriétaire et responsable service client. Action : appel de rétention.</li>
<li><strong>Objectif en retard</strong> : moins de 60 % de progression à moins de 30 jours de l'échéance. → Propriétaire de l'objectif et manager. Action : plan de rattrapage.</li>
<li><strong>Synchronisation en échec</strong> d'un outil connecté. → Administrateur. Action : reconnecter. Sans cela, toutes les autres alertes reposent sur des données figées.</li>
<li><strong>Écart signé / facturé</strong> au-delà d'un seuil sur la période. → Direction financière. Action : liste des deals sans facture.</li>
</ol>

<h2>Les alertes qui ne font que du bruit</h2>
<ul>
<li><strong>Les alertes de volume</strong> (« 10 nouveaux leads aujourd'hui ») : une information, pas une action.</li>
<li><strong>Les alertes sur un chiffre non vérifié</strong> : si le KPI est calculé sur des données non rapprochées, l'alerte est contestée à la première occurrence puis ignorée.</li>
<li><strong>Les alertes sans propriétaire</strong> : envoyées à un canal d'équipe, elles n'appartiennent à personne.</li>
<li><strong>Les alertes répétées</strong> : une atteinte déjà signalée ne doit pas être relue chaque jour.</li>
</ul>

<h2>Les régler</h2>
<p>Un seuil se fixe à partir de la distribution observée (le seuil de stagnation dépasse le délai médian de l'étape), se vérifie sur les données réelles avant enregistrement (combien de deals déclencheraient l'alerte aujourd'hui ?), et se revoit chaque trimestre. Le canal suit le destinataire : Slack ou Teams pour l'équipe, e-mail pour la finance, SMS pour l'exception critique.</p>

<h2>Ce que fait Revold</h2>
<p>Dans Revold, chaque alerte est câblée sur un KPI réel et testée sur les données avant enregistrement ; le seuil est détecté par le moteur déterministe, la notification est rédigée avec le montant et l'outil source, envoyée sur Slack, Teams, e-mail, SMS ou WhatsApp au destinataire nommé, et jamais répétée pour une même atteinte. Les huit seuils ci-dessus existent dans le catalogue. La page <a href="/produits/alertes-previsions">Alertes, objectifs et actions</a> décrit le mécanisme ; la définition est dans le <a href="/glossaire-revops#alerte-de-seuil">glossaire</a>.</p>
`,
  },
  {
    slug: "velocite-du-pipeline-formule-et-4-leviers",
    title: "Vélocité du pipeline : la formule, et les quatre leviers pour l'augmenter",
    description:
      "La vélocité du pipeline mesure le revenu que le pipeline génère par jour : (deals × panier moyen × taux de closing) ÷ cycle de vente. Comment la calculer sur des données propres, la lire par segment et par commercial, et sur lequel des quatre leviers agir en premier.",
    category: "Sales Intelligence",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2027-01-19",
    readTime: "6 min",
    keywords: ["vélocité du pipeline", "pipeline velocity", "vélocité commerciale", "formule vélocité pipeline", "accélérer le pipeline"],
    related: [
      { href: "/glossaire-revops#velocite-du-pipeline", label: "Définition : vélocité du pipeline" },
      { href: "/blog/cycle-de-vente-b2b-calculer-comparer-raccourcir", label: "Cycle de vente B2B" },
      { href: "/blog/taux-de-conversion-commercial-benchmarks-b2b", label: "Taux de conversion commercial" },
      { href: "/blog/panier-moyen-calculer-sur-le-facture-pas-le-crm", label: "Panier moyen sur le facturé" },
    ],
    faq: [
      { q: "Comment calculer la vélocité du pipeline ?", a: "(Nombre de deals ouverts qualifiés × panier moyen × taux de closing) ÷ cycle de vente en jours. Le résultat est un revenu par jour, comparable d'une période à l'autre et d'un segment à l'autre." },
      { q: "Quel levier de vélocité travailler en premier ?", a: "Celui qui a le plus bougé dans le mauvais sens sur les deux derniers trimestres. À égalité, le cycle de vente : il est souvent le plus compressible à une étape précise, et il agit aussi sur la trésorerie." },
    ],
    content: `
<p><strong>En bref :</strong> la vélocité du pipeline est le revenu qu'un pipeline génère par jour. Formule : (nombre de deals qualifiés × panier moyen × taux de closing) ÷ cycle de vente en jours. Elle réunit les quatre leviers de la vente en un chiffre comparable, et elle dit sur lequel agir : un levier qui s'améliore de 10 % améliore la vélocité de 10 %, quel qu'il soit.</p>

<h2>La formule, avec des données propres</h2>
<ul>
<li><strong>Deals qualifiés</strong> : ouverts, avec montant, date de fermeture et prochaine activité. Les stagnants sont exclus.</li>
<li><strong>Panier moyen</strong> : sur le facturé plutôt que sur le CRM (<a href="/blog/panier-moyen-calculer-sur-le-facture-pas-le-crm">pourquoi</a>).</li>
<li><strong>Taux de closing</strong> : gagnés ÷ (gagnés + perdus) sur les douze derniers mois, par pipeline.</li>
<li><strong>Cycle de vente</strong> : médiane création → signature des gagnés (<a href="/blog/cycle-de-vente-b2b-calculer-comparer-raccourcir">méthode</a>).</li>
</ul>
<p>Exemple : 80 deals × 12 000 € × 25 % ÷ 60 jours = 4 000 € par jour, soit 360 000 € par trimestre. Le chiffre est une vitesse, pas une prévision datée ; le <a href="/forecast-commercial">forecast</a> reste l'outil pour dater.</p>

<h2>Lire la vélocité</h2>
<ul>
<li><strong>Dans le temps</strong> : la tendance sur quatre trimestres dit si la machine accélère.</li>
<li><strong>Par segment</strong> : le segment le plus rapide n'est pas toujours celui qu'on prospecte.</li>
<li><strong>Par commercial</strong> : la même vélocité peut venir de gros paniers lents ou de petits paniers rapides ; les leviers diffèrent.</li>
</ul>

<h2>Les quatre leviers, et leur coût</h2>
<ol>
<li><strong>Plus de deals qualifiés</strong> : le levier marketing, le plus coûteux.</li>
<li><strong>Panier plus élevé</strong> : pricing, options, ciblage de segments ; effet lent mais durable.</li>
<li><strong>Taux de closing</strong> : qualification, proposition, négociation (<a href="/blog/taux-de-conversion-commercial-benchmarks-b2b">conversion par étape</a>).</li>
<li><strong>Cycle plus court</strong> : souvent le plus compressible, à une étape précise, et le seul qui améliore aussi la trésorerie.</li>
</ol>

<h2>Ce que fait Revold</h2>
<p>Revold calcule les quatre composantes sur les données HubSpot rapprochées de la facturation (panier facturé, stagnants exclus, cycle médian par pipeline) et les lit par équipe et par période dans les récaps. La définition est dans le <a href="/glossaire-revops#velocite-du-pipeline">glossaire</a>.</p>
`,
  },
  {
    slug: "gocardless-chargebee-hubspot-abonnements-avec-les-deals",
    title: "GoCardless et Chargebee avec HubSpot : lire les abonnements et les prélèvements avec les deals",
    description:
      "Pour les entreprises à abonnement, le revenu vit dans Chargebee (abonnements) et GoCardless (prélèvements), la relation dans HubSpot. Comment rapprocher les trois par client, lire MRR, churn, prélèvements échoués et deals sans abonnement, sans intégration à construire.",
    category: "Intégrations",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2027-01-21",
    readTime: "6 min",
    keywords: ["Chargebee HubSpot", "GoCardless HubSpot", "intégration Chargebee CRM", "prélèvements GoCardless CRM", "abonnements et CRM"],
    related: [
      { href: "/hubspot-stripe", label: "HubSpot et Stripe" },
      { href: "/blog/mrr-arr-net-new-mrr-guide-pme-saas", label: "MRR, ARR, Net New MRR" },
      { href: "/blog/churn-silencieux-signaux-support-avant-resiliation", label: "Churn silencieux" },
      { href: "/produits/synchronisation", label: "Synchronisation : connecteurs natifs" },
    ],
    faq: [
      { q: "Faut-il intégrer Chargebee ou GoCardless à HubSpot ?", a: "Pas nécessairement. Une intégration copie des objets dans le CRM ; une réconciliation lit les deux outils et rapproche les clients. Pour lire MRR, churn et prélèvements échoués avec les deals, la réconciliation en lecture seule suffit." },
      { q: "Comment rapprocher un client Chargebee et une entreprise HubSpot ?", a: "Par numéro de TVA ou SIREN quand ils sont renseignés, sinon par e-mail de facturation et domaine, avec validation des cas ambigus. Revold enrichit les SIREN manquants via l'API Sirene." },
    ],
    content: `
<p><strong>En bref :</strong> dans une entreprise à abonnement, Chargebee porte les abonnements et leur MRR, GoCardless les prélèvements et leurs échecs, HubSpot les deals et la relation. Tant que les trois ne sont pas rapprochés par client, le churn se découvre en comptabilité, les prélèvements échoués ne remontent pas au commercial, et les deals gagnés sans abonnement actif passent inaperçus. La réconciliation en lecture seule règle les trois sans intégration à construire.</p>

<h2>Ce que chaque outil sait</h2>
<ul>
<li><strong>Chargebee</strong> : abonnements, plans, sièges, MRR, expansion, contraction, résiliations, factures.</li>
<li><strong>GoCardless</strong> : mandats de prélèvement, paiements réussis ou échoués, remboursements.</li>
<li><strong>HubSpot</strong> : entreprises, contacts, deals, propriétaires, pipeline.</li>
</ul>

<h2>Les quatre lectures croisées</h2>
<ol>
<li><strong>MRR par client, rapproché du deal</strong> : le montant vendu correspond-il à l'abonnement actif ? Les écarts sont des remises non tracées ou des options non facturées.</li>
<li><strong>Churn et contraction remontés au CRM</strong> : le propriétaire du compte est prévenu le jour de la résiliation, pas au bilan (<a href="/blog/churn-silencieux-signaux-support-avant-resiliation">signaux</a>).</li>
<li><strong>Prélèvements échoués</strong> : un mandat GoCardless qui échoue est un signal de trésorerie et de churn ; il doit déclencher une alerte avec le MRR du compte.</li>
<li><strong>Deals gagnés sans abonnement</strong> : revenu signé jamais mis en production, la forme la plus silencieuse de la <a href="/fuite-de-revenus">fuite de revenus</a>.</li>
</ol>

<h2>Rapprocher les clients</h2>
<p>Chargebee et GoCardless stockent un client avec un e-mail, parfois un numéro de TVA ; HubSpot une entreprise avec un domaine. La clé la plus fiable est l'identifiant légal (TVA, SIREN), à défaut l'e-mail de facturation et le domaine, avec validation des cas ambigus. La méthode est la même qu'avec <a href="/hubspot-stripe">Stripe</a>.</p>

<h2>Ce que fait Revold</h2>
<p>Revold connecte Chargebee et GoCardless par clé API en lecture seule (comme Stripe, Pennylane et Sage), rapproche les clients avec HubSpot par identifiant légal, e-mail et domaine, calcule MRR, churn et rétention nette par période (<a href="/blog/mrr-arr-net-new-mrr-guide-pme-saas">définitions</a>), déclenche les alertes de prélèvement échoué et de contraction, et liste les deals gagnés sans abonnement actif. La page <a href="/produits/synchronisation">Synchronisation</a> détaille les connecteurs.</p>
`,
  },
  {
    slug: "tableau-de-bord-de-direction-8-chiffres-du-lundi",
    title: "Tableau de bord de direction : les 8 chiffres qu'un dirigeant lit le lundi matin",
    description:
      "Un tableau de bord de direction n'est pas un tableau commercial élargi. Huit chiffres, un par question, lus en trois minutes chaque lundi : signé vs objectif, forecast du trimestre, facturé, encaissé et retards, MRR et churn, pipeline créé, fuite de revenus, santé des données.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2027-01-26",
    readTime: "6 min",
    keywords: ["tableau de bord de direction", "tableau de bord CEO", "KPI dirigeant PME", "reporting direction générale", "pilotage dirigeant"],
    related: [
      { href: "/pilotage-performance-entreprise", label: "Pilotage de la performance d'entreprise" },
      { href: "/tableau-de-bord-revops", label: "Tableau de bord RevOps" },
      { href: "/equipes/direction", label: "Revold pour la direction" },
      { href: "/kpi-revops", label: "KPI RevOps" },
    ],
    faq: [
      { q: "Quels KPI un dirigeant doit-il suivre chaque semaine ?", a: "Signé vs objectif, forecast pondéré du trimestre, facturé et encaissé de la semaine, factures en retard, MRR et churn (si abonnement), pipeline créé, écart signé / facturé, et un indicateur de santé des données. Huit chiffres, pas davantage." },
      { q: "Quelle différence avec le tableau de bord commercial ?", a: "Le tableau commercial suit le pipeline et l'activité ; le tableau de direction suit le revenu de bout en bout, jusqu'à l'encaissement, et les écarts entre équipes. Il est lu, pas travaillé." },
    ],
    content: `
<p><strong>En bref :</strong> un dirigeant ne pilote pas avec vingt graphiques ; il pilote avec huit chiffres lus en trois minutes le lundi, chacun répondant à une question et comparé à la semaine précédente. Le tableau de direction couvre le revenu de bout en bout, du pipeline à l'encaissement, et signale les écarts entre équipes. Tout le reste appartient aux tableaux d'équipe.</p>

<h2>Les huit chiffres et leur question</h2>
<ol>
<li><strong>Signé vs objectif</strong> (mois et trimestre) : sommes-nous en avance ou en retard, et de combien ?</li>
<li><strong>Forecast pondéré du trimestre</strong> : le trimestre est-il couvert ?</li>
<li><strong>Facturé de la semaine</strong> : ce qui a été signé est-il devenu une facture ?</li>
<li><strong>Encaissé et factures en retard</strong> : le cash suit-il, et combien est bloqué ?</li>
<li><strong>MRR et churn</strong> (si abonnement) : la base grandit-elle ?</li>
<li><strong>Pipeline créé</strong> : la machine se réalimente-t-elle ?</li>
<li><strong>Écart signé / facturé brut</strong> : combien de revenu fuit entre les équipes ?</li>
<li><strong>Santé des données</strong> : synchronisations, deals sans date, doublons. Si ce chiffre est mauvais, les sept autres sont douteux.</li>
</ol>

<h2>Ce qui n'y est pas, volontairement</h2>
<p>Le détail par commercial (tableau du manager), les taux de conversion par étape (tableau des ventes), les tickets (tableau du service client), les campagnes (tableau marketing). Le dirigeant y descend quand un des huit chiffres décroche, pas avant. Le <a href="/tableau-de-bord-revops">tableau de bord RevOps</a> décrit ces tableaux d'équipe.</p>

<h2>Le format</h2>
<ul>
<li>Une page, huit tuiles, la valeur et la variation.</li>
<li>Une couleur par état (à jour, à surveiller, à traiter), jamais plus de trois.</li>
<li>La même page chaque lundi, sans version, sans export.</li>
<li>Un lien par tuile vers la liste qui explique le chiffre.</li>
</ul>

<h2>Le lire</h2>
<p>Trois minutes : les tuiles rouges d'abord, puis les variations, puis une question à poser à une équipe. Le récap hebdomadaire (comparé à la semaine précédente, avec les axes d'amélioration) fait le reste. Le guide du <a href="/pilotage-performance-entreprise">pilotage de la performance</a> place ce rituel parmi les autres.</p>

<h2>Ce que fait Revold</h2>
<p>La home de Revold affiche ces tuiles calculées sur les données réconciliées, avec les alertes en tension et les objectifs en retard, et le brief du jour les lit à voix haute ; l'administrateur bascule d'un espace d'équipe à l'autre en un clic. La page <a href="/equipes/direction">Revold pour la direction</a> montre la vue.</p>
`,
  },
  {
    slug: "ltv-cac-calculer-le-ratio-avec-des-donnees-reconciliees",
    title: "LTV / CAC : calculer le ratio avec des données réconciliées, pas des estimations",
    description:
      "Le ratio LTV / CAC compare ce qu'un client rapporte à ce qu'il a coûté à acquérir. Formules (LTV par churn ou par cohorte, CAC par canal), ordres de grandeur, pièges (marge, délai de récupération) et pourquoi il faut des données rapprochées entre régies, CRM et facturation.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2027-01-28",
    readTime: "7 min",
    keywords: ["LTV CAC", "ratio LTV CAC", "calcul LTV", "coût d'acquisition client", "valeur vie client", "payback CAC"],
    related: [
      { href: "/glossaire-revops#ltv", label: "Définition : LTV" },
      { href: "/glossaire-revops#cac", label: "Définition : CAC" },
      { href: "/blog/cout-par-lead-par-canal-relie-au-revenu-signe", label: "Coût par lead relié au revenu signé" },
      { href: "/blog/analyse-de-cohortes-retention-sans-data-engineer", label: "Analyse de cohortes" },
    ],
    faq: [
      { q: "Comment calculer le ratio LTV / CAC ?", a: "LTV = revenu mensuel moyen par client × marge brute ÷ churn mensuel (ou, mieux, revenu cumulé observé par cohorte). CAC = dépenses marketing et ventes ÷ nouveaux clients. Le ratio est LTV ÷ CAC, par canal ou par segment." },
      { q: "Quel ratio LTV / CAC viser ?", a: "Le repère couramment cité est 3 pour 1, avec un délai de récupération du CAC inférieur à 12 à 18 mois. Un ratio très élevé peut signaler un sous-investissement en acquisition." },
    ],
    content: `
<p><strong>En bref :</strong> le ratio LTV / CAC compare la valeur qu'un client rapporte sur la durée de la relation à ce qu'il a coûté à acquérir. Calculé sur des estimations (un churn supposé, une dépense globale), il ne sert qu'aux présentations. Calculé sur des données rapprochées (dépense par canal, clients signés par canal, revenu facturé et rétention par cohorte), il décide du budget d'acquisition.</p>

<h2>LTV : deux méthodes</h2>
<ul>
<li><strong>Par le churn</strong> : revenu mensuel moyen par client × marge brute ÷ churn mensuel. Rapide, mais très sensible au churn (passer de 2 à 1,5 % de churn augmente la LTV d'un tiers).</li>
<li><strong>Par cohorte</strong> : revenu cumulé réellement facturé par une cohorte de clients à 12, 24, 36 mois. Plus lent, mais observé. L'<a href="/blog/analyse-de-cohortes-retention-sans-data-engineer">analyse de cohortes</a> décrit la construction.</li>
</ul>
<p>Dans les deux cas, prenez la marge brute, pas le revenu : un client à 1 000 € de MRR avec 60 % de marge vaut 600 € par mois.</p>

<h2>CAC : par canal, pas en global</h2>
<p>CAC = (dépenses marketing + coût commercial attribuable) ÷ nouveaux clients, par canal et par période, avec le délai de conversion pris en compte. La chaîne de coûts est détaillée dans l'article <a href="/blog/cout-par-lead-par-canal-relie-au-revenu-signe">Coût par lead relié au revenu signé</a>. Un CAC global masque toujours un canal ruineux et un canal rentable.</p>

<h2>Le ratio, et le délai de récupération</h2>
<p>LTV ÷ CAC : le repère couramment cité est 3. Mais un ratio de 3 avec un délai de récupération de 30 mois est un problème de trésorerie ; ajoutez toujours le <strong>payback</strong> = CAC ÷ marge mensuelle par client, à viser sous 12 à 18 mois. Et un ratio de 8 n'est pas une réussite : c'est souvent le signe qu'on n'investit pas assez en acquisition.</p>

<h2>Les données nécessaires, et où elles sont</h2>
<ul>
<li><strong>Dépenses par canal</strong> : régies publicitaires, plus les coûts fixes répartis.</li>
<li><strong>Clients signés par canal</strong> : CRM, source d'origine, deal gagné.</li>
<li><strong>Revenu facturé et rétention par client</strong> : facturation et abonnements, rapprochés du CRM par identifiant légal.</li>
<li><strong>Marge brute</strong> : comptabilité.</li>
</ul>
<p>Le ratio exige donc trois outils rapprochés par client. Sans ce rapprochement, la LTV est estimée et le CAC est global : le ratio est une opinion.</p>

<h2>Ce que fait Revold</h2>
<p>Revold lit les dépenses des régies connectées, les sources et deals HubSpot, et les factures et abonnements Pennylane, Stripe, Chargebee, GoCardless ou Sage rapprochés par client. Le coût d'acquisition par canal, le revenu facturé par canal, les cohortes et la rétention nette sont calculés sur ces lignes ; les définitions de la <a href="/glossaire-revops#ltv">LTV</a> et du <a href="/glossaire-revops#cac">CAC</a> sont dans le glossaire.</p>
`,
  },
];
