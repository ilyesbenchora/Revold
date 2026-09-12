import type { BlogArticle } from "./data";

/**
 * Calendrier éditorial à partir du 12 septembre 2026 — deux articles par
 * semaine (mardi et jeudi), publiés AUTOMATIQUEMENT à leur date (published.ts).
 *
 * Chaque article cible une requête identifiée dans l'analyse SEO / GEO du
 * 11 septembre : soit à fort volume et concurrentielle mais atteignable avec
 * un angle « données réelles », soit à volume moyen et faible concurrence
 * française. Structure commune, pensée pour Google ET les moteurs génératifs :
 *  - une réponse directe en ouverture (citable telle quelle) ;
 *  - des H2 qui reprennent les questions réellement tapées ;
 *  - des chiffres présentés comme des ordres de grandeur sourçables ;
 *  - des liens internes vers les guides, outils et définitions du glossaire ;
 *  - une FAQ (schéma FAQPage) et des mots-clés secondaires.
 *
 * Pour ajouter un article : une entrée ici avec une date future — rien d'autre
 * à faire, il paraîtra le jour dit (liste, page, RSS, sitemap, llms.txt).
 */

const AUTHOR = "Ilyes Benchora";
const ROLE = "Expert RevOps";

export const editorialArticles: BlogArticle[] = [
  // ── Publié le 12 septembre 2026 ─────────────────────────────────────────
  {
    slug: "kpi-commerciaux-2026-formules-benchmarks",
    title: "Les 12 KPI commerciaux à suivre en 2026 : formules, ordres de grandeur et pièges",
    description:
      "Les 12 KPI commerciaux qui comptent vraiment en B2B : formule de calcul, source de données, ordre de grandeur observé et erreur classique pour chacun. Du pipeline à l'encaissement.",
    category: "Sales Intelligence",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-09-12",
    readTime: "9 min",
    keywords: ["KPI commerciaux", "indicateurs commerciaux", "KPI ventes B2B", "tableau de bord commercial", "taux de conversion commercial"],
    related: [
      { href: "/tableau-de-bord-commercial", label: "Tableau de bord commercial : les 7 KPI sur une page" },
      { href: "/kpi-revops", label: "KPI RevOps : 20 indicateurs par équipe" },
      { href: "/outils/calculateur-forecast-pondere", label: "Calculateur de forecast pondéré" },
      { href: "/glossaire-revops", label: "Glossaire : définitions et formules" },
    ],
    faq: [
      { q: "Quels sont les KPI commerciaux les plus importants ?", a: "Pipeline en cours, forecast pondéré, taux de conversion par étape, cycle de vente, panier moyen, signé par commercial, deals stagnants et écart signé / facturé. Les quatre premiers suffisent à piloter une équipe ; les autres sécurisent le revenu." },
      { q: "Combien de KPI commerciaux suivre ?", a: "Entre cinq et sept sur le tableau de bord de l'équipe, trois par commercial. Au-delà, plus personne ne les lit et aucun n'est actionné." },
      { q: "Où trouver les données pour calculer ces KPI ?", a: "Le CRM (HubSpot, Salesforce, Pipedrive) pour tout ce qui précède la signature ; l'outil de facturation (Pennylane, Stripe, Sage) et la banque pour ce qui suit. Les KPI les plus utiles croisent les deux." },
    ],
    content: `
<p><strong>En bref :</strong> un KPI commercial n'a de valeur que s'il a une formule écrite, une source de données connue et une personne qui le lit chaque semaine. Voici les douze que nous voyons piloter le revenu chez les entreprises B2B françaises, du premier contact à l'encaissement, avec pour chacun la formule, la source, l'ordre de grandeur couramment observé et le piège qui le fausse.</p>

<h2>Pourquoi la plupart des KPI commerciaux sont faux</h2>
<p>Pas parce qu'ils sont mal choisis : parce qu'ils sont mal calculés. Un taux de conversion mesuré sur des étapes que les commerciaux sautent, un cycle de vente calculé sur des dates de création jamais remises à jour, un forecast qui compte des deals sans montant. Chaque KPI ci-dessous vient donc avec son piège, et le premier réflexe avant de piloter est un <a href="/audit-crm-hubspot">audit du CRM</a>.</p>

<h2>Acquisition et qualification</h2>
<h3>1. Nouveaux deals créés</h3>
<p><strong>Formule :</strong> nombre de deals créés sur la période, par source et par commercial. <strong>Source :</strong> CRM. <strong>Piège :</strong> les deals créés « pour faire du chiffre » en fin de mois, sans montant ni contact associé. Filtrez sur les deals avec montant et prochaine activité.</p>
<h3>2. Taux MQL → SQL</h3>
<p><strong>Formule :</strong> contacts passés SQL ÷ contacts passés MQL sur la période. <strong>Source :</strong> dates d'entrée dans les étapes du cycle de vie du CRM. <strong>Ordre de grandeur :</strong> les benchmarks B2B publiés se situent souvent entre 10 et 30 % selon le canal. <strong>Piège :</strong> un marketing qui qualifie trop large fait mécaniquement baisser le taux.</p>

<h2>Pipeline</h2>
<h3>3. Pipeline en cours</h3>
<p><strong>Formule :</strong> Σ montant des deals ouverts, par pipeline. <strong>Piège :</strong> mélanger les pipelines (nouveaux clients, renouvellements, upsell) dans un seul chiffre. Un pipeline de renouvellement à 90 % de probabilité n'a rien à voir avec un pipeline de prospection.</p>
<h3>4. Forecast pondéré</h3>
<p><strong>Formule :</strong> Σ montant × probabilité d'étape, pour les deals dont la date de fermeture tombe dans la période. C'est <em>le</em> KPI de la direction. <strong>Piège :</strong> des probabilités d'étape déclarées et jamais confrontées aux conversions réelles. Testez vos propres chiffres avec le <a href="/outils/calculateur-forecast-pondere">calculateur de forecast pondéré</a>, et lisez la <a href="/forecast-commercial">méthode complète</a>.</p>
<h3>5. Taux de conversion par étape</h3>
<p><strong>Formule :</strong> deals passés à l'étape suivante ÷ deals entrés dans l'étape. <strong>Ordre de grandeur :</strong> en B2B, les taux publiés vont de 30–40 % en début de pipeline à 60–70 % en fin. <strong>Piège :</strong> les étapes sautées. Si un commercial passe directement de « Qualification » à « Négociation », l'étape intermédiaire affiche un taux absurde. Le KPI le plus actionnable, à condition d'imposer un passage par chaque étape.</p>
<h3>6. Deals stagnants</h3>
<p><strong>Formule :</strong> deals ouverts dans la même étape depuis plus de N jours (14 à 30 selon le cycle). <strong>Source :</strong> dans HubSpot, la propriété <code>hs_time_in_latest_deal_stage</code>. <strong>Piège :</strong> les compter dans le forecast. Un deal stagnant depuis 60 jours en « Proposition envoyée » ne vaut pas 55 % de son montant.</p>

<h2>Efficacité de vente</h2>
<h3>7. Cycle de vente</h3>
<p><strong>Formule :</strong> délai moyen création → signature des deals gagnés, par segment. <strong>Piège :</strong> la médiane est souvent plus honnête que la moyenne, tirée vers le haut par quelques deals interminables.</p>
<h3>8. Panier moyen</h3>
<p><strong>Formule :</strong> Σ montant des deals gagnés ÷ nombre de deals gagnés. <strong>Piège :</strong> le calculer sur le montant CRM plutôt que sur le montant facturé. Les deux divergent plus souvent qu'on ne le croit.</p>
<h3>9. Taux de closing</h3>
<p><strong>Formule :</strong> deals gagnés ÷ (gagnés + perdus) sur la période. <strong>Piège :</strong> les deals « perdus » jamais fermés, qui restent ouverts pendant des mois et gonflent artificiellement le taux.</p>

<h2>Après la signature : là où le revenu se perd</h2>
<h3>10. Signé par commercial</h3>
<p><strong>Formule :</strong> Σ montant des deals gagnés par propriétaire sur la période, comparé à l'objectif. <strong>Piège :</strong> le propriétaire du deal n'est pas toujours celui qui l'a travaillé ; alignez la règle d'attribution avant de commissionner.</p>
<h3>11. Écart signé / facturé</h3>
<p><strong>Formule :</strong> Σ |montant du deal − montant facturé|, deal par deal. <strong>Source :</strong> CRM × facturation, après rapprochement des entreprises par SIREN. <strong>Piège :</strong> calculer un écart net. Deux erreurs opposées se compensent et masquent une <a href="/fuite-de-revenus">fuite de revenus</a>. C'est le KPI que presque personne ne suit, et celui qui rapporte le plus quand on le découvre.</p>
<h3>12. Délai signature → premier encaissement</h3>
<p><strong>Formule :</strong> jours entre la date de clôture du deal et le premier paiement reçu. <strong>Piège :</strong> un délai qui s'allonge signale un problème de facturation (factures émises tard) ou de recouvrement (relances absentes), pas un problème commercial. Il faut lire les deux.</p>

<h2>Comment les faire vivre</h2>
<ul>
<li><strong>Un tableau, cinq à sept KPI.</strong> Le <a href="/tableau-de-bord-commercial">tableau de bord commercial</a> tient sur une page ou il n'est pas lu.</li>
<li><strong>Un seuil par KPI.</strong> Un indicateur sans alerte ni objectif rattaché ne change aucun comportement.</li>
<li><strong>Une source par chiffre.</strong> Le CRM pour le signé, la facturation pour le facturé, la banque pour l'encaissé, et un rapprochement entre les trois.</li>
<li><strong>Une lecture hebdomadaire.</strong> Le lundi, dix minutes, les mêmes chiffres, les mêmes définitions.</li>
</ul>
<p>C'est exactement ce que fait <a href="/plateforme-revops">une plateforme RevOps</a> : elle calcule ces douze indicateurs sur les données réconciliées, les vérifie avant de les afficher et les lit chaque matin par équipe. Les définitions complètes sont dans le <a href="/glossaire-revops">glossaire</a>.</p>
`,
  },
  {
    slug: "bon-taux-de-churn-b2b-benchmarks-2026",
    title: "Quel est un bon taux de churn en B2B ? Ordres de grandeur 2026 et méthode de calcul",
    description:
      "Churn client, churn revenu, rétention nette : les trois taux à distinguer, leurs formules, les ordres de grandeur couramment cités en B2B et en SaaS, et les signaux qui annoncent une résiliation avant qu'elle n'arrive.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-09-12",
    readTime: "8 min",
    keywords: ["taux de churn", "bon taux de churn", "churn B2B", "churn SaaS", "calcul churn", "rétention nette"],
    related: [
      { href: "/outils/calculateur-churn", label: "Calculateur de churn et de rétention nette" },
      { href: "/hubspot-stripe", label: "HubSpot et Stripe : lire le churn avec le CRM" },
      { href: "/glossaire-revops#churn", label: "Définition : churn (taux d'attrition)" },
      { href: "/glossaire-revops#nrr", label: "Définition : rétention nette (NRR)" },
    ],
    faq: [
      { q: "Quel est un bon taux de churn mensuel en SaaS B2B ?", a: "Les ordres de grandeur couramment cités se situent sous 1 % de churn revenu mensuel pour un SaaS B2B mature, et entre 1 et 3 % pour une jeune entreprise ou un marché PME. Le repère le plus fiable reste votre propre tendance mois après mois." },
      { q: "Churn client ou churn revenu : lequel suivre ?", a: "Les deux. Le churn client compte les logos perdus ; le churn revenu pondère par le montant. Perdre trois petits comptes ou un grand compte ne se lit pas de la même façon." },
      { q: "Comment calculer la rétention nette ?", a: "(MRR en début de période + expansion − contraction − churn) ÷ MRR en début de période. Au-dessus de 100 %, la base existante croît sans nouveaux clients." },
    ],
    content: `
<p><strong>En bref :</strong> il n'existe pas de « bon » taux de churn universel. Les ordres de grandeur publiés pour le SaaS B2B tournent autour de 1 % de churn revenu par mois pour une entreprise mature, davantage sur les marchés PME et en début de vie. Ce qui compte, c'est de mesurer trois taux distincts (client, revenu, rétention nette) avec la même formule chaque mois, et de lire les signaux qui précèdent la résiliation.</p>

<h2>Les trois taux de churn, et pourquoi ils divergent</h2>
<p>Une entreprise peut perdre 5 % de ses clients et 1 % de son revenu, si les comptes partis étaient petits. L'inverse est vrai avec un grand compte. D'où trois mesures :</p>
<ul>
<li><strong>Churn client</strong> = clients perdus ÷ clients en début de période. Il mesure la santé de la relation.</li>
<li><strong>Churn revenu</strong> = MRR perdu ÷ MRR en début de période. Il mesure l'impact financier.</li>
<li><strong>Rétention nette (NRR)</strong> = (MRR initial + expansion − contraction − churn) ÷ MRR initial. Elle ajoute ce que les clients restants ont acheté en plus.</li>
</ul>
<p>Les formules détaillées sont dans le <a href="/glossaire-revops#churn">glossaire</a>, et le <a href="/outils/calculateur-churn">calculateur de churn</a> donne les trois taux à partir de six chiffres.</p>

<h2>Quels ordres de grandeur en B2B ?</h2>
<p>Les chiffres qui circulent viennent d'études d'éditeurs et d'investisseurs, principalement américaines ; prenez-les comme des repères, pas comme des normes.</p>
<ul>
<li><strong>SaaS B2B mature, grands comptes :</strong> churn revenu annuel de l'ordre de 5 à 10 %, rétention nette souvent supérieure à 100 %.</li>
<li><strong>SaaS B2B sur PME :</strong> churn revenu mensuel de 1 à 3 %, soit 12 à 30 % par an. Le marché PME churne davantage parce que les entreprises elles-mêmes disparaissent ou changent d'outil plus souvent.</li>
<li><strong>Services récurrents (agences, abonnements de prestation) :</strong> plus variable ; la durée de contrat structure tout.</li>
</ul>
<p>Le repère le plus utile n'est pas le benchmark : c'est votre propre courbe. Un churn revenu qui passe de 1,2 à 1,8 % sur trois mois est un signal, quelle que soit la moyenne du marché.</p>

<h2>Pourquoi le churn est découvert trop tard</h2>
<p>Dans la plupart des PME, la résiliation est constatée en comptabilité, quand l'abonnement Stripe ou Chargebee s'arrête. Le commercial l'apprend après, le service client ne l'a pas vue venir. La cause est structurelle : les abonnements vivent dans l'outil de facturation, la relation vit dans le CRM, les tickets vivent dans l'outil de support, et personne ne rapproche les trois par client.</p>
<p>Une fois rapprochés (en France, par SIREN ou numéro de TVA), trois signaux apparaissent semaines avant la résiliation :</p>
<ul>
<li><strong>Tickets support</strong> : hausse du nombre de tickets ou d'un ticket non résolu au-delà du SLA.</li>
<li><strong>Paiements</strong> : premier paiement échoué, retard de règlement, passage en mensuel.</li>
<li><strong>Contraction</strong> : baisse du nombre de sièges ou du plan, sans que le CRM le sache.</li>
</ul>
<p>C'est l'objet du croisement <a href="/hubspot-stripe">HubSpot × Stripe</a> : lire MRR, churn et paiements avec les deals et les comptes du CRM.</p>

<h2>Réduire le churn : trois leviers mesurables</h2>
<ol>
<li><strong>Un propriétaire par compte à risque.</strong> Chaque signal déclenche une alerte vers le propriétaire du compte, avec le montant en jeu. Sans destinataire nommé, l'alerte est ignorée.</li>
<li><strong>Un rituel mensuel de rétention.</strong> Les vingt comptes qui pèsent le plus de MRR, lus avec leurs tickets et leurs paiements.</li>
<li><strong>L'expansion comme antidote.</strong> Une rétention nette au-dessus de 100 % compense un churn client de plusieurs pour cent. Suivez l'expansion avec la même rigueur que les résiliations.</li>
</ol>

<h2>Ce que mesure Revold</h2>
<p>Revold lit les abonnements (Stripe, Chargebee, GoCardless, Pennylane), les tickets et le CRM, rapproche les clients par identifiant légal, et calcule churn client, churn revenu et rétention nette par période. Les alertes de rétention (paiement échoué, contraction, ticket hors SLA) partent sur Slack, Teams ou par e-mail avec le montant concerné. Le détail des indicateurs est dans le guide des <a href="/kpi-revops">KPI RevOps</a>.</p>
`,
  },

  // ── Mardi 15 septembre 2026 ─────────────────────────────────────────────
  {
    slug: "pipeline-commercial-b2b-etapes-taux-conversion",
    title: "Pipeline commercial B2B : étapes, taux de conversion par étape et ordres de grandeur",
    description:
      "Comment structurer un pipeline commercial B2B en 5 à 7 étapes, mesurer le taux de conversion à chaque étape, fixer des probabilités qui tiennent, et détecter les goulots d'étranglement. Méthode et exemples.",
    category: "Sales Intelligence",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-09-15",
    readTime: "8 min",
    keywords: ["pipeline commercial", "pipeline de vente B2B", "étapes pipeline commercial", "taux de conversion par étape", "gestion du pipeline"],
    related: [
      { href: "/forecast-commercial", label: "Forecast commercial : méthode fiable" },
      { href: "/tableau-de-bord-commercial", label: "Tableau de bord commercial" },
      { href: "/outils/calculateur-forecast-pondere", label: "Calculateur de forecast pondéré" },
      { href: "/glossaire-revops#taux-de-conversion-par-etape", label: "Définition : taux de conversion par étape" },
    ],
    faq: [
      { q: "Combien d'étapes dans un pipeline commercial B2B ?", a: "Cinq à sept. Moins, on ne voit pas où les deals se perdent ; plus, les commerciaux sautent des étapes et les taux deviennent faux." },
      { q: "Comment calculer le taux de conversion par étape ?", a: "Deals passés à l'étape suivante ÷ deals entrés dans l'étape, sur une période donnée. Il faut compter les entrées, pas le stock présent à l'instant t." },
      { q: "Quels taux de conversion par étape en B2B ?", a: "Les ordres de grandeur publiés vont de 30–40 % de la prospection à la qualification jusqu'à 60–70 % de la négociation à la signature. Vos propres taux, mesurés sur six mois, valent mieux que tout benchmark." },
    ],
    content: `
<p><strong>En bref :</strong> un pipeline commercial B2B se structure en cinq à sept étapes qui correspondent à des engagements réels du prospect, pas à des actions du commercial. Le taux de conversion de chaque étape (entrées ÷ passages à l'étape suivante) est l'indicateur le plus actionnable de la vente : il désigne l'étape où le revenu se perd, et il fournit les probabilités du <a href="/forecast-commercial">forecast</a>.</p>

<h2>Les étapes d'un pipeline qui tient</h2>
<p>Une étape est un fait vérifiable côté client. « Démo planifiée » n'est pas une étape : le prospect n'a rien engagé. « Démo réalisée avec le décideur » en est une. Voici un pipeline type pour une vente B2B de quelques semaines à quelques mois :</p>
<ol>
<li><strong>Qualifié</strong> : besoin confirmé, budget et décideur identifiés.</li>
<li><strong>Démo réalisée</strong> : le décideur a vu le produit.</li>
<li><strong>Proposition envoyée</strong> : un chiffrage écrit est entre ses mains.</li>
<li><strong>Négociation</strong> : le prospect a répondu à la proposition avec des demandes.</li>
<li><strong>Validation</strong> : accord verbal, contrat ou bon de commande en circulation.</li>
<li><strong>Gagné / Perdu</strong>.</li>
</ol>
<p>Les renouvellements et l'upsell méritent leur propre pipeline : leurs probabilités n'ont rien à voir, et les mélanger fausse toutes les moyennes.</p>

<h2>Mesurer le taux de conversion par étape</h2>
<p>La formule est simple, l'exécution rarement : <em>deals entrés dans l'étape sur la période ÷ deals passés à l'étape suivante</em>. Trois conditions pour que le chiffre soit vrai :</p>
<ul>
<li><strong>Interdire les sauts d'étape.</strong> Un deal qui passe de « Qualifié » à « Négociation » rend l'étape « Proposition » invisible. Dans HubSpot, les propriétés obligatoires par étape et les dates d'entrée (<code>hs_v2_date_entered_*</code>) permettent de le contrôler.</li>
<li><strong>Compter les entrées, pas le stock.</strong> Le nombre de deals présents dans une étape aujourd'hui ne dit rien de la conversion.</li>
<li><strong>Fermer les perdus.</strong> Un deal abandonné mais laissé ouvert ne sort jamais du dénominateur.</li>
</ul>

<h2>Lire les goulots d'étranglement</h2>
<p>Placez les taux côte à côte. Le goulot n'est pas l'étape au taux le plus bas en valeur absolue (la première étape est toujours la plus basse), c'est celle dont le taux a <em>baissé</em> par rapport aux trimestres précédents, ou celle où le délai moyen s'allonge. Un taux Proposition → Négociation qui passe de 55 à 40 % pendant que le délai passe de 9 à 21 jours désigne un problème de pricing ou de qualification, pas de closing.</p>

<h2>Des probabilités d'étape qui tiennent</h2>
<p>La probabilité d'une étape est son taux de conversion cumulé jusqu'à la signature, observé sur six à douze mois. Si 60 % des deals en Négociation se signent, la probabilité de l'étape est 60 %, pas 80 % parce que « c'est presque fait ». Ces probabilités alimentent directement le forecast pondéré ; vous pouvez tester l'effet d'un changement de probabilité sur votre prévision avec le <a href="/outils/calculateur-forecast-pondere">calculateur</a>.</p>

<h2>Les deux fuites invisibles du pipeline</h2>
<p><strong>Les deals stagnants</strong> : ouverts sans mouvement depuis plus de deux ou trois semaines, ils gonflent les étapes avancées. Sortez-les du forecast et donnez-leur une prochaine activité ou fermez-les.</p>
<p><strong>Les deals gagnés jamais facturés</strong> : le pipeline s'arrête à « Gagné », le revenu non. Le rapprochement entre CRM et facturation révèle les deals signés sans facture ; c'est l'objet de la <a href="/reconciliation-crm-facturation">réconciliation CRM et facturation</a>.</p>

<h2>Le pipeline dans un tableau de bord</h2>
<p>Quatre vues suffisent : montant par étape (par pipeline), taux de conversion par étape sur le trimestre, deals stagnants, forecast pondéré du mois et du trimestre. Le <a href="/tableau-de-bord-commercial">tableau de bord commercial</a> décrit la disposition ; Revold les fournit prêts à l'emploi sur HubSpot, avec le seuil de stagnation configurable et un brief Ventes chaque matin qui lit les deals prêts à signer et ceux qui bloquent.</p>
`,
  },

  // ── Jeudi 17 septembre 2026 ─────────────────────────────────────────────
  {
    slug: "deals-stagnants-hubspot-detecter-traiter",
    title: "Deals stagnants dans HubSpot : les détecter, les traiter, les empêcher de revenir",
    description:
      "Un deal stagnant est un deal ouvert sans mouvement au-delà d'un seuil de jours. Comment le mesurer dans HubSpot (hs_time_in_latest_deal_stage), quel seuil choisir, quoi en faire et comment l'exclure du forecast.",
    category: "Data Quality",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-09-17",
    readTime: "7 min",
    keywords: ["deals stagnants", "deal stagnant HubSpot", "hs_time_in_latest_deal_stage", "pipeline qui n'avance pas", "nettoyer pipeline HubSpot"],
    related: [
      { href: "/audit-crm-hubspot", label: "Audit CRM HubSpot : la checklist en 12 points" },
      { href: "/forecast-commercial", label: "Forecast commercial : les signaux qui le dégradent" },
      { href: "/glossaire-revops#deal-stagnant", label: "Définition : deal stagnant" },
      { href: "/alternative/hubspot-previsions", label: "Prévisions HubSpot : ce que l'outil natif ne voit pas" },
    ],
    faq: [
      { q: "Qu'est-ce qu'un deal stagnant ?", a: "Une opportunité ouverte restée dans la même étape de pipeline au-delà d'un seuil de jours, généralement 14 à 30 selon la longueur du cycle de vente." },
      { q: "Comment mesurer la stagnation dans HubSpot ?", a: "Avec la propriété hs_time_in_latest_deal_stage (temps passé dans l'étape actuelle, en millisecondes), ou à défaut avec la date de dernière modification du deal." },
      { q: "Faut-il supprimer les deals stagnants ?", a: "Non : les qualifier. Soit une prochaine activité est planifiée et le deal reste, soit il passe en perdu avec une raison. Un deal stagnant compté dans le forecast est le vrai problème." },
    ],
    content: `
<p><strong>En bref :</strong> un deal stagnant est une opportunité ouverte qui n'a pas changé d'étape depuis plus de N jours. Dans HubSpot, la propriété <code>hs_time_in_latest_deal_stage</code> donne ce délai directement. Le seuil dépend du cycle de vente (14 jours pour un cycle d'un mois, 30 pour un cycle d'un trimestre). Un deal stagnant n'est pas à supprimer : il est à qualifier, puis à sortir du forecast tant qu'il n'a pas de prochaine activité.</p>

<h2>Pourquoi les deals stagnants coûtent cher</h2>
<p>Ils gonflent le pipeline, donc le forecast. Un deal de 40 000 € en « Proposition envoyée » à 55 % depuis 70 jours compte 22 000 € dans la prévision du mois, pour une signature qui n'arrivera pas. Multipliez par une dizaine de deals et le forecast est faux de plusieurs dizaines de milliers d'euros, ce qui explique une partie des écarts décrits dans <a href="/blog/forecast-b2b-pourquoi-93-pourcent-sont-faux">notre article sur les forecasts faux</a>. Ils cachent aussi les vrais goulots : une étape pleine de deals morts affiche un taux de conversion qui ne veut plus rien dire.</p>

<h2>Les mesurer dans HubSpot</h2>
<p>Trois sources, par ordre de fiabilité :</p>
<ol>
<li><strong><code>hs_time_in_latest_deal_stage</code></strong> : temps passé dans l'étape actuelle, en millisecondes. Divisez par 86 400 000 pour obtenir des jours. C'est la mesure exacte de la stagnation.</li>
<li><strong>Les dates d'entrée par étape</strong> (<code>hs_v2_date_entered_&lt;étape&gt;</code>) : utiles pour reconstituer l'historique et calculer les délais moyens par étape.</li>
<li><strong><code>hs_lastmodifieddate</code></strong> : date de dernière modification, quel que soit le champ. Approximation acceptable quand la première propriété est vide.</li>
</ol>
<p>Dans un rapport HubSpot, filtrez les deals ouverts dont le temps dans l'étape dépasse le seuil, triés par montant décroissant. Vous obtenez la liste à traiter et son poids dans le pipeline.</p>

<h2>Quel seuil choisir</h2>
<p>Le seuil doit dépasser le délai moyen de l'étape, pas d'une moyenne globale. Si vos deals passent en moyenne 6 jours en « Démo réalisée » et 18 jours en « Négociation », le seuil de stagnation n'est pas le même pour les deux. À défaut d'historique, une règle simple : la moitié de votre cycle de vente moyen. Cycle de 30 jours → seuil de 14 jours ; cycle de 90 jours → seuil de 30 à 45 jours.</p>

<h2>Que faire des deals stagnants</h2>
<ul>
<li><strong>Qualifier, pas supprimer.</strong> Chaque deal stagnant reçoit une décision : une prochaine activité datée (il reste, avec sa vraie probabilité) ou un passage en perdu avec une raison (la raison de perte est une donnée précieuse).</li>
<li><strong>Sortir du forecast.</strong> Tant qu'un deal n'a pas de prochaine activité, sa probabilité effective est proche de zéro. Le forecast doit l'ignorer ou le pondérer à part.</li>
<li><strong>Traiter par montant.</strong> Les cinq plus gros deals stagnants concentrent souvent l'essentiel de l'enjeu.</li>
</ul>

<h2>Les empêcher de revenir</h2>
<p>La stagnation est un symptôme de process : pas de prochaine activité obligatoire, pas de revue de pipeline hebdomadaire, pas d'alerte. Trois garde-fous :</p>
<ul>
<li>Une <strong>prochaine activité obligatoire</strong> à chaque changement d'étape.</li>
<li>Une <strong>alerte automatique</strong> au propriétaire dès qu'un deal dépasse le seuil, avec le montant.</li>
<li>Une <strong>revue hebdomadaire</strong> des stagnants, dix minutes, triés par montant.</li>
</ul>
<p>Revold lit les deals stagnants chaque matin dans le brief Ventes, par pipeline, avec un seuil de jours configurable par équipe, et les liste dans l'<a href="/audit-crm-hubspot">audit CRM</a> avec les deals sans montant et sans date de fermeture. Le forecast pondéré de la plateforme est calculé à partir de la date de fermeture et de la probabilité d'étape, ce qui rend l'effet des stagnants visible ; la <a href="/forecast-commercial">méthode</a> détaille les signaux surveillés.</p>
`,
  },

  // ── Mardi 22 septembre 2026 ─────────────────────────────────────────────
  {
    slug: "prevision-des-ventes-5-methodes-comparees",
    title: "Prévision des ventes : 5 méthodes comparées, et celle qui tient en PME",
    description:
      "Historique, pipeline pondéré, engagement des commerciaux, régression, prévision IA : forces, limites et données nécessaires de chaque méthode de prévision des ventes, et la combinaison qui marche pour une PME B2B.",
    category: "Sales Intelligence",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-09-22",
    readTime: "9 min",
    keywords: ["prévision des ventes", "méthodes de prévision des ventes", "forecast commercial", "prévisionnel de ventes", "logiciel prévision des ventes"],
    related: [
      { href: "/forecast-commercial", label: "Forecast commercial : méthode fiable en B2B" },
      { href: "/outils/calculateur-forecast-pondere", label: "Calculateur de forecast pondéré" },
      { href: "/alternative/forecastio", label: "Revold vs Forecastio (forecast IA pour HubSpot)" },
      { href: "/alternative/hubspot-previsions", label: "Revold vs l'outil Prévisions de HubSpot" },
    ],
    faq: [
      { q: "Quelle est la méthode de prévision des ventes la plus fiable ?", a: "Aucune seule. En B2B, la combinaison pipeline pondéré (objectif, recalculable) + engagement des commerciaux (jugement) + comparaison au réalisé chaque mois donne les meilleurs résultats. L'historique sert de garde-fou." },
      { q: "Faut-il une IA pour prévoir les ventes ?", a: "Pas pour une PME avec quelques centaines de deals par an : l'historique est trop court pour qu'un modèle apprenne quelque chose de fiable. Une pondération par étape bien calibrée et des dates de fermeture maintenues font mieux." },
      { q: "Pourquoi ma prévision des ventes est-elle toujours trop optimiste ?", a: "Dates de fermeture repoussées sans être mises à jour, probabilités d'étape déclarées plutôt qu'observées, deals stagnants comptés. Ces trois causes expliquent la majorité des écarts." },
    ],
    content: `
<p><strong>En bref :</strong> il existe cinq façons de prévoir les ventes : par l'historique, par le pipeline pondéré, par l'engagement des commerciaux, par régression statistique et par modèle IA. Pour une PME B2B, la combinaison qui tient est un pipeline pondéré avec des probabilités observées, corrigé par l'engagement des commerciaux et confronté chaque mois au réalisé. Les méthodes statistiques et IA demandent un historique que la plupart des PME n'ont pas.</p>

<h2>1. La prévision historique</h2>
<p><strong>Principe :</strong> le revenu du trimestre prochain ressemblera à celui de l'an dernier, corrigé de la croissance. <strong>Données :</strong> deux ans de chiffre d'affaires mensuel. <strong>Force :</strong> simple, robuste sur une activité stable et saisonnière. <strong>Limite :</strong> aveugle à ce qui se passe dans le pipeline aujourd'hui. Utile comme garde-fou : si le pipeline annonce +60 % par rapport à l'an dernier, quelque chose est faux.</p>

<h2>2. Le pipeline pondéré</h2>
<p><strong>Principe :</strong> chaque deal ouvert compte pour son montant multiplié par la probabilité de son étape, s'il doit se fermer dans la période. <strong>Données :</strong> deals, étapes, dates de fermeture, probabilités observées. <strong>Force :</strong> objectif, recalculable, réactif. <strong>Limite :</strong> exactement aussi bon que les données du CRM. Dates non maintenues, probabilités déclarées, deals stagnants : chacun le fausse. La <a href="/forecast-commercial">méthode détaillée</a> et le <a href="/outils/calculateur-forecast-pondere">calculateur</a> montrent comment le construire.</p>

<h2>3. L'engagement des commerciaux</h2>
<p><strong>Principe :</strong> chaque commercial classe ses deals (engagé, probable, possible) et la somme des engagés fait le forecast. <strong>Données :</strong> le jugement de l'équipe. <strong>Force :</strong> intègre ce que le CRM ne sait pas (le ton du dernier appel, la réorganisation chez le client). <strong>Limite :</strong> subjectif, optimiste par nature, difficile à auditer. Indispensable en complément, dangereux seul.</p>

<h2>4. La régression statistique</h2>
<p><strong>Principe :</strong> un modèle relie les ventes à des variables (saison, nombre de leads, dépense marketing). <strong>Données :</strong> plusieurs années d'historique homogène. <strong>Force :</strong> capture des effets que l'intuition rate. <strong>Limite :</strong> exige un historique long et stable ; un changement de pricing ou de marché le rend caduc. Rare en PME.</p>

<h2>5. La prévision par IA</h2>
<p><strong>Principe :</strong> un modèle entraîné sur l'historique des deals (durées, activités, propriétés) estime la probabilité de chaque deal. <strong>Données :</strong> des milliers de deals fermés, avec leur historique d'activité. <strong>Force :</strong> peut détecter des signaux faibles. <strong>Limite :</strong> opaque (pourquoi ce deal est-il à 37 % ?), et inutilisable sous quelques centaines de deals par an : le modèle apprend le bruit. Des outils comme <a href="/alternative/forecastio">Forecastio</a> la proposent pour HubSpot ; elle a du sens à partir d'un certain volume et d'une discipline de saisie déjà en place.</p>

<h2>La combinaison qui tient en PME</h2>
<ol>
<li><strong>Base : pipeline pondéré</strong> avec des probabilités observées sur six à douze mois, par pipeline, et des dates de fermeture maintenues (ou une propriété de date que l'équipe maintient réellement).</li>
<li><strong>Correction : engagement</strong> sur les dix plus gros deals du trimestre, revus chaque semaine.</li>
<li><strong>Garde-fou : historique</strong> pour repérer une prévision aberrante.</li>
<li><strong>Boucle : comparaison au réalisé</strong> chaque mois. Prévu, signé, puis facturé et encaissé. L'écart entre chaque étape est la seule mesure de la qualité du forecast.</li>
</ol>

<h2>Ce que fait l'outil Prévisions de HubSpot, et ce qu'il ne fait pas</h2>
<p>L'outil natif de HubSpot couvre bien les méthodes 2 et 3 (pondération par étape, catégories d'engagement). Il s'arrête au CRM : il ne compare pas la prévision au facturé, n'accepte pas une autre date que <code>closedate</code> et ne signale pas les stagnants. Le <a href="/alternative/hubspot-previsions">comparatif détaillé</a> liste les différences. Revold calcule le forecast pondéré par échéance avec la propriété de date de votre choix, exclut les stagnants au-delà du seuil, et rapproche la prévision des factures et des paiements dans Pennylane, Stripe, Chargebee, GoCardless ou Sage.</p>
`,
  },

  // ── Jeudi 24 septembre 2026 ─────────────────────────────────────────────
  {
    slug: "date-de-fermeture-hubspot-forecast-faux",
    title: "Date de fermeture HubSpot : la propriété qui fausse votre forecast, et comment la reprendre en main",
    description:
      "La propriété closedate de HubSpot décide dans quelle période un deal est compté. Non maintenue, elle rend le forecast faux. Diagnostic (dates dépassées, glissements), règles à imposer, et alternative : piloter sur une propriété de date personnalisée.",
    category: "Data Quality",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-09-24",
    readTime: "7 min",
    keywords: ["date de fermeture HubSpot", "closedate HubSpot", "close date dépassée", "forecast HubSpot faux", "propriété date de clôture"],
    related: [
      { href: "/forecast-commercial", label: "Forecast commercial : la date de fermeture, maillon faible" },
      { href: "/audit-crm-hubspot", label: "Audit CRM HubSpot" },
      { href: "/glossaire-revops#date-de-fermeture", label: "Définition : date de fermeture (close date)" },
      { href: "/alternative/hubspot-previsions", label: "Prévisions HubSpot vs Revold" },
    ],
    faq: [
      { q: "À quoi sert la date de fermeture dans HubSpot ?", a: "Elle détermine dans quelle période (mois, trimestre) un deal ouvert est compté au forecast, et à la clôture elle date le revenu signé. Toute prévision par période en dépend." },
      { q: "Que faire des deals à date de fermeture dépassée ?", a: "Les traiter comme des deals à qualifier : soit une nouvelle date réaliste avec une prochaine activité, soit un passage en perdu. Tant qu'ils restent ouverts avec une date passée, ils sortent du forecast et faussent l'historique." },
      { q: "Peut-on prévoir sur une autre date que closedate ?", a: "Oui. Si l'équipe maintient réellement une propriété comme « date de signature prévue » ou « date de démarrage », il vaut mieux pondérer le forecast sur celle-ci. Revold permet de choisir la propriété de date par bloc de prévision." },
    ],
    content: `
<p><strong>En bref :</strong> dans HubSpot, la propriété <code>closedate</code> fixe la période dans laquelle un deal est compté au forecast. Elle est remplie automatiquement à la création (souvent à la fin du mois en cours) et rarement mise à jour ensuite. Résultat : des deals comptés dans le mauvais mois, des dates dépassées sur des deals encore ouverts, et un forecast qui glisse. Trois règles de saisie et un choix de propriété de date corrigent l'essentiel.</p>

<h2>Comment closedate fausse le forecast</h2>
<ul>
<li><strong>La date par défaut.</strong> À la création d'un deal, HubSpot propose une date de fermeture (selon la configuration du portail, souvent le dernier jour du mois). Beaucoup de commerciaux la laissent. Le deal est compté dans le mois en cours, quel que soit le cycle réel.</li>
<li><strong>Le glissement silencieux.</strong> Quand la date passe sans signature, le deal reste ouvert avec une date dans le passé. Il disparaît du forecast des périodes futures (il n'est plus « dans » aucune période) tout en restant dans le pipeline.</li>
<li><strong>Le report en cascade.</strong> À chaque revue, la date est repoussée d'un mois. Le deal est compté trois fois dans trois forecasts successifs, sans jamais se signer.</li>
</ul>

<h2>Diagnostic en trois requêtes</h2>
<p>Dans un rapport ou une vue HubSpot, filtrez les deals ouverts :</p>
<ol>
<li><strong>Date de fermeture dépassée</strong> : <code>closedate</code> antérieure à aujourd'hui. Leur nombre et leur montant mesurent la dette de qualification.</li>
<li><strong>Date de fermeture égale au dernier jour du mois de création</strong> : la date par défaut jamais touchée.</li>
<li><strong>Date de fermeture modifiée plus de deux fois</strong> (via l'historique de la propriété) : les deals qui glissent.</li>
</ol>
<p>Ces trois listes figurent dans la checklist de l'<a href="/audit-crm-hubspot">audit CRM HubSpot</a>, points 7 et 9.</p>

<h2>Trois règles de saisie</h2>
<ol>
<li><strong>Pas de date par défaut.</strong> La date de fermeture est saisie par le commercial à la qualification, avec une justification (cycle moyen du segment, date exprimée par le client).</li>
<li><strong>Une date dépassée bloque.</strong> Un deal ouvert à date passée apparaît en tête de la revue de pipeline jusqu'à décision : nouvelle date + prochaine activité, ou perdu.</li>
<li><strong>Un report est une information.</strong> Chaque report est noté avec sa raison ; deux reports déclenchent une revue avec le manager.</li>
</ol>

<h2>Et si ce n'est pas closedate qui pilote ?</h2>
<p>Beaucoup d'entreprises pilotent en réalité sur une autre propriété : « date de signature prévue », « date de démarrage du contrat », « date de décision ». Elle est maintenue parce qu'elle sert à autre chose (planning, facturation), là où closedate n'est qu'un champ du CRM. Dans ce cas, il vaut mieux construire le forecast sur cette propriété plutôt que forcer l'équipe à maintenir deux dates. L'outil Prévisions de HubSpot ne le permet pas ; le <a href="/alternative/hubspot-previsions">comparatif</a> le détaille.</p>

<h2>Ce que fait Revold</h2>
<p>Revold lit les deals à date dépassée et leur répartition par trimestre directement dans HubSpot, signale les dates par défaut et les reports répétés dans l'audit, et permet de choisir, par bloc de prévision, la propriété de date qui fait office de date de fermeture : la propriété est vérifiée dans le CRM (existence, type date, taux de remplissage) avant d'être enregistrée. Le brief Ventes lit ensuite chaque matin les deals prêts à signer par échéance (cette semaine, ce mois-ci, le mois prochain, ce trimestre), d'après la date que vous avez choisie. La <a href="/forecast-commercial">méthode de forecast</a> décrit l'ensemble.</p>
`,
  },

  // ── Mardi 29 septembre 2026 ─────────────────────────────────────────────
  {
    slug: "mrr-arr-net-new-mrr-guide-pme-saas",
    title: "MRR, ARR, Net New MRR : le guide des PME SaaS françaises",
    description:
      "Définitions, formules et pièges du MRR, de l'ARR et du Net New MRR ; ce qui entre et n'entre pas dans le revenu récurrent ; comment le lire avec le CRM ; et les erreurs classiques des comptabilités françaises (TVA, annuel, avoirs).",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-09-29",
    readTime: "8 min",
    keywords: ["MRR", "calcul MRR", "ARR", "Net New MRR", "revenu récurrent mensuel", "métriques SaaS"],
    related: [
      { href: "/outils/calculateur-mrr", label: "Calculateur MRR, ARR et Net New MRR" },
      { href: "/hubspot-stripe", label: "HubSpot et Stripe : MRR lu avec le CRM" },
      { href: "/glossaire-revops#mrr", label: "Définition : MRR" },
      { href: "/glossaire-revops#net-new-mrr", label: "Définition : Net New MRR" },
    ],
    faq: [
      { q: "Comment calculer le MRR ?", a: "Additionner le revenu mensuel de tous les abonnements actifs, hors taxes et hors revenus ponctuels. Un contrat annuel de 12 000 € HT compte pour 1 000 € de MRR." },
      { q: "Le MRR se calcule-t-il HT ou TTC ?", a: "Hors taxes. La TVA n'est pas un revenu. C'est l'erreur la plus fréquente dans les tableaux construits à partir d'exports de facturation français." },
      { q: "Quelle différence entre MRR et chiffre d'affaires mensuel ?", a: "Le chiffre d'affaires inclut les revenus ponctuels (installation, prestations, ventes uniques). Le MRR ne retient que le récurrent. Un mois avec une grosse prestation gonfle le CA sans toucher au MRR." },
    ],
    content: `
<p><strong>En bref :</strong> le MRR (Monthly Recurring Revenue) est la somme du revenu mensuel hors taxes des abonnements actifs, sans les revenus ponctuels. L'ARR est le MRR multiplié par douze. Le Net New MRR d'un mois est ce qui a été gagné (nouveaux clients, expansion) moins ce qui a été perdu (contraction, churn). Ces trois chiffres décrivent la trajectoire d'une entreprise à abonnement mieux que le chiffre d'affaires, à condition de les calculer toujours de la même façon.</p>

<h2>Ce qui entre dans le MRR, et ce qui n'y entre pas</h2>
<ul>
<li><strong>Entre :</strong> les abonnements mensuels ; les abonnements annuels ou pluriannuels divisés par leur nombre de mois ; les options et sièges récurrents ; les remises récurrentes (en négatif).</li>
<li><strong>N'entre pas :</strong> les frais d'installation et d'onboarding ; les prestations ; les ventes uniques ; la TVA ; les périodes d'essai gratuites ; les revenus à l'usage non contractuels (à traiter à part).</li>
</ul>
<p>Un contrat annuel de 12 000 € HT compte pour 1 000 € de MRR chaque mois pendant douze mois, même s'il est facturé en une fois. C'est la différence entre revenu récurrent et facturation : le MRR lisse, la facturation encaisse.</p>

<h2>Les cinq mouvements du MRR</h2>
<p>Chaque mois, le MRR bouge pour cinq raisons. Les suivre séparément est ce qui rend le chiffre lisible :</p>
<ol>
<li><strong>Nouveau MRR</strong> : abonnements de nouveaux clients.</li>
<li><strong>Expansion</strong> : clients existants qui ajoutent des sièges, montent de plan.</li>
<li><strong>Contraction</strong> : clients existants qui réduisent.</li>
<li><strong>Churn</strong> : abonnements résiliés.</li>
<li><strong>Réactivation</strong> : anciens clients qui reviennent (souvent classée avec le nouveau MRR).</li>
</ol>
<p><strong>Net New MRR = nouveau + expansion + réactivation − contraction − churn.</strong> Le <a href="/outils/calculateur-mrr">calculateur MRR</a> fait le calcul à partir de ces cinq montants.</p>

<h2>Les erreurs classiques dans les entreprises françaises</h2>
<ul>
<li><strong>Le MRR TTC.</strong> Les exports Pennylane ou Sage sont souvent TTC par défaut. Un MRR gonflé de 20 % fausse toutes les comparaisons avec les benchmarks (tous en HT).</li>
<li><strong>L'annuel compté le mois de la facture.</strong> Un contrat annuel facturé en janvier crée un pic de « MRR » en janvier puis rien : c'est de la facturation, pas du récurrent.</li>
<li><strong>Les avoirs ignorés.</strong> Un avoir sur un abonnement est une contraction ou un churn, pas une ligne comptable neutre.</li>
<li><strong>Le MRR du CRM.</strong> Le montant du deal HubSpot n'est pas le MRR : il peut être annuel, inclure de l'onboarding, ou n'avoir jamais donné lieu à un abonnement actif. Le MRR se lit dans l'outil d'abonnement (Stripe, Chargebee, GoCardless), puis se rapproche du CRM.</li>
</ul>

<h2>Lire le MRR avec le CRM</h2>
<p>C'est le croisement qui donne la valeur : quel MRR correspond à quel deal signé, quels deals gagnés n'ont pas d'abonnement actif, quels clients ont churné sans que le commercial le sache. Il suppose de reconnaître un même client dans Stripe et dans HubSpot, ce que Revold fait par identifiant légal (SIREN, TVA) et par e-mail de facturation. Le guide <a href="/hubspot-stripe">HubSpot et Stripe</a> décrit la méthode ; les <a href="/kpi-revops">KPI RevOps</a> placent MRR, churn et rétention nette dans l'ensemble des indicateurs de revenu.</p>

<h2>ARR : le même chiffre, une autre échelle</h2>
<p>ARR = MRR × 12. Les entreprises à contrats annuels raisonnent en ARR ; les modèles mensuels en MRR. Une seule précaution : ne jamais additionner un ARR calculé à partir du MRR avec les contrats annuels facturés, c'est compter deux fois. Choisissez une convention et gardez-la ; le <a href="/glossaire-revops#arr">glossaire</a> fixe les définitions utilisées dans Revold.</p>
`,
  },

  // ── Jeudi 1er octobre 2026 ──────────────────────────────────────────────
  {
    slug: "fuite-de-revenus-5-cas-concrets-pme",
    title: "Fuite de revenus : 5 cas concrets en PME, et ce qu'ils ont coûté",
    description:
      "Cinq situations réelles (anonymisées) de revenu signé jamais facturé ou jamais encaissé : deal clôturé sans facture, indexation oubliée, remise non tracée, options non facturées, relances absentes. Comment chacune a été détectée par rapprochement CRM × facturation.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-10-01",
    readTime: "8 min",
    keywords: ["fuite de revenus", "revenue leakage", "deals signés non facturés", "revenus non encaissés", "écart signé facturé"],
    related: [
      { href: "/fuite-de-revenus", label: "Fuite de revenus : la détecter et la colmater" },
      { href: "/outils/calculateur-fuite-de-revenus", label: "Estimateur de fuite de revenus" },
      { href: "/reconciliation-crm-facturation", label: "Réconciliation CRM et facturation" },
      { href: "/hubspot-pennylane", label: "HubSpot et Pennylane : du deal signé à la facture encaissée" },
    ],
    faq: [
      { q: "Qu'est-ce qu'une fuite de revenus ?", a: "Du revenu contractuellement gagné mais jamais facturé ou jamais encaissé, à cause d'une rupture entre ventes, facturation et recouvrement. Ce n'est pas du churn : le client aurait payé." },
      { q: "Comment détecter une fuite de revenus ?", a: "En rapprochant chaque deal signé du CRM avec les factures et les paiements, client par client, puis en calculant l'écart brut par deal. Les cinq cas de cet article ont tous été trouvés ainsi." },
      { q: "Quel montant représente une fuite de revenus ?", a: "Les études publiées citent 1 à 5 % du chiffre d'affaires. Dans les cas décrits ici, chaque fuite représentait entre 0,5 et 3 % du revenu annuel de l'entreprise, invisible tant que les outils n'étaient pas rapprochés." },
    ],
    content: `
<p><strong>En bref :</strong> la fuite de revenus est le revenu gagné que l'entreprise n'encaisse jamais, faute d'un lien entre ce que les ventes signent, ce que la comptabilité facture et ce que la banque reçoit. Voici cinq cas rencontrés chez des PME françaises (secteur et chiffres modifiés pour l'anonymat, ordres de grandeur conservés), tous découverts le jour où le CRM a été rapproché de la facturation.</p>

<h2>Cas 1 : le deal clôturé sans facture</h2>
<p>Éditeur de logiciel, 40 salariés, HubSpot et Pennylane. Un commercial quitte l'entreprise en juin ; ses deals sont réattribués. Trois deals signés en mai, marqués « Gagné » dans HubSpot, n'ont jamais été transmis à la facturation : le processus reposait sur un message Slack du commercial. Montant : 27 000 € HT, découverts en septembre. <strong>Détection :</strong> liste des deals gagnés sans facture rattachée sur les 120 derniers jours. <strong>Correctif :</strong> une facture déclenchée par le passage en « Gagné », et une alerte hebdomadaire sur les deals gagnés sans facture au-delà de 15 jours.</p>

<h2>Cas 2 : l'indexation annuelle jamais appliquée</h2>
<p>Société de services, 25 salariés, contrats annuels avec clause d'indexation de 3 %. La clause est dans le contrat, pas dans l'outil de facturation. Sur 38 contrats renouvelés, 31 ont été refacturés au tarif de l'année précédente pendant deux ans. Montant : environ 2 % du revenu récurrent. <strong>Détection :</strong> comparaison du montant du deal de renouvellement (indexé dans le CRM) avec le montant facturé. <strong>Correctif :</strong> le montant du renouvellement est la source de vérité, la facturation le lit.</p>

<h2>Cas 3 : la remise accordée deux fois</h2>
<p>Distributeur B2B, HubSpot et Sage. Le commercial négocie 10 % de remise et met à jour le montant du deal. La comptabilité, qui reçoit le devis initial par e-mail, applique elle aussi 10 % en facturant. Le client paie 81 % du prix au lieu de 90 %. Montant : 9 % sur une dizaine de deals par trimestre. <strong>Détection :</strong> écart brut deal / facture par deal ; l'écart net sur l'ensemble était faible parce que d'autres deals étaient sur-facturés. <strong>Correctif :</strong> une seule source du prix négocié, et l'écart brut surveillé, jamais l'écart net.</p>

<h2>Cas 4 : les options jamais facturées</h2>
<p>SaaS, Stripe pour les abonnements, HubSpot pour les ventes. Les sièges supplémentaires activés par le support (« on vous ajoute deux utilisateurs, on régularise ») n'étaient régularisés qu'une fois sur trois. Montant : environ 1 % du MRR, mais en croissance chaque mois. <strong>Détection :</strong> nombre de sièges actifs dans le produit comparé au nombre de sièges facturés dans Stripe, par client. <strong>Correctif :</strong> une alerte de contraction inversée : quand l'usage dépasse l'abonnement, le compte remonte au commercial.</p>

<h2>Cas 5 : les factures émises jamais relancées</h2>
<p>Cabinet de conseil, Pennylane. Les factures sont émises correctement ; les relances dépendent d'une personne, en congé ou débordée. Le délai moyen de paiement (DSO) est passé de 38 à 61 jours en six mois sans que personne ne le voie, et trois factures de plus de 10 000 € avaient plus de 120 jours. Ce n'est pas du revenu perdu, c'est de la trésorerie immobilisée qui finit parfois en perte. <strong>Détection :</strong> factures échues avec montant dû, triées par montant et par client. <strong>Correctif :</strong> relances priorisées par montant, lues chaque lundi, et DSO suivi comme un KPI.</p>

<h2>Ce que les cinq cas ont en commun</h2>
<ul>
<li>La fuite se loge <strong>entre deux outils</strong> ou <strong>entre deux équipes</strong>, jamais dans un seul.</li>
<li>Elle est <strong>invisible en net</strong> : sur-facturations et sous-facturations se compensent dans les totaux.</li>
<li>Elle est <strong>mécanique à détecter</strong> dès que les clients sont reconnus de la même façon dans chaque outil, ce qui en France passe par le SIREN.</li>
</ul>
<p>Pour estimer votre propre ordre de grandeur à partir du signé, du facturé et de l'encaissé, utilisez l'<a href="/outils/calculateur-fuite-de-revenus">estimateur de fuite de revenus</a>. Pour la mesurer deal par deal, la <a href="/reconciliation-crm-facturation">réconciliation CRM et facturation</a> décrit la méthode que Revold applique entre HubSpot et Pennylane, Stripe, Chargebee, GoCardless ou Sage.</p>
`,
  },

  // ── Mardi 6 octobre 2026 ────────────────────────────────────────────────
  {
    slug: "enrichir-crm-siren-api-sirene",
    title: "Enrichir son CRM avec le SIREN : pourquoi, comment, et ce que permet l'API Sirene",
    description:
      "Le SIREN est la clé qui permet de reconnaître une même entreprise dans le CRM, la facturation et la banque. Comment l'obtenir automatiquement via l'API Sirene, le stocker dans HubSpot, détecter les doublons et reconstituer les groupes.",
    category: "Data Quality",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-10-06",
    readTime: "8 min",
    keywords: ["SIREN CRM", "enrichir CRM SIREN", "API Sirene", "SIRET HubSpot", "résolution d'entités", "doublons entreprises HubSpot"],
    related: [
      { href: "/reconciliation-crm-facturation", label: "Réconciliation CRM et facturation" },
      { href: "/audit-crm-hubspot", label: "Audit CRM HubSpot : doublons et complétude" },
      { href: "/glossaire-revops#siren", label: "Définition : SIREN / SIRET" },
      { href: "/glossaire-revops#resolution-d-entites", label: "Définition : résolution d'entités" },
    ],
    faq: [
      { q: "Pourquoi mettre le SIREN dans le CRM ?", a: "Parce que c'est le seul identifiant stable et partagé par tous les outils : le CRM nomme les entreprises comme les commerciaux les saisissent, la facturation comme la comptabilité les enregistre. Le SIREN permet de les rapprocher sans ambiguïté." },
      { q: "Qu'est-ce que l'API Sirene ?", a: "L'API publique de l'INSEE qui expose le répertoire des entreprises françaises : SIREN, SIRET, raison sociale, adresse, code NAF, effectifs, date de création. Elle permet de retrouver le SIREN d'une entreprise à partir de son nom et de son adresse." },
      { q: "SIREN ou SIRET dans le CRM ?", a: "Les deux si possible : le SIREN identifie l'entité juridique (pour rapprocher et consolider), le SIRET identifie l'établissement (pour l'adresse de facturation et de livraison)." },
    ],
    content: `
<p><strong>En bref :</strong> le SIREN (9 chiffres) identifie une entreprise française de façon unique ; le SIRET (14 chiffres) identifie chacun de ses établissements. Stockés dans le CRM, ils permettent de reconnaître un même client dans HubSpot, Pennylane, Stripe ou Sage, de fusionner les doublons et de reconstituer les groupes (maison mère, filiales). L'API Sirene de l'INSEE permet de les retrouver automatiquement à partir du nom et de l'adresse.</p>

<h2>Le problème que le SIREN résout</h2>
<p>« Acme », « ACME SAS », « Acme Group », « Acme – siège » : quatre entreprises dans le CRM, un seul client en comptabilité. Sans identifiant commun, rapprocher le signé et le facturé demande un travail manuel que personne ne fait. Avec le SIREN, le rapprochement devient une jointure. C'est le préalable de toute <a href="/reconciliation-crm-facturation">réconciliation CRM × facturation</a>, et la raison pour laquelle les outils américains de Revenue Intelligence, qui rapprochent par nom ou par domaine, fonctionnent mal sur le marché français.</p>

<h2>Où le SIREN existe déjà</h2>
<ul>
<li><strong>En comptabilité :</strong> Pennylane, Sage et la plupart des outils de facturation français stockent le SIREN ou le SIRET des clients, parce que la facture l'exige.</li>
<li><strong>Chez le client :</strong> sur ses factures, ses bons de commande, ses mentions légales.</li>
<li><strong>Dans le répertoire Sirene :</strong> pour toute entreprise immatriculée en France, avec ses établissements, son code NAF, sa tranche d'effectifs et sa date de création.</li>
</ul>
<p>Il manque presque toujours dans le CRM, où les entreprises sont créées à la volée par les commerciaux ou par les formulaires.</p>

<h2>L'obtenir automatiquement avec l'API Sirene</h2>
<p>L'API Sirene (INSEE) accepte une recherche par raison sociale, éventuellement filtrée par code postal ou par commune, et renvoie les entreprises correspondantes avec leur SIREN, leur SIRET de siège, leur état (active ou cessée), leur code NAF et leurs effectifs. La difficulté n'est pas l'appel, c'est le choix du bon résultat :</p>
<ol>
<li><strong>Normaliser le nom</strong> : retirer la forme juridique (SAS, SARL), les accents, la ponctuation.</li>
<li><strong>Chercher avec l'adresse</strong> quand elle est connue : le code postal élimine la plupart des homonymes.</li>
<li><strong>Scorer les candidats</strong> : similarité du nom, correspondance de la ville, entreprise active, siège plutôt qu'établissement secondaire.</li>
<li><strong>Valider les cas ambigus</strong> à la main : un candidat proposé, une personne qui confirme, jamais une écriture automatique sur un doute.</li>
</ol>
<p>Une fois le SIREN trouvé, le SIRET du siège, le numéro de TVA intracommunautaire (dérivé du SIREN), les effectifs et le code NAF viennent avec, et enrichissent la fiche sans saisie.</p>

<h2>Le stocker dans HubSpot</h2>
<p>Trois propriétés d'entreprise suffisent : <code>siren</code>, <code>siret</code>, <code>numero_tva</code>. Rendez le SIREN unique (HubSpot n'impose pas l'unicité, mais un rapport « SIREN en double » suffit à détecter les doublons). Ajoutez les propriétés d'enrichissement (effectifs, code NAF, date de création) si vous segmentez dessus. Le <a href="/audit-crm-hubspot">guide d'audit CRM</a> place « entreprises sans SIREN » en point 5 de la checklist : c'est l'indicateur de complétude qui conditionne tout le reste.</p>

<h2>Ce que le SIREN débloque ensuite</h2>
<ul>
<li><strong>Doublons</strong> : deux fiches avec le même SIREN sont un doublon certain, à fusionner.</li>
<li><strong>Hiérarchies</strong> : les établissements d'un même SIREN et les liens capitalistiques permettent de reconstituer les groupes, et de consolider le revenu par groupe.</li>
<li><strong>Réconciliation</strong> : le deal HubSpot et la facture Pennylane parlent enfin du même client ; l'écart signé / facturé devient mesurable.</li>
<li><strong>Segmentation</strong> : effectifs et code NAF issus de Sirene, homogènes et à jour, plutôt que des champs saisis à la main.</li>
</ul>

<h2>Comment Revold procède</h2>
<p>Revold enrichit les entreprises du CRM via l'API Sirene (identité, SIRET, TVA, effectifs, chiffre d'affaires quand il est publié), propose les candidats ambigus à la validation, détecte les doublons et les hiérarchies par SIREN, et pousse les valeurs validées dans HubSpot. Rien ne se lance avant le clic sur le bouton d'activation, et aucune écriture n'est faite sans validation. C'est ce socle qui permet ensuite la <a href="/reconciliation-crm-facturation">réconciliation avec la facturation</a> et le calcul de la <a href="/fuite-de-revenus">fuite de revenus</a>.</p>
`,
  },

  // ── Jeudi 8 octobre 2026 ────────────────────────────────────────────────
  {
    slug: "nrr-retention-nette-calcul-et-leviers",
    title: "NRR (rétention nette) : la métrique que les investisseurs lisent en premier, et comment la calculer",
    description:
      "La rétention nette (Net Revenue Retention) mesure ce qu'une cohorte de clients rapporte un an plus tard, expansion incluse. Formule, ordres de grandeur, différence avec le churn et la rétention brute, et les leviers pour la faire passer au-dessus de 100 %.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-10-08",
    readTime: "7 min",
    keywords: ["NRR", "net revenue retention", "rétention nette", "calcul NRR", "rétention nette des revenus", "GRR"],
    related: [
      { href: "/outils/calculateur-churn", label: "Calculateur de churn et de rétention nette" },
      { href: "/blog/bon-taux-de-churn-b2b-benchmarks-2026", label: "Quel est un bon taux de churn en B2B ?" },
      { href: "/glossaire-revops#nrr", label: "Définition : rétention nette (NRR)" },
      { href: "/kpi-revops", label: "KPI RevOps : les 20 indicateurs" },
    ],
    faq: [
      { q: "Comment calculer la NRR ?", a: "(MRR d'une cohorte de clients en début de période + expansion − contraction − churn) ÷ MRR de cette cohorte en début de période, généralement sur douze mois. Les nouveaux clients acquis pendant la période n'entrent pas dans le calcul." },
      { q: "Quelle est une bonne NRR ?", a: "Au-dessus de 100 %, la base existante croît sans nouveaux clients. Les ordres de grandeur cités pour le SaaS B2B vont de 90 à 110 % pour le marché PME et au-delà de 110 % pour les grands comptes avec forte expansion." },
      { q: "Quelle différence entre NRR et GRR ?", a: "La rétention brute (GRR) ne compte que les pertes (churn et contraction) et plafonne à 100 %. La NRR ajoute l'expansion et peut dépasser 100 %. La GRR mesure la solidité, la NRR mesure la croissance de la base." },
    ],
    content: `
<p><strong>En bref :</strong> la rétention nette des revenus (NRR) répond à une question simple : les clients que j'avais il y a un an me rapportent-ils plus ou moins aujourd'hui ? Formule : (MRR initial de la cohorte + expansion − contraction − churn) ÷ MRR initial. Au-dessus de 100 %, l'entreprise croît même sans signer un seul nouveau client. C'est pour cela que les investisseurs la lisent avant le chiffre d'affaires.</p>

<h2>La formule, pas à pas</h2>
<ol>
<li>Prenez tous les clients actifs au 1er janvier et leur MRR total à cette date : c'est la cohorte et son MRR initial.</li>
<li>Douze mois plus tard, mesurez le MRR de <em>ces mêmes clients</em> : ceux qui ont grandi (expansion), réduit (contraction), résilié (churn, MRR à zéro).</li>
<li>NRR = MRR de la cohorte au 31 décembre ÷ MRR de la cohorte au 1er janvier.</li>
</ol>
<p>Les clients signés pendant l'année ne comptent pas : ils appartiennent à la cohorte suivante. Le <a href="/outils/calculateur-churn">calculateur de churn</a> donne la NRR à partir de quatre montants.</p>

<h2>NRR, GRR et churn : trois lectures d'une même base</h2>
<ul>
<li><strong>Churn revenu</strong> : MRR perdu ÷ MRR initial. Une perte seule.</li>
<li><strong>Rétention brute (GRR)</strong> : (MRR initial − churn − contraction) ÷ MRR initial. Ce qui reste, sans l'expansion. Plafonne à 100 %.</li>
<li><strong>Rétention nette (NRR)</strong> : la même chose plus l'expansion. Peut dépasser 100 %.</li>
</ul>
<p>Une entreprise peut avoir une NRR de 105 % avec une GRR de 85 % : elle perd beaucoup mais les survivants achètent beaucoup plus. C'est une trajectoire fragile. Une GRR de 95 % avec une NRR de 103 % est plus solide. Lisez toujours les deux ; notre article sur le <a href="/blog/bon-taux-de-churn-b2b-benchmarks-2026">bon taux de churn</a> donne les ordres de grandeur.</p>

<h2>Ordres de grandeur</h2>
<p>Les chiffres publiés par les investisseurs SaaS donnent des repères : NRR de 90 à 100 % courante sur le marché PME, 100 à 110 % pour une entreprise avec une offre d'expansion structurée (sièges, modules, usage), au-delà de 120 % pour les meilleurs éditeurs grands comptes. Pour une PME française qui vend à des PME, dépasser 100 % est déjà un signe de produit installé.</p>

<h2>Les leviers, par ordre d'effet</h2>
<ol>
<li><strong>Réduire la contraction avant le churn.</strong> Un client qui réduit ses sièges est un client qui va partir. La contraction est le signal précoce ; elle se lit dans l'outil d'abonnement, pas dans le CRM.</li>
<li><strong>Structurer l'expansion.</strong> Sièges, modules, paliers d'usage : sans mécanisme d'expansion dans l'offre, la NRR ne peut pas dépasser 100 %.</li>
<li><strong>Attribuer les comptes.</strong> Chaque compte de la cohorte a un propriétaire, qui voit son MRR, ses tickets et ses paiements sur une même ligne.</li>
<li><strong>Facturer ce qui est utilisé.</strong> Les options activées et jamais facturées sont une expansion perdue : c'est l'un des cinq cas de notre article sur la <a href="/fuite-de-revenus">fuite de revenus</a>.</li>
</ol>

<h2>Calculer la NRR sans tableur</h2>
<p>La NRR demande de suivre une cohorte fixe dans le temps, ce qu'un export mensuel ne permet pas. Il faut l'historique des abonnements par client (Stripe, Chargebee, GoCardless, Pennylane), rapproché du CRM pour attribuer les comptes et lire les signaux. Revold lit ces abonnements, rapproche les clients par identifiant légal, calcule MRR, churn, GRR et NRR par période, et déclenche les alertes de contraction et de paiement échoué vers le propriétaire du compte. L'ensemble des définitions est dans le <a href="/glossaire-revops">glossaire RevOps</a>.</p>
`,
  },
];
