import type { BlogArticle } from "./data";

/** Calendrier éditorial — décembre 2026 (mardi et jeudi). Publication automatique à la date (published.ts). */

const AUTHOR = "Ilyes Benchora";
const ROLE = "Expert RevOps";

export const articlesDecember2026: BlogArticle[] = [
  {
    slug: "bilan-revops-fin-d-annee-10-chiffres",
    title: "Bilan RevOps de fin d'année : les 10 chiffres à sortir avant le 31 décembre",
    description:
      "Avant de fixer les objectifs de l'année suivante, dix chiffres à établir sur des données réconciliées : signé, facturé, encaissé, écart, précision du forecast, cycle, conversion par étape, MRR et rétention nette, coût d'acquisition, fuite de revenus.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-12-01",
    readTime: "7 min",
    keywords: ["bilan commercial annuel", "bilan RevOps", "revue annuelle des ventes", "chiffres de fin d'année", "préparer les objectifs de l'année"],
    related: [
      { href: "/kpi-revops", label: "KPI RevOps : formules et sources" },
      { href: "/blog/precision-du-forecast-mesurer-ameliorer", label: "Précision du forecast" },
      { href: "/outils/calculateur-fuite-de-revenus", label: "Estimateur de fuite de revenus" },
      { href: "/pilotage-performance-entreprise", label: "Pilotage de la performance d'entreprise" },
    ],
    faq: [
      { q: "Quels chiffres regarder dans un bilan commercial annuel ?", a: "Le signé, le facturé et l'encaissé (et l'écart entre les trois), la précision du forecast, le cycle de vente, la conversion par étape, le MRR et la rétention nette, le coût d'acquisition par canal, et la fuite de revenus. Dix chiffres, sur des données rapprochées." },
      { q: "Pourquoi réconcilier avant le bilan ?", a: "Parce qu'un bilan fait sur le CRM seul surestime le revenu (deals gagnés non facturés) et qu'un bilan fait sur la comptabilité seule n'explique rien (pas de lien avec le pipeline). Les dix chiffres exigent les deux." },
    ],
    content: `
<p><strong>En bref :</strong> un bilan de fin d'année sert à fixer les objectifs de l'année suivante sur des faits. Dix chiffres suffisent, à condition qu'ils soient calculés sur des données réconciliées entre CRM, facturation et banque. Chacun répond à une question précise et débouche sur une décision.</p>

<h2>Les trois chiffres du revenu</h2>
<ol>
<li><strong>Signé</strong> : Σ deals gagnés de l'année, par pipeline et par commercial. <em>Question :</em> l'objectif a-t-il été atteint, et par qui ?</li>
<li><strong>Facturé</strong> : Σ factures émises. <em>Question :</em> tout le signé a-t-il été facturé ? L'écart brut par deal est le chiffre 4.</li>
<li><strong>Encaissé</strong> : Σ paiements reçus. <em>Question :</em> combien reste dû, et depuis quand ?</li>
</ol>

<h2>Les quatre chiffres de l'efficacité</h2>
<ol start="4">
<li><strong>Écart signé / facturé brut</strong>, deal par deal. C'est la <a href="/fuite-de-revenus">fuite de revenus</a> mesurée ; l'<a href="/outils/calculateur-fuite-de-revenus">estimateur</a> en donne l'ordre de grandeur en attendant la mesure.</li>
<li><strong>Précision du forecast</strong> par trimestre, à J-90 et J-30 (<a href="/blog/precision-du-forecast-mesurer-ameliorer">méthode</a>). <em>Décision :</em> recalibrer les probabilités d'étape.</li>
<li><strong>Cycle de vente</strong> médian par segment, et son évolution. <em>Décision :</em> l'étape à raccourcir.</li>
<li><strong>Conversion par étape</strong> sur l'année, comparée à l'année précédente. <em>Décision :</em> l'étape à travailler en priorité.</li>
</ol>

<h2>Les trois chiffres de la base</h2>
<ol start="8">
<li><strong>MRR de fin d'année et rétention nette</strong> de la cohorte de janvier. <em>Question :</em> la base existante a-t-elle grandi sans nouveaux clients ?</li>
<li><strong>Coût d'acquisition par canal</strong>, rapporté au revenu facturé du canal. <em>Décision :</em> le budget marketing de l'année suivante.</li>
<li><strong>Qualité des données</strong> : entreprises sans SIREN, doublons, contacts sans entreprise, deals sans montant. <em>Décision :</em> le chantier de janvier.</li>
</ol>

<h2>Comment les sortir en une semaine</h2>
<p>Si CRM et facturation sont rapprochés, ces dix chiffres sont des lectures, pas des calculs. Sinon, la semaine passe à rapprocher les clients par SIREN et à associer factures et deals ; c'est l'objet de la <a href="/reconciliation-crm-facturation">réconciliation CRM et facturation</a>. Dans Revold, les récaps de trimestre et d'année produisent ces chiffres par équipe avec la comparaison à la période précédente ; le guide du <a href="/pilotage-performance-entreprise">pilotage de la performance</a> décrit comment les lire en comité de direction.</p>
`,
  },
  {
    slug: "revue-de-pipeline-hebdomadaire-rituel-20-minutes",
    title: "Revue de pipeline hebdomadaire : le rituel en 20 minutes qui tient toute l'année",
    description:
      "Ordre du jour d'une revue de pipeline efficace : dates dépassées, deals stagnants, forecast du mois, prêts à signer, relances. Préparation automatique, règles de décision, et ce qui fait échouer les revues.",
    category: "Sales Intelligence",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-12-03",
    readTime: "6 min",
    keywords: ["revue de pipeline", "pipeline review", "réunion commerciale hebdomadaire", "point pipeline", "rituel commercial"],
    related: [
      { href: "/blog/deals-stagnants-hubspot-detecter-traiter", label: "Deals stagnants dans HubSpot" },
      { href: "/blog/date-de-fermeture-hubspot-forecast-faux", label: "Date de fermeture HubSpot" },
      { href: "/pilotage-revops", label: "Pilotage RevOps : les rituels" },
      { href: "/produits/insights-ia", label: "Mon équipe IA : briefs et récaps" },
    ],
    faq: [
      { q: "Que contient une revue de pipeline ?", a: "Cinq listes courtes : deals à date dépassée, deals stagnants, forecast du mois et du trimestre, deals prêts à signer, factures ou relances liées aux comptes. Chaque ligne reçoit une décision." },
      { q: "Combien de temps doit durer une revue de pipeline ?", a: "Vingt minutes pour une équipe de cinq à huit commerciaux, si la préparation est automatique. Au-delà, la revue devient une réunion de reporting et perd sa fonction de décision." },
    ],
    content: `
<p><strong>En bref :</strong> la revue de pipeline hebdomadaire est le rituel qui empêche le pipeline de pourrir. Elle tient en vingt minutes si elle est préparée automatiquement et si chaque ligne appelle une décision : nouvelle date, prochaine activité, perdu, escalade. Voici l'ordre du jour qui tient, et les trois raisons pour lesquelles les revues échouent.</p>

<h2>L'ordre du jour, dans cet ordre</h2>
<ol>
<li><strong>Dates de fermeture dépassées</strong> (3 min) : chaque deal ouvert à date passée reçoit une nouvelle date justifiée ou passe en perdu. Les règles sont dans l'article sur la <a href="/blog/date-de-fermeture-hubspot-forecast-faux">date de fermeture HubSpot</a>.</li>
<li><strong>Deals stagnants</strong> (5 min) : triés par montant, au-delà du seuil. Prochaine activité datée ou perdu. Voir <a href="/blog/deals-stagnants-hubspot-detecter-traiter">Deals stagnants</a>.</li>
<li><strong>Forecast du mois et du trimestre</strong> (5 min) : pondéré contre objectif, par commercial. Les écarts, pas les chiffres.</li>
<li><strong>Prêts à signer</strong> (4 min) : deals dont la fermeture tombe dans les deux semaines. Ce qui bloque, qui appelle.</li>
<li><strong>Comptes à relancer</strong> (3 min) : factures en retard sur des comptes du pipeline, signaux de churn sur des clients en renouvellement.</li>
</ol>

<h2>Les règles de décision</h2>
<ul>
<li>Aucun deal ne sort de la revue sans une prochaine activité datée ou un statut fermé.</li>
<li>Un deal reporté deux fois est revu avec le manager en tête-à-tête, pas en réunion.</li>
<li>Le forecast annoncé en revue est enregistré ; c'est lui qui sert à mesurer la précision.</li>
</ul>

<h2>Pourquoi les revues échouent</h2>
<ol>
<li><strong>La préparation manuelle.</strong> Si le manager passe une heure à extraire les listes, la revue saute la troisième semaine.</li>
<li><strong>Le tour de table.</strong> Chaque commercial raconte ses deals ; personne ne décide. La revue lit des listes, pas des récits.</li>
<li><strong>L'absence de suite.</strong> Les décisions ne sont pas écrites dans le CRM et reviennent la semaine suivante.</li>
</ol>

<h2>La préparer automatiquement</h2>
<p>Les cinq listes sont des requêtes sur le CRM et la facturation rapprochés. Revold les produit chaque matin dans le brief Ventes (deals stagnants au seuil de l'équipe, prêts à signer par échéance, signés par propriétaire) et chaque lundi dans le récap hebdomadaire comparé à la semaine précédente ; les décisions prises deviennent des actions exécutées dans HubSpot après validation. Le rituel est décrit avec les autres dans le guide du <a href="/pilotage-revops">pilotage RevOps</a>.</p>
`,
  },
  {
    slug: "segmentation-clients-code-naf-effectifs-sirene",
    title: "Segmenter ses clients par code NAF et effectifs : ce que le répertoire Sirene permet",
    description:
      "Une segmentation fiable ne repose pas sur des champs saisis à la main. Le répertoire Sirene fournit pour chaque entreprise française son secteur (code NAF), sa tranche d'effectifs, sa date de création et son statut. Comment l'utiliser pour segmenter le CRM et lire le revenu par segment.",
    category: "Data Quality",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-12-08",
    readTime: "6 min",
    keywords: ["segmentation clients B2B", "code NAF CRM", "tranche d'effectifs", "segmentation par secteur", "enrichissement Sirene", "ICP"],
    related: [
      { href: "/blog/enrichir-crm-siren-api-sirene", label: "Enrichir son CRM avec le SIREN" },
      { href: "/produits/resolution-entites", label: "Résolution d'entités et enrichissement" },
      { href: "/blog/analyse-de-cohortes-retention-sans-data-engineer", label: "Analyse de cohortes" },
      { href: "/glossaire-revops#siren", label: "Définition : SIREN / SIRET" },
    ],
    faq: [
      { q: "Quelles données Sirene sont utiles pour segmenter ?", a: "Le code NAF (secteur d'activité), la tranche d'effectifs, la date de création, la catégorie d'entreprise (PME, ETI, GE) et l'état administratif. Toutes sont publiques et rattachées au SIREN." },
      { q: "Pourquoi ne pas segmenter avec les champs du CRM ?", a: "Parce qu'ils sont saisis à la main, incomplets et hétérogènes (« Industrie », « Industriel », « Manufacturing »). Les données Sirene sont homogènes, à jour et automatiques." },
    ],
    content: `
<p><strong>En bref :</strong> segmenter les clients par secteur et par taille est indispensable pour lire le revenu (quel segment signe vite, paie bien, reste longtemps) et cibler la prospection. Les champs du CRM saisis à la main ne le permettent pas. Le répertoire Sirene fournit, pour chaque entreprise française identifiée par son SIREN, un code NAF, une tranche d'effectifs, une date de création et une catégorie, homogènes et automatiques.</p>

<h2>Ce que Sirene fournit</h2>
<ul>
<li><strong>Code NAF</strong> (activité principale) : 732 codes, regroupables en sections et divisions. « 62.01Z » = programmation informatique.</li>
<li><strong>Tranche d'effectifs</strong> : de 0 à plus de 10 000 salariés, par paliers.</li>
<li><strong>Catégorie d'entreprise</strong> : PME, ETI, grande entreprise.</li>
<li><strong>Date de création</strong> et <strong>état administratif</strong> (active, cessée).</li>
<li><strong>Établissements</strong> : le siège et les autres implantations, avec leur adresse.</li>
</ul>
<p>Tout est rattaché au SIREN ; l'enrichissement suit donc la méthode de l'article <a href="/blog/enrichir-crm-siren-api-sirene">Enrichir son CRM avec le SIREN</a>.</p>

<h2>Construire les segments</h2>
<ol>
<li><strong>Taille</strong> : 3 à 5 tranches d'effectifs qui correspondent à vos offres (par exemple 10–49, 50–249, 250+).</li>
<li><strong>Secteur</strong> : les divisions NAF regroupées en 5 à 8 familles qui ont un sens commercial (industrie, services B2B, logiciel, distribution…).</li>
<li><strong>Maturité</strong> : date de création (moins de 3 ans, 3 à 10, plus de 10).</li>
</ol>
<p>Trois axes, une vingtaine de segments au plus. Au-delà, les segments sont trop petits pour être lus.</p>

<h2>Lire le revenu par segment</h2>
<p>Une fois les segments posés, chaque KPI se lit par segment : taux de closing, cycle de vente, panier moyen, churn, DSO. Les résultats surprennent souvent : le segment qui signe le plus n'est pas celui qui paie le mieux, et celui qui churne le moins n'est pas celui qu'on prospecte. C'est la base d'un profil de client idéal (ICP) fondé sur des faits, et de l'<a href="/blog/analyse-de-cohortes-retention-sans-data-engineer">analyse de cohortes</a> par segment.</p>

<h2>Ce que fait Revold</h2>
<p>Revold enrichit les entreprises HubSpot via l'API Sirene (SIREN, SIRET, TVA, code NAF, effectifs, date de création), pousse les valeurs validées dans le CRM, et permet des cohortes par secteur, taille ou tout champ mappé pour filtrer chaque rapport et chaque KPI. Le moteur de <a href="/produits/resolution-entites">résolution d'entités</a> garantit qu'un segment est calculé sur des entreprises dédoublonnées.</p>
`,
  },
  {
    slug: "factures-impayees-prioriser-relances-montant-client",
    title: "Factures impayées : prioriser les relances par montant, par client et par ancienneté",
    description:
      "Relancer toutes les factures impayées de la même façon fait perdre du temps et du cash. Méthode de priorisation (montant × ancienneté × risque client), rôles par palier de retard, modèles de relance, et suivi du recouvrement comme un KPI.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-12-10",
    readTime: "6 min",
    keywords: ["factures impayées", "relance factures impayées", "recouvrement B2B", "retards de paiement", "relance client"],
    related: [
      { href: "/blog/dso-reduire-delai-de-paiement-depuis-le-crm", label: "DSO : réduire le délai de paiement" },
      { href: "/glossaire-revops#facture-en-retard", label: "Définition : facture en retard" },
      { href: "/hubspot-pennylane", label: "HubSpot et Pennylane" },
      { href: "/equipes/finance", label: "Revold pour la finance" },
    ],
    faq: [
      { q: "Comment prioriser les relances de factures impayées ?", a: "Par montant dû, ancienneté du retard et risque du client (historique de paiement, signaux de churn). Les dix premières lignes de cette liste concentrent souvent l'essentiel du cash à récupérer." },
      { q: "Qui doit relancer un client en retard ?", a: "La comptabilité jusqu'à 30 jours de retard, le commercial qui connaît le client entre 30 et 60 jours, la direction au-delà. Chaque palier a un ton et un canal." },
    ],
    content: `
<p><strong>En bref :</strong> toutes les factures impayées ne se valent pas. Une relance efficace trie par montant, par ancienneté et par risque client, attribue chaque palier de retard à un rôle, et mesure le résultat comme un KPI (montant recouvré, DSO). Les données nécessaires existent dans la facturation et le CRM ; il faut les rapprocher par client.</p>

<h2>Le tri en trois critères</h2>
<ul>
<li><strong>Montant dû</strong> : les dix plus grosses factures échues d'abord.</li>
<li><strong>Ancienneté</strong> : 0–30, 31–60, 61–90, plus de 90 jours. Ce qui dépasse 90 jours a une probabilité de recouvrement qui chute ; c'est urgent.</li>
<li><strong>Risque client</strong> : historique de paiement (paie toujours à 75 jours ou premier retard ?), signaux de churn, contestation ouverte.</li>
</ul>
<p>Score simple : montant × facteur d'ancienneté × facteur de risque. La liste triée est la liste de travail du lundi.</p>

<h2>Les rôles par palier</h2>
<ol>
<li><strong>J+1 à J+30</strong> : la comptabilité, e-mail automatique puis appel courtois. Souvent un oubli ou un bon de commande manquant.</li>
<li><strong>J+31 à J+60</strong> : le commercial qui a signé, avec l'interlocuteur qu'il connaît. La relation fait plus que la lettre.</li>
<li><strong>J+61 et plus</strong> : la direction, mise en demeure, éventuellement suspension du service. Toujours après un appel.</li>
</ol>

<h2>Distinguer les causes</h2>
<p>Une facture contestée n'est pas une facture oubliée. Notez la cause à chaque relance : montant contesté (erreur de facturation → corriger le process en amont), bon de commande manquant (à exiger avant facturation), difficulté du client (risque à surveiller), oubli (relance suffit). Les causes agrégées disent où agir.</p>

<h2>Suivre le résultat</h2>
<p>Deux chiffres chaque mois : le montant recouvré sur les factures échues, et le <a href="/blog/dso-reduire-delai-de-paiement-depuis-le-crm">DSO</a>. Un seuil d'alerte sur chaque facture (montant × ancienneté) évite que la liste ne s'allonge en silence.</p>

<h2>Ce que fait Revold</h2>
<p>Revold lit les factures échues dans Pennylane, Sage, Stripe, Chargebee ou GoCardless, les rapproche des comptes HubSpot et de leur propriétaire, les trie par montant et ancienneté, lit les plus exposées dans le brief Comptabilité, et envoie l'alerte au bon rôle selon le palier. Les séquences de relance peuvent être déclenchées après validation. La page <a href="/equipes/finance">Revold pour la finance</a> décrit le périmètre.</p>
`,
  },
  {
    slug: "ia-pilotage-du-revenu-ce-qu-il-faut-lui-confier",
    title: "IA et pilotage du revenu : ce qu'il faut lui confier, et ce qu'il ne faut surtout pas",
    description:
      "L'IA générative rédige, résume, explique et propose ; elle ne doit pas calculer un forecast ni un KPI. Où placer la frontière dans un outil de pilotage du revenu, comment vérifier ce que l'IA propose, et pourquoi le déterminisme est une exigence, pas une limite.",
    category: "IA & Revenue",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-12-15",
    readTime: "7 min",
    keywords: ["IA pilotage commercial", "IA revenue intelligence", "IA forecast fiable", "agents IA ventes", "IA et données CRM"],
    related: [
      { href: "/plateforme-revenue-intelligence", label: "Plateforme de Revenue Intelligence : le rôle de l'IA" },
      { href: "/produits/insights-ia", label: "Mon équipe IA 24/7" },
      { href: "/blog/ia-revenue-intelligence-cas-usage", label: "IA et Revenue Intelligence : cas d'usage" },
      { href: "/glossaire-revops#kpi-cable", label: "Définition : KPI câblé (vérifié)" },
    ],
    faq: [
      { q: "Peut-on confier le forecast à une IA ?", a: "Le calcul, non : il doit être déterministe et recalculable (montant × probabilité, dates, règles explicites). L'IA peut expliquer le forecast, signaler ce qui a changé et proposer des actions à partir de ce calcul vérifié." },
      { q: "Comment vérifier ce qu'une IA propose sur des données CRM ?", a: "En recalculant la proposition sur les données réelles avant de l'enregistrer : entité, dimension, mesure, période. Si le chiffre recalculé ne correspond pas, la proposition est rejetée. C'est le principe du câblage vérifié." },
    ],
    content: `
<p><strong>En bref :</strong> l'IA générative est excellente pour le langage et médiocre pour le calcul. Dans un outil de pilotage du revenu, elle doit rédiger les briefs, répondre aux questions, expliquer les écarts et proposer des actions ; elle ne doit jamais produire un chiffre. Les chiffres viennent d'un moteur déterministe, recalculable par n'importe qui avec les mêmes données. Cette frontière n'est pas une limite technique, c'est la condition de la confiance.</p>

<h2>Ce que l'IA fait bien</h2>
<ul>
<li><strong>Rédiger</strong> : transformer « 3 alertes en tension, 2 objectifs en retard, 40 k€ de factures échues » en un brief lisible, avec les transitions et le contexte.</li>
<li><strong>Répondre</strong> : « combien de MQL ce mois-ci ? » → trouver le bon indicateur, le lire, répondre.</li>
<li><strong>Expliquer</strong> : « pourquoi le forecast a-t-il baissé de 12 % ? » → lister les deals sortis, reportés, perdus.</li>
<li><strong>Proposer</strong> : un câblage de KPI à partir d'une description en langage naturel, une action sur un compte à risque, un rapprochement ambigu.</li>
</ul>

<h2>Ce qu'elle ne doit pas faire</h2>
<ul>
<li><strong>Calculer un KPI.</strong> Un modèle de langage peut se tromper sur une addition et affirmer le résultat avec assurance. Un chiffre qu'on ne peut pas recalculer n'est pas un chiffre.</li>
<li><strong>Prédire un deal</strong> sans historique suffisant : sous quelques centaines de deals, le modèle apprend le bruit.</li>
<li><strong>Écrire dans les outils</strong> sans validation : une fusion de doublons ou une modification de deal ne se défait pas.</li>
</ul>

<h2>La frontière en pratique : le câblage vérifié</h2>
<p>Quand un utilisateur décrit un KPI (« les deals de plus de 10 k€ signés ce trimestre par pipeline »), l'IA propose un câblage : entité, dimension, mesure, filtres, période. Ce câblage est ensuite <em>exécuté</em> par le moteur déterministe sur les données réelles, et le résultat est montré avant enregistrement. Si le chiffre est faux ou vide, l'utilisateur corrige ou impose une autre source. Rien n'est enregistré sans cette vérification ; c'est la définition du <a href="/glossaire-revops#kpi-cable">KPI câblé</a>.</p>

<h2>Pourquoi le déterminisme est une exigence</h2>
<p>Un comité de direction ne débat pas d'un chiffre qu'il ne peut pas reconstituer. Un forecast déterministe (montant × probabilité d'étape, date choisie, stagnants exclus) peut être contesté ligne par ligne ; un forecast prédictif opaque ne peut être que cru ou rejeté. Le premier fait progresser l'équipe, le second l'éloigne de ses données.</p>

<h2>Comment Revold applique cette frontière</h2>
<p>Les indicateurs, seuils, prévisions et rapprochements sont calculés par un moteur déterministe. Les agents experts par pôle (ventes, marketing, service client, comptabilité) rédigent, répondent et proposent à partir de ces chiffres, en nommant toujours l'outil source. Aucune écriture dans HubSpot ou la facturation sans validation. Le guide de la <a href="/plateforme-revenue-intelligence">plateforme de Revenue Intelligence</a> et la page <a href="/produits/insights-ia">Mon équipe IA</a> décrivent le partage des rôles.</p>
`,
  },
  {
    slug: "hierarchie-de-comptes-consolider-revenu-par-groupe",
    title: "Hiérarchie de comptes : consolider le revenu par groupe (maison mère, filiales, établissements)",
    description:
      "Un client peut être trois entreprises dans le CRM et un groupe dans la réalité. Comment reconstituer les hiérarchies de comptes à partir des SIREN et des liens capitalistiques, consolider le revenu par groupe, et éviter de confondre filiale et doublon.",
    category: "Data Quality",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-12-17",
    readTime: "6 min",
    keywords: ["hiérarchie de comptes", "comptes parents enfants HubSpot", "consolidation par groupe", "maison mère filiales CRM", "key account management"],
    related: [
      { href: "/glossaire-revops#hierarchie-de-comptes", label: "Définition : hiérarchie de comptes" },
      { href: "/blog/doublons-hubspot-detecter-fusionner-entreprises", label: "Doublons HubSpot" },
      { href: "/produits/resolution-entites", label: "Résolution d'entités" },
      { href: "/blog/enrichir-crm-siren-api-sirene", label: "Enrichir son CRM avec le SIREN" },
    ],
    faq: [
      { q: "Comment modéliser une hiérarchie de comptes dans HubSpot ?", a: "Avec l'association entreprise parente / enfant native. La difficulté n'est pas la modélisation mais la détection : il faut savoir que deux SIREN appartiennent au même groupe, ce que les liens capitalistiques et les établissements Sirene permettent." },
      { q: "Quelle différence entre une filiale et un doublon ?", a: "Un doublon a le même SIREN : c'est la même entité juridique saisie deux fois, à fusionner. Une filiale a un SIREN différent lié à la maison mère : à rattacher, jamais à fusionner." },
    ],
    content: `
<p><strong>En bref :</strong> un groupe est souvent trois ou quatre fiches dans le CRM : la maison mère, deux filiales, un établissement. Chacune porte ses deals et ses factures ; personne ne voit le revenu du groupe. Reconstituer la hiérarchie à partir des SIREN, des établissements et des liens capitalistiques permet de consolider le revenu par groupe, de piloter les grands comptes et de ne pas confondre filiale et doublon.</p>

<h2>Pourquoi la hiérarchie compte</h2>
<ul>
<li><strong>Le revenu réel d'un client</strong> : un groupe à 180 k€ ressemble à trois PME à 60 k€ tant qu'il n'est pas consolidé.</li>
<li><strong>Le pilotage grands comptes</strong> : un propriétaire par groupe, une stratégie par groupe.</li>
<li><strong>La rétention</strong> : la résiliation d'une filiale est un signal pour tout le groupe.</li>
<li><strong>La réconciliation</strong> : la facture est parfois adressée à la maison mère pour un deal signé par la filiale.</li>
</ul>

<h2>Reconstituer la hiérarchie</h2>
<ol>
<li><strong>Établissements</strong> : plusieurs SIRET d'un même SIREN sont des établissements, pas des entreprises. Une seule fiche entreprise, plusieurs adresses.</li>
<li><strong>Liens capitalistiques</strong> : les données publiques (INPI, registre des bénéficiaires effectifs) et les dénominations permettent de proposer des liens maison mère → filiale.</li>
<li><strong>Indices dans le CRM</strong> : domaine d'e-mail partagé, même adresse de siège, même signataire.</li>
<li><strong>Validation humaine</strong> : chaque lien est proposé, jamais imposé ; un rattachement erroné fausse la consolidation.</li>
</ol>

<h2>Filiale ou doublon ?</h2>
<p>La règle tient en une ligne : même SIREN = doublon (fusionner) ; SIREN différents liés = hiérarchie (rattacher). Le dédoublonnage doit précéder la hiérarchie, sinon on rattache des doublons entre eux. La méthode est dans l'article <a href="/blog/doublons-hubspot-detecter-fusionner-entreprises">Doublons HubSpot</a>.</p>

<h2>Consolider le revenu</h2>
<p>Une fois la hiérarchie posée, chaque KPI se lit au niveau du groupe : signé, facturé, encaissé, MRR, tickets. Les vingt premiers groupes concentrent souvent la majorité du revenu ; ce sont eux qu'un dirigeant doit connaître par cœur.</p>

<h2>Ce que fait Revold</h2>
<p>Revold détecte les doublons et propose les hiérarchies à partir des SIREN, des établissements Sirene et des liens capitalistiques, les fait valider dans une console dédiée, et écrit les associations parent / enfant dans HubSpot après validation. Le moteur ne se lance qu'après le clic de l'utilisateur. La définition est dans le <a href="/glossaire-revops#hierarchie-de-comptes">glossaire</a> ; la page <a href="/produits/resolution-entites">Résolution d'entités</a> décrit l'ensemble.</p>
`,
  },
  {
    slug: "prevoir-le-premier-trimestre-forecast-trimestriel",
    title: "Prévoir le T1 : construire un forecast trimestriel qui tient dès janvier",
    description:
      "Le premier trimestre se prévoit en décembre, avec un pipeline souvent vidé par la fin d'année. Méthode : pipeline pondéré par échéance, deals reportés, cycle de vente, saisonnalité, et les trois contrôles à faire avant d'annoncer un chiffre.",
    category: "Sales Intelligence",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-12-22",
    readTime: "6 min",
    keywords: ["forecast trimestriel", "prévision T1", "prévoir le premier trimestre", "forecast Q1", "planification commerciale trimestre"],
    related: [
      { href: "/forecast-commercial", label: "Forecast commercial" },
      { href: "/outils/calculateur-forecast-pondere", label: "Calculateur de forecast pondéré" },
      { href: "/blog/objectifs-commerciaux-quotas-atteignables-pipeline", label: "Objectifs commerciaux à partir du pipeline" },
      { href: "/blog/precision-du-forecast-mesurer-ameliorer", label: "Précision du forecast" },
    ],
    faq: [
      { q: "Comment prévoir le chiffre du premier trimestre ?", a: "Pipeline pondéré des deals dont la date de fermeture tombe au T1, plus les deals reportés du T4 revalorisés, plus les deals créables avant fin janvier compte tenu du cycle de vente, corrigé de la saisonnalité observée sur les T1 précédents." },
      { q: "Pourquoi le T1 est-il souvent surestimé ?", a: "Parce que les deals non signés au T4 sont reportés en bloc au T1 avec leur ancienne probabilité, alors qu'un deal reporté convertit moins. Et parce que janvier est court commercialement." },
    ],
    content: `
<p><strong>En bref :</strong> le forecast du premier trimestre se construit en décembre à partir de quatre composantes : le pipeline pondéré à échéance T1, les deals reportés du T4 (avec une probabilité revue à la baisse), les deals encore créables avant fin janvier compte tenu du cycle de vente, et la saisonnalité observée sur les T1 précédents. Trois contrôles évitent d'annoncer un chiffre qu'on devra reprendre en février.</p>

<h2>Les quatre composantes</h2>
<ol>
<li><strong>Pondéré à échéance T1</strong> : deals ouverts dont la date de fermeture tombe entre le 1er janvier et le 31 mars, montant × probabilité d'étape. Le <a href="/outils/calculateur-forecast-pondere">calculateur</a> permet de tester les probabilités.</li>
<li><strong>Reportés du T4</strong> : les deals annoncés pour le T4 et non signés. Un deal reporté convertit moins qu'un deal frais : appliquez une décote (observée sur votre historique, souvent 20 à 40 %).</li>
<li><strong>Créables</strong> : avec un cycle de 60 jours, seuls les deals créés avant fin janvier peuvent se signer au T1. Nombre de deals créables × panier × taux de closing.</li>
<li><strong>Saisonnalité</strong> : le rapport signé T1 ÷ moyenne des trimestres, sur les deux dernières années.</li>
</ol>

<h2>Les trois contrôles avant d'annoncer</h2>
<ul>
<li><strong>Les dates</strong> : combien de deals ont une date de fermeture au 31 mars « par défaut » ? Un T1 gonflé par des dates non maintenues se lit dans la répartition par mois.</li>
<li><strong>Les stagnants</strong> : les deals sans mouvement depuis plus du seuil sont sortis ou pondérés à part.</li>
<li><strong>La couverture</strong> : pipeline brut T1 ÷ objectif T1. Sous 3 ×, l'objectif ou la prospection de janvier est à revoir (voir <a href="/blog/objectifs-commerciaux-quotas-atteignables-pipeline">Objectifs commerciaux à partir du pipeline</a>).</li>
</ul>

<h2>Et ensuite : mesurer</h2>
<p>Enregistrez le forecast annoncé fin décembre. Fin mars, la <a href="/blog/precision-du-forecast-mesurer-ameliorer">précision du forecast</a> se calcule dessus, composante par composante : c'est ainsi que la décote des reportés et les probabilités se calibrent d'une année sur l'autre.</p>

<h2>Ce que fait Revold</h2>
<p>Le forecast pondéré de Revold se lit par échéance (ce trimestre, trimestre suivant) et par pipeline, avec la propriété de date de votre choix ; les deals à date dépassée, les reportés et les stagnants sont listés séparément dans l'audit et le brief Ventes. Le récap de trimestre compare ensuite le prévu au signé, au facturé et à l'encaissé. La <a href="/forecast-commercial">méthode complète</a> détaille chaque composante.</p>
`,
  },
  {
    slug: "recap-annuel-par-equipe-ventes-marketing-support-finance",
    title: "Récap annuel par équipe : ce que ventes, marketing, service client et finance doivent se dire en janvier",
    description:
      "Un récap annuel utile n'est pas un tableau global : c'est quatre lectures par équipe, comparées à l'année précédente, avec les écarts entre équipes (MQL → signé, signé → facturé, tickets → churn). Structure de la revue et questions à poser.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-12-24",
    readTime: "6 min",
    keywords: ["récap annuel", "revue annuelle par équipe", "bilan marketing ventes", "alignement ventes marketing", "revue de performance annuelle"],
    related: [
      { href: "/blog/bilan-revops-fin-d-annee-10-chiffres", label: "Bilan RevOps : les 10 chiffres" },
      { href: "/pilotage-revops", label: "Pilotage RevOps" },
      { href: "/kpi-revops", label: "KPI RevOps par équipe" },
      { href: "/equipes/direction", label: "Revold pour la direction" },
    ],
    faq: [
      { q: "Comment structurer un récap annuel par équipe ?", a: "Quatre blocs (marketing, ventes, service client, finance), chacun avec ses trois à cinq indicateurs comparés à l'année précédente, puis les trois écarts entre équipes : MQL → signé, signé → facturé, tickets → churn. La revue porte sur les écarts, pas sur les blocs." },
    ],
    content: `
<p><strong>En bref :</strong> le récap annuel a un seul but : décider ce que chaque équipe change en janvier. Il tient en quatre lectures courtes, une par pôle, comparées à l'année précédente, puis en trois écarts <em>entre</em> équipes, là où le revenu se perd : entre le marketing et les ventes, entre les ventes et la facturation, entre le support et la rétention.</p>

<h2>Quatre lectures, quinze minutes chacune</h2>
<ul>
<li><strong>Marketing</strong> : contacts créés par source, MQL, taux MQL → SQL, coût par lead et par client signé par canal. <em>Question :</em> quels canaux ont produit du revenu, pas des leads ?</li>
<li><strong>Ventes</strong> : signé vs objectif par commercial, conversion par étape, cycle de vente, précision du forecast. <em>Question :</em> à quelle étape a-t-on perdu le plus, et pourquoi ?</li>
<li><strong>Service client</strong> : tickets, délai de première réponse, SLA, CSAT, comptes churnés et signaux vus avant. <em>Question :</em> combien de départs étaient annoncés ?</li>
<li><strong>Finance</strong> : facturé, encaissé, DSO, factures en retard, écart signé / facturé, MRR et rétention nette. <em>Question :</em> combien de revenu signé n'a pas été encaissé, et où ?</li>
</ul>

<h2>Les trois écarts entre équipes</h2>
<ol>
<li><strong>MQL → signé</strong> : le marketing livre des MQL, les ventes signent une part. L'écart par canal désigne les canaux à couper et ceux à financer.</li>
<li><strong>Signé → facturé</strong> : les ventes signent, la finance facture. L'écart brut par deal est la <a href="/fuite-de-revenus">fuite de revenus</a> ; c'est le chiffre qui change le plus les process.</li>
<li><strong>Tickets → churn</strong> : le support voit les signaux, le commercial voit le compte. L'écart est le nombre de départs qui avaient un signal non traité.</li>
</ol>

<h2>Le format qui marche</h2>
<p>Une page par équipe, un chiffre par ligne, la variation en face, une décision en bas. Pas de présentation, pas de tour de table : les chiffres sont lus avant la réunion, la réunion décide. Les dix chiffres du <a href="/blog/bilan-revops-fin-d-annee-10-chiffres">bilan RevOps</a> se répartissent naturellement dans ces quatre pages.</p>

<h2>Ce que fait Revold</h2>
<p>Revold produit les récaps par équipe (semaine, mois, trimestre) comparés à la période précédente, avec les axes d'amélioration déduits des écarts, à partir des données réconciliées. La direction voit les quatre pôles ; chaque équipe voit le sien. Le guide du <a href="/pilotage-revops">pilotage RevOps</a> décrit les rituels ; la page <a href="/equipes/direction">Revold pour la direction</a> montre la vue d'ensemble.</p>
`,
  },
  {
    slug: "marche-revops-france-2027-ce-qui-change",
    title: "Le marché RevOps en France en 2027 : ce qui change pour les PME et ETI",
    description:
      "Un an après notre état des lieux 2026 : HubSpot toujours dominant en PME, Pennylane généralisé en comptabilité, les outils américains de Revenue Intelligence toujours absents du marché français, l'IA partout dans les discours et rarement dans les calculs. Cinq tendances et ce qu'elles impliquent.",
    category: "Marché B2B France",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-12-29",
    readTime: "7 min",
    keywords: ["marché RevOps France", "RevOps 2027", "revenue intelligence France", "tendances RevOps", "outils RevOps PME"],
    related: [
      { href: "/blog/marche-revops-france-2026", label: "L'état du marché RevOps en France en 2026" },
      { href: "/plateforme-revops", label: "Plateforme RevOps" },
      { href: "/comparatif", label: "Comparatifs : Revold face aux autres outils" },
      { href: "/revenue-intelligence", label: "Revenue Intelligence : guide" },
    ],
    faq: [
      { q: "Quels outils RevOps utilisent les PME françaises en 2027 ?", a: "Un CRM (HubSpot majoritaire, Salesforce en ETI, Pipedrive en TPE), un outil de facturation ou de comptabilité (Pennylane, Sage, Stripe, Chargebee, GoCardless), un outil de support, et, de plus en plus, une couche de réconciliation et de pilotage au-dessus des trois." },
      { q: "Les outils américains de Revenue Intelligence arrivent-ils en France ?", a: "Pas sur le segment PME : Clari, Gong, Aviso ou BoostUp restent centrés sur Salesforce, l'anglais et des budgets enterprise. Les acteurs natifs HubSpot (Forecastio) et français (Revold) occupent le terrain." },
    ],
    content: `
<p><strong>En bref :</strong> en un an, le marché français du RevOps a changé de question. En 2026, on demandait « qu'est-ce que le RevOps ? » ; en 2027, on demande « comment rapprocher HubSpot et Pennylane, et qui pilote le revenu ? ». Cinq tendances, observées chez les PME et ETI que nous accompagnons et dans les recherches en ligne, et ce qu'elles impliquent pour l'année.</p>

<h2>1. La stack s'est stabilisée, le rapprochement non</h2>
<p>HubSpot pour le CRM, Pennylane ou Sage pour la comptabilité, Stripe, Chargebee ou GoCardless pour les abonnements, un outil de support : la stack type d'une PME française n'a plus bougé. Ce qui manque toujours, c'est le lien entre ces outils : un même client reconnu partout, et un revenu suivi du deal à l'encaissement. C'est devenu le premier chantier RevOps, avant le tableau de bord (voir <a href="/reconciliation-crm-facturation">réconciliation CRM et facturation</a>).</p>

<h2>2. Les acteurs américains restent hors du marché PME</h2>
<p>Comme en 2026, Clari, Gong, Aviso ou BoostUp visent Salesforce, l'anglais et l'enterprise. Le mouvement notable vient des outils natifs HubSpot, comme Forecastio sur le forecast, qui prouvent que le segment HubSpot est adressable. Notre <a href="/comparatif">page de comparatifs</a> détaille les positionnements.</p>

<h2>3. L'IA est partout dans les discours, rarement dans les calculs</h2>
<p>Chaque outil annonce des « insights IA ». Les entreprises qui ont essayé de laisser un modèle calculer leur forecast ont fait marche arrière : un chiffre non recalculable ne survit pas à un comité de direction. La frontière qui s'impose est celle décrite dans <a href="/blog/ia-pilotage-du-revenu-ce-qu-il-faut-lui-confier">IA et pilotage du revenu</a> : l'IA rédige et propose, le moteur calcule.</p>

<h2>4. Le poste RevOps se crée en ETI, pas en PME</h2>
<p>Les offres d'emploi RevOps se concentrent sur les entreprises de plus de 200 salariés. En dessous, la fonction est portée par le dirigeant ou le responsable commercial, outillé. C'est cohérent avec ce que nous décrivions dans <a href="/blog/revops-en-pme-par-ou-commencer-sans-recruter">RevOps en PME sans recruter</a>.</p>

<h2>5. La fuite de revenus devient un sujet de direction</h2>
<p>L'écart entre signé et facturé, ignoré il y a deux ans, est désormais un chiffre demandé en comité. Les entreprises qui l'ont mesuré ont trouvé entre 1 et 5 % de revenu à récupérer ; ce sont souvent les projets RevOps les plus vite rentabilisés (<a href="/fuite-de-revenus">guide</a>).</p>

<h2>Ce que cela implique pour 2027</h2>
<ul>
<li>Commencer par le rapprochement des données, pas par le reporting.</li>
<li>Exiger des chiffres recalculables de tout outil « IA ».</li>
<li>Mesurer la fuite de revenus avant de chercher de nouveaux leads.</li>
<li>Outiller la fonction RevOps avant de la recruter.</li>
</ul>
<p>Le guide <a href="/plateforme-revops">Plateforme RevOps</a> donne les critères de choix d'un outil dans ce contexte ; notre <a href="/blog/marche-revops-france-2026">état des lieux 2026</a> reste disponible pour la comparaison.</p>
`,
  },
  {
    slug: "checklist-revops-debut-d-annee-12-reglages",
    title: "Checklist RevOps de début d'année : 12 réglages à vérifier avant de piloter",
    description:
      "Douze vérifications à faire début janvier sur le CRM, la facturation, les indicateurs et les alertes pour que le pilotage de l'année parte sur des données propres : pipelines, probabilités, dates, propriétaires, seuils, objectifs, exercice fiscal, connecteurs.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-12-31",
    readTime: "6 min",
    keywords: ["checklist RevOps", "préparer l'année commerciale", "réglages CRM début d'année", "hygiène CRM", "kick-off commercial"],
    related: [
      { href: "/audit-crm-hubspot", label: "Audit CRM HubSpot : la checklist en 12 points" },
      { href: "/blog/objectifs-commerciaux-quotas-atteignables-pipeline", label: "Objectifs commerciaux à partir du pipeline" },
      { href: "/produits/alertes-previsions", label: "Alertes, objectifs et actions" },
      { href: "/pilotage-revops", label: "Pilotage RevOps" },
    ],
    faq: [
      { q: "Que vérifier dans le CRM en début d'année ?", a: "Les étapes et probabilités de chaque pipeline, les deals à date dépassée, les deals sans propriétaire actif, les doublons et les contacts sans entreprise, puis les objectifs, les seuils d'alerte, l'exercice fiscal et l'état des connecteurs." },
    ],
    content: `
<p><strong>En bref :</strong> le pilotage de l'année part des réglages de janvier. Douze vérifications, une heure, sur le CRM, la facturation, les indicateurs et les alertes, pour ne pas découvrir en mars que le forecast reposait sur des probabilités de 2025 ou que les alertes partaient vers un commercial parti en novembre.</p>

<h2>Le CRM</h2>
<ol>
<li><strong>Pipelines et étapes</strong> : chaque pipeline a-t-il des étapes qui correspondent à des engagements réels du client ? Les pipelines de renouvellement et d'upsell sont-ils séparés ?</li>
<li><strong>Probabilités d'étape</strong> : recalibrées sur les conversions observées de l'année écoulée, pas sur la configuration initiale.</li>
<li><strong>Dates de fermeture dépassées</strong> : zéro deal ouvert à date passée au 1er janvier.</li>
<li><strong>Propriétaires</strong> : aucun deal ni compte rattaché à un utilisateur désactivé.</li>
<li><strong>Qualité</strong> : doublons, contacts sans entreprise, entreprises sans SIREN, deals sans montant, via l'<a href="/audit-crm-hubspot">audit CRM</a>.</li>
</ol>

<h2>La facturation</h2>
<ol start="6">
<li><strong>Exercice fiscal</strong> : l'année fiscale et ses échéances (TVA, IS) sont configurées pour que les périodes des rapports soient justes.</li>
<li><strong>Factures échues</strong> : la liste est vide ou chaque ligne a un propriétaire et un palier de relance.</li>
<li><strong>Deals signés non facturés</strong> de l'année écoulée : traités avant la clôture.</li>
</ol>

<h2>Les indicateurs et les alertes</h2>
<ol start="9">
<li><strong>Objectifs de l'année</strong> : dérivés du pipeline (voir <a href="/blog/objectifs-commerciaux-quotas-atteignables-pipeline">Objectifs commerciaux</a>), répartis par trimestre et par commercial, câblés sur les KPIs réels.</li>
<li><strong>Seuils d'alerte</strong> : revus avec les niveaux de l'année (un seuil de MRR fixé il y a un an est obsolète).</li>
<li><strong>Destinataires</strong> : chaque alerte et chaque récap ont un destinataire nommé et un canal qui fonctionne.</li>
</ol>

<h2>Les connecteurs</h2>
<ol start="12">
<li><strong>Synchronisations</strong> : aucune connexion en échec, dernières synchronisations datées d'aujourd'hui, jetons OAuth valides.</li>
</ol>

<h2>En une heure, avec le bon outil</h2>
<p>Dans Revold, les points 3, 4, 5, 7, 8 et 12 sont lus dans l'audit et le brief du jour ; les objectifs et seuils (9 à 11) se règlent dans les alertes et objectifs câblés (<a href="/produits/alertes-previsions">page produit</a>) ; l'exercice fiscal (6) dans les paramètres de l'organisation. Le guide du <a href="/pilotage-revops">pilotage RevOps</a> reprend ensuite les rituels de l'année.</p>
`,
  },
];
