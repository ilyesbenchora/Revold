import type { BlogArticle } from "./data";

/** Calendrier éditorial — novembre 2026 (mardi et jeudi). Publication automatique à la date (published.ts). */

const AUTHOR = "Ilyes Benchora";
const ROLE = "Expert RevOps";

export const articlesNovember2026: BlogArticle[] = [
  {
    slug: "revops-en-pme-par-ou-commencer-sans-recruter",
    title: "RevOps en PME : par où commencer, sans recruter",
    description:
      "Mettre en place le RevOps dans une PME de 10 à 200 salariés sans ouvrir de poste : les trois chantiers dans l'ordre (données, indicateurs, rituels), ce qu'un outil prend en charge, ce qui reste à un humain, et les erreurs des six premiers mois.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-11-03",
    readTime: "8 min",
    keywords: ["RevOps PME", "mettre en place le RevOps", "revenue operations PME", "RevOps sans recruter", "démarrer le RevOps"],
    related: [
      { href: "/plateforme-revops", label: "Plateforme RevOps : définition et critères" },
      { href: "/pilotage-revops", label: "Pilotage RevOps : méthode en 5 étapes" },
      { href: "/revops-vs-sales-ops", label: "RevOps vs Sales Ops" },
      { href: "/blog/qu-est-ce-que-le-revops-guide-complet-2026", label: "Qu'est-ce que le RevOps ? Guide complet" },
    ],
    faq: [
      { q: "Faut-il recruter un RevOps pour commencer ?", a: "Non. Les trois premiers chantiers (rapprocher les données, fixer les indicateurs, installer les rituels) peuvent être portés par un dirigeant ou un responsable commercial avec une plateforme qui fait le travail de réconciliation. Le poste vient quand le volume l'exige." },
      { q: "Par quoi commencer en RevOps ?", a: "Par les données : reconnaître un même client dans le CRM et la facturation. Sans cela, aucun indicateur partagé n'est possible. Ensuite les indicateurs, puis les rituels." },
      { q: "Combien de temps pour voir un résultat ?", a: "Le premier écart signé / facturé se lit le jour de la réconciliation. Le pilotage régulier (brief, récap hebdomadaire) produit ses effets sur le forecast et le recouvrement en un à deux trimestres." },
    ],
    content: `
<p><strong>En bref :</strong> le RevOps n'est pas un poste, c'est une façon de piloter le revenu comme un seul processus, du lead à l'encaissement. Une PME peut le mettre en place sans recruter, en trois chantiers dans cet ordre : rapprocher les données des outils, fixer une dizaine d'indicateurs partagés, installer des rituels courts. Une plateforme porte le premier chantier et alimente les deux autres ; le jugement reste humain.</p>

<h2>Chantier 1 : les données (semaine 1)</h2>
<p>Tout commence par une question : « ce client dans HubSpot est-il le même que ce client dans Pennylane ? » Tant que la réponse demande un humain, rien d'autre ne tient. Le chantier consiste à connecter les outils en lecture seule, enrichir les entreprises avec leur SIREN, et rapprocher automatiquement CRM, facturation et abonnements. La <a href="/reconciliation-crm-facturation">réconciliation CRM et facturation</a> décrit la méthode ; le résultat immédiat est l'écart signé / facturé, souvent la première surprise.</p>

<h2>Chantier 2 : les indicateurs (semaine 2)</h2>
<p>Pas plus de douze pour la direction, trois à cinq par équipe, chacun avec une formule écrite et une source. La liste des <a href="/kpi-revops">KPI RevOps</a> donne le catalogue ; pour une PME, le noyau tient en huit chiffres : pipeline pondéré, forecast du trimestre, taux de conversion par étape, cycle de vente, signé, facturé, encaissé, MRR ou churn selon le modèle. Chaque indicateur reçoit un objectif ou un seuil d'alerte.</p>

<h2>Chantier 3 : les rituels (semaine 3 et suivantes)</h2>
<ul>
<li><strong>Quotidien, 3 minutes</strong> : les exceptions (alertes en tension, factures en retard, deals prêts à signer). Un brief lu ou écouté, pas une réunion.</li>
<li><strong>Hebdomadaire, 20 minutes</strong> : la revue de pipeline (stagnants, dates dépassées, forecast) et la liste des relances.</li>
<li><strong>Mensuel, 45 minutes</strong> : le récap par équipe comparé au mois précédent, et une décision par écart.</li>
</ul>
<p>La <a href="/pilotage-revops">méthode de pilotage RevOps</a> détaille ces rituels ; l'important est leur régularité, pas leur durée.</p>

<h2>Ce que l'outil fait, ce que l'humain garde</h2>
<p>L'outil rapproche, calcule, surveille les seuils, rédige les briefs et propose des actions. L'humain choisit les indicateurs, fixe les seuils, valide les actions et décide. La frontière est nette : aucun chiffre n'est produit par une IA, aucune écriture dans les outils sans validation. C'est ce partage qui permet à une PME de tenir le RevOps sans poste dédié.</p>

<h2>Les erreurs des six premiers mois</h2>
<ol>
<li><strong>Commencer par le tableau de bord.</strong> Un tableau sur des données non rapprochées produit des chiffres que personne ne croit.</li>
<li><strong>Trop d'indicateurs.</strong> Le vingtième KPI enterre les dix premiers.</li>
<li><strong>Pas de propriétaire par alerte.</strong> Une alerte sans destinataire nommé est ignorée dès la deuxième semaine.</li>
<li><strong>Sauter le rituel une fois.</strong> Le rituel manqué devient la norme.</li>
</ol>

<h2>Quand ouvrir le poste</h2>
<p>Quand plusieurs pipelines, plusieurs pays ou plusieurs offres exigent des règles d'attribution, de territoires et de commissionnement que l'outil ne tranche pas. Avant cela, l'article <a href="/revops-vs-sales-ops">RevOps vs Sales Ops</a> aide à décider si le premier poste doit être un Sales Ops ou un RevOps. Une <a href="/plateforme-revops">plateforme RevOps</a> comme Revold porte les trois chantiers pour les PME sur HubSpot, Pennylane, Stripe, Chargebee, GoCardless ou Sage.</p>
`,
  },
  {
    slug: "cout-par-lead-par-canal-relie-au-revenu-signe",
    title: "Coût par lead : le calculer par canal, et le relier au revenu réellement signé",
    description:
      "Le coût par lead (CPL) ne dit rien tant qu'il n'est pas relié au revenu signé par canal. Formules (CPL, coût par MQL, coût par opportunité, CAC), données nécessaires (régies, CRM, facturation) et lecture par canal.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-11-05",
    readTime: "7 min",
    keywords: ["coût par lead", "CPL", "coût par lead B2B", "coût d'acquisition par canal", "ROI marketing B2B", "coût par MQL"],
    related: [
      { href: "/glossaire-revops#cout-par-lead", label: "Définition : coût par lead" },
      { href: "/glossaire-revops#cac", label: "Définition : CAC" },
      { href: "/kpi-revops", label: "KPI RevOps : acquisition" },
      { href: "/equipes/marketing", label: "Revold pour le marketing" },
    ],
    faq: [
      { q: "Comment calculer le coût par lead ?", a: "Dépense du canal sur la période ÷ leads générés par ce canal sur la même période. Le même calcul se fait ensuite par MQL, par opportunité et par client signé, ce qui donne le coût d'acquisition réel." },
      { q: "Quel est un bon coût par lead en B2B ?", a: "Il n'y a pas de bon CPL en soi : un lead à 300 € qui signe 20 000 € vaut mieux qu'un lead à 30 € qui ne signe jamais. Le bon indicateur est le coût par client signé rapporté au panier moyen, par canal." },
      { q: "Quelles données faut-il pour relier le CPL au revenu ?", a: "La dépense par canal (régies publicitaires), la source de chaque contact et son passage MQL / SQL / opportunité (CRM), et le revenu signé puis facturé des clients issus de ce canal (CRM × facturation)." },
    ],
    content: `
<p><strong>En bref :</strong> le coût par lead est la dépense d'un canal divisée par le nombre de leads qu'il génère. Seul, il pousse vers les canaux qui produisent des leads bon marché et sans valeur. Relié au revenu signé (et facturé) par canal, il devient l'indicateur qui arbitre le budget marketing. Le calcul demande trois sources rapprochées : la régie, le CRM et la facturation.</p>

<h2>La chaîne de coûts, par canal</h2>
<ol>
<li><strong>Coût par lead</strong> = dépense du canal ÷ leads du canal.</li>
<li><strong>Coût par MQL</strong> = dépense ÷ leads passés MQL.</li>
<li><strong>Coût par opportunité</strong> = dépense ÷ deals créés depuis ce canal.</li>
<li><strong>Coût d'acquisition (CAC)</strong> = (dépense + coût commercial attribuable) ÷ clients signés.</li>
<li><strong>Retour</strong> = revenu signé (puis facturé) des clients du canal ÷ dépense du canal.</li>
</ol>
<p>Chaque étape de la chaîne élimine des canaux qui paraissaient efficaces à l'étape précédente. Un canal à 25 € le lead et 0 client signé a un CAC infini.</p>

<h2>Les données, et où elles vivent</h2>
<ul>
<li><strong>La dépense</strong> : Google Ads, Meta Ads, LinkedIn Ads, plus les coûts fixes (salons, contenu) répartis par période.</li>
<li><strong>La source du contact</strong> : dans HubSpot, la source d'origine et les dates d'entrée dans les étapes du cycle de vie.</li>
<li><strong>Le revenu</strong> : les deals signés attribués aux contacts du canal, puis les factures correspondantes. C'est ici que la plupart des calculs s'arrêtent, faute de rapprochement entre CRM et facturation.</li>
</ul>

<h2>Trois pièges d'attribution</h2>
<ul>
<li><strong>La source « directe »</strong> absorbe tout ce qui n'est pas tracé. Si elle dépasse 30 % des leads, le tracking est à revoir avant tout calcul.</li>
<li><strong>Le premier contact contre le dernier</strong> : un client vu en salon, revenu par une recherche Google, signé après un e-mail. Choisissez une règle (premier contact pour l'acquisition, dernier pour la conversion) et gardez-la.</li>
<li><strong>Le délai</strong> : un canal jugé sur les leads du mois n'a pas encore signé. Lisez le revenu par cohorte de leads, à trois et six mois.</li>
</ul>

<h2>Lire le résultat</h2>
<p>Un tableau par canal, quatre colonnes : dépense, leads, clients signés, revenu facturé. Les canaux se classent d'eux-mêmes. Le canal au CPL le plus bas est rarement celui au meilleur retour, et c'est précisément ce que le CPL seul cachait.</p>

<h2>Ce que fait Revold</h2>
<p>Revold lit les dépenses des régies connectées, les sources et dates du cycle de vie des contacts HubSpot, et rapproche les clients signés de leurs factures Pennylane, Stripe, Chargebee, GoCardless ou Sage. Le brief Marketing donne chaque matin les nouveaux contacts par source, les MQL et les passages en SQL ; le rapprochement donne le revenu réellement facturé par canal. Les définitions du <a href="/glossaire-revops#cout-par-lead">coût par lead</a> et du <a href="/glossaire-revops#cac">CAC</a> sont dans le glossaire, et la page <a href="/equipes/marketing">Revold pour le marketing</a> détaille les indicateurs d'acquisition.</p>
`,
  },
  {
    slug: "doublons-hubspot-detecter-fusionner-entreprises",
    title: "Doublons HubSpot : détecter et fusionner les entreprises en double, par SIREN",
    description:
      "Pourquoi les doublons d'entreprises apparaissent dans HubSpot, ce que fait l'outil natif de gestion des doublons, ses limites, et la méthode par identifiant légal (SIREN, TVA) qui détecte les doublons certains et les hiérarchies de comptes.",
    category: "Data Quality",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-11-10",
    readTime: "7 min",
    keywords: ["doublons HubSpot", "fusionner entreprises HubSpot", "gestion des doublons HubSpot", "dédoublonnage CRM", "nettoyer HubSpot"],
    related: [
      { href: "/audit-crm-hubspot", label: "Audit CRM HubSpot : la checklist" },
      { href: "/blog/enrichir-crm-siren-api-sirene", label: "Enrichir son CRM avec le SIREN" },
      { href: "/glossaire-revops#doublon", label: "Définition : doublon CRM" },
      { href: "/produits/resolution-entites", label: "Résolution d'entités par SIREN, SIRET et TVA" },
    ],
    faq: [
      { q: "Comment HubSpot détecte-t-il les doublons ?", a: "L'outil natif « Gérer les doublons » compare les noms, domaines et e-mails et propose des paires probables à fusionner manuellement. Il ne connaît pas les identifiants légaux et ne voit pas les doublons dont les noms diffèrent trop." },
      { q: "Pourquoi utiliser le SIREN pour dédoublonner ?", a: "Deux fiches avec le même SIREN sont la même entité juridique, sans ambiguïté. Le nom, l'adresse ou le domaine peuvent diverger ; le SIREN non. Il distingue aussi une filiale d'un doublon." },
      { q: "Que se passe-t-il lors d'une fusion ?", a: "HubSpot conserve une fiche principale et y rattache contacts, deals et activités de la fiche secondaire. Le choix de la fiche principale et la propriété conservée pour chaque champ doivent être validés avant la fusion : une fusion ne se défait pas." },
    ],
    content: `
<p><strong>En bref :</strong> les doublons d'entreprises dans HubSpot viennent des imports, des formulaires et de la saisie manuelle par plusieurs commerciaux. L'outil natif de gestion des doublons compare noms et domaines ; il rate les doublons aux noms différents et confond parfois filiales et doublons. La méthode fiable passe par l'identifiant légal : deux fiches avec le même SIREN sont un doublon certain ; deux SIREN différents avec un lien capitalistique sont une hiérarchie, pas un doublon.</p>

<h2>D'où viennent les doublons</h2>
<ul>
<li><strong>Les imports</strong> : une liste de salon importée sans rapprochement crée une fiche par ligne.</li>
<li><strong>Les formulaires</strong> : un contact saisit « Acme » quand la fiche existante s'appelle « ACME SAS ».</li>
<li><strong>La saisie manuelle</strong> : deux commerciaux, deux prospections, deux fiches.</li>
<li><strong>Les intégrations</strong> : un outil tiers crée des entreprises sans vérifier l'existant.</li>
</ul>
<p>Le coût n'est pas cosmétique : deals répartis sur deux fiches, historique éclaté, revenu du client sous-estimé, relances envoyées deux fois.</p>

<h2>Ce que fait l'outil natif, et ses limites</h2>
<p>« Gérer les doublons » dans HubSpot propose des paires d'entreprises aux noms ou domaines proches, à fusionner à la main. Trois limites :</p>
<ul>
<li>Il ne trouve pas « Acme » et « Groupe A.C.M.E. Industries » : les noms sont trop différents.</li>
<li>Il peut proposer de fusionner une maison mère et sa filiale qui partagent un domaine.</li>
<li>Il ne dit pas laquelle des deux fiches est la bonne, ni quelle valeur conserver par champ.</li>
</ul>

<h2>La méthode par SIREN</h2>
<ol>
<li><strong>Enrichir</strong> chaque entreprise avec son SIREN via l'API Sirene (méthode dans l'article <a href="/blog/enrichir-crm-siren-api-sirene">Enrichir son CRM avec le SIREN</a>).</li>
<li><strong>Grouper</strong> les fiches par SIREN : chaque groupe de deux fiches ou plus est un doublon certain.</li>
<li><strong>Distinguer</strong> les SIREN différents liés par un lien capitalistique ou un domaine commun : c'est une hiérarchie de comptes (maison mère, filiales), à modéliser, pas à fusionner.</li>
<li><strong>Choisir</strong> la fiche principale (la plus ancienne, ou celle avec le plus de deals) et la valeur à garder par champ.</li>
<li><strong>Fusionner</strong> après validation, jamais automatiquement : une fusion est irréversible.</li>
</ol>

<h2>Empêcher le retour des doublons</h2>
<ul>
<li>Rendre le SIREN obligatoire à la création d'une entreprise, ou l'enrichir automatiquement dans l'heure.</li>
<li>Rapprocher les imports par SIREN avant de créer des fiches.</li>
<li>Suivre « entreprises sans SIREN » et « SIREN en double » comme des indicateurs de qualité, avec un seuil d'alerte.</li>
</ul>

<h2>Ce que fait Revold</h2>
<p>Revold enrichit les entreprises HubSpot par SIREN, SIRET et TVA, détecte les doublons certains et les hiérarchies de comptes, propose la fiche principale et les valeurs à conserver, et applique la fusion dans HubSpot après validation. Le score de qualité (complétude, doublons, contacts sans entreprise) est suivi dans l'<a href="/audit-crm-hubspot">audit CRM</a> ; la page <a href="/produits/resolution-entites">Résolution d'entités</a> décrit le moteur.</p>
`,
  },
  {
    slug: "contacts-sans-entreprise-hubspot-probleme-de-revenu",
    title: "Contacts sans entreprise dans HubSpot : pourquoi c'est un problème de revenu, et comment l'associer en masse",
    description:
      "Un contact sans entreprise associée dans HubSpot est invisible dans le pipeline, le forecast et la réconciliation. D'où viennent ces contacts, comment les mesurer, et comment les associer en masse à la bonne entreprise (domaine, SIREN, règles validées).",
    category: "Data Quality",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-11-12",
    readTime: "6 min",
    keywords: ["contacts sans entreprise HubSpot", "associer contact entreprise HubSpot", "association en masse HubSpot", "qualité des données HubSpot", "contacts orphelins CRM"],
    related: [
      { href: "/audit-crm-hubspot", label: "Audit CRM HubSpot" },
      { href: "/blog/doublons-hubspot-detecter-fusionner-entreprises", label: "Doublons HubSpot : détecter et fusionner" },
      { href: "/produits/resolution-entites", label: "Résolution d'entités" },
      { href: "/glossaire-revops#completude", label: "Définition : taux de complétude" },
    ],
    faq: [
      { q: "Pourquoi HubSpot laisse-t-il des contacts sans entreprise ?", a: "L'association automatique repose sur le domaine de l'e-mail. Un contact avec une adresse gmail, un domaine inconnu ou une entreprise créée après lui reste orphelin. Les imports et formulaires en créent beaucoup." },
      { q: "Quel est le problème d'un contact sans entreprise ?", a: "Ses deals ne remontent pas sur le compte, le revenu du client est sous-estimé, le marketing par compte (ABM) ne le voit pas, et la réconciliation avec la facturation ne peut pas le rattacher à une facture." },
      { q: "Peut-on associer les contacts en masse ?", a: "Oui, en trois passes : par domaine d'e-mail, par SIREN de l'entreprise mentionnée, puis par règles validées à la main pour le reste. HubSpot ne propose pas nativement l'association en masse sur des règles ; Revold le fait après validation." },
    ],
    content: `
<p><strong>En bref :</strong> un contact sans entreprise associée dans HubSpot est un contact qui n'existe pas pour le pilotage du revenu : ses deals ne se consolident pas sur le compte, la réconciliation avec la facturation ne peut pas le rattacher, et le marketing par compte l'ignore. Ces contacts représentent couramment 10 à 30 % d'un portail non entretenu. Ils s'associent en masse en trois passes : domaine, SIREN, règles validées.</p>

<h2>D'où viennent les contacts orphelins</h2>
<ul>
<li><strong>Adresses génériques</strong> (gmail, outlook) que l'association par domaine ne peut pas rattacher.</li>
<li><strong>Entreprise créée après le contact</strong> : HubSpot n'associe pas rétroactivement.</li>
<li><strong>Imports</strong> de listes sans colonne entreprise, ou avec un nom que HubSpot ne reconnaît pas.</li>
<li><strong>Domaine inconnu</strong> : l'entreprise existe sous un autre domaine (groupe, filiale, ancienne marque).</li>
</ul>

<h2>Pourquoi c'est un problème de revenu</h2>
<p>Le revenu se pilote par compte, pas par personne. Un deal porté par un contact orphelin n'apparaît pas dans le revenu du client, n'est pas rapproché de sa facture, et n'entre pas dans les hiérarchies de groupe. Multipliez par 20 % des contacts et le chiffre par client est faux partout : rétention, panier moyen, écart signé / facturé. Le taux de contacts sans entreprise est pour cette raison le point 4 de la checklist de l'<a href="/audit-crm-hubspot">audit CRM HubSpot</a>.</p>

<h2>Les associer en masse, en trois passes</h2>
<ol>
<li><strong>Par domaine d'e-mail</strong> : le contact <em>@acme.fr</em> rejoint l'entreprise dont le domaine est acme.fr. Passe automatique, sûre, qui résout souvent la moitié des cas.</li>
<li><strong>Par SIREN</strong> : le contact mentionne une entreprise (champ libre, signature, formulaire) ; l'API Sirene donne son SIREN, et le SIREN désigne la fiche HubSpot. Passe automatique avec validation des cas ambigus.</li>
<li><strong>Par règles validées</strong> : pour le reste (adresses génériques, entreprises absentes), une proposition par contact, validée en masse par lots. Une fiche entreprise est créée si elle n'existe pas, enrichie par SIREN.</li>
</ol>

<h2>Ce qu'il ne faut pas faire</h2>
<ul>
<li><strong>Associer par nom seul</strong> : « Acme » peut désigner trois entreprises.</li>
<li><strong>Supprimer les orphelins</strong> : ce sont souvent des décideurs bien réels, mal saisis.</li>
<li><strong>Traiter une fois</strong> : les formulaires en créent de nouveaux chaque jour ; l'association doit tourner en continu.</li>
</ul>

<h2>Ce que fait Revold</h2>
<p>Revold liste les contacts sans entreprise, propose les associations par domaine et par SIREN, permet une validation en masse et applique les associations dans HubSpot après ce clic, sans jamais écrire seul. Le taux de contacts orphelins est suivi comme un indicateur de <a href="/glossaire-revops#completude">complétude</a>, avec sa tendance, et le moteur de <a href="/produits/resolution-entites">résolution d'entités</a> garde les entreprises créées cohérentes avec les doublons et les hiérarchies.</p>
`,
  },
  {
    slug: "prevision-de-tresorerie-a-partir-du-pipeline",
    title: "Prévision de trésorerie à partir du pipeline : la méthode pondérée, du deal à l'encaissement",
    description:
      "Comment prolonger le forecast commercial en prévision d'encaissement : forecast pondéré par échéance, délai de facturation, délai de paiement observé par client, factures à échoir. Méthode, pièges et outil.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-11-17",
    readTime: "7 min",
    keywords: ["prévision de trésorerie", "prévision d'encaissement", "trésorerie prévisionnelle pipeline", "projection de trésorerie B2B", "cash forecast"],
    related: [
      { href: "/glossaire-revops#projection-de-tresorerie", label: "Définition : projection de trésorerie pondérée" },
      { href: "/forecast-commercial", label: "Forecast commercial" },
      { href: "/blog/dso-reduire-delai-de-paiement-depuis-le-crm", label: "DSO : réduire le délai de paiement" },
      { href: "/plateforme-revenue", label: "Plateforme revenue : du devis à l'encaissement" },
    ],
    faq: [
      { q: "Comment prévoir la trésorerie à partir du pipeline ?", a: "Forecast pondéré des deals par échéance, décalé du délai de facturation puis du délai de paiement observé par client, additionné aux factures déjà émises à échoir. Le résultat est une projection d'encaissement par mois." },
      { q: "Quelle différence avec un logiciel de trésorerie ?", a: "Un logiciel de trésorerie part de la banque et des factures ; il ne voit pas le pipeline. La méthode pondérée part du CRM et prolonge jusqu'à l'encaissement. Les deux se complètent : Revold fournit la partie pipeline → facture → encaissement, pas la gestion bancaire." },
      { q: "Quelle fiabilité attendre ?", a: "Celle du forecast commercial, dégradée par les délais de paiement. Sur un mois, l'essentiel de la projection vient des factures déjà émises ; sur un trimestre, le pipeline pèse davantage et l'incertitude aussi." },
    ],
    content: `
<p><strong>En bref :</strong> la prévision de trésorerie à partir du pipeline prolonge le forecast commercial jusqu'à l'euro encaissé. Pour chaque deal ouvert : montant × probabilité d'étape, décalé du délai entre signature et facture, puis du délai de paiement observé chez ce client. On y ajoute les factures déjà émises à échoir. Le résultat est une projection d'encaissement par mois, dont la fiabilité décroît avec l'horizon.</p>

<h2>Pourquoi les logiciels de trésorerie ne suffisent pas</h2>
<p>Ils partent de la banque et des factures émises : parfaits pour les quatre à six prochaines semaines, aveugles au-delà. Ce qui sera encaissé dans trois mois dépend de ce qui se signe aujourd'hui, et cette information vit dans le CRM. Inversement, le forecast commercial s'arrête à la signature et ignore que le client paie à 60 jours. La méthode pondérée relie les deux.</p>

<h2>La méthode en quatre couches</h2>
<ol>
<li><strong>Factures émises à échoir</strong> : montant dû par date d'échéance, corrigé du retard habituel du client. La couche la plus fiable.</li>
<li><strong>Deals signés non facturés</strong> : montant du deal, facturé au délai moyen observé (signature → facture), payé au délai de paiement du client.</li>
<li><strong>Forecast pondéré</strong> : deals ouverts, montant × probabilité d'étape, positionnés à leur date de fermeture puis décalés des deux délais précédents.</li>
<li><strong>Récurrent</strong> : abonnements actifs, projetés à leur date de prélèvement, nets du churn observé.</li>
</ol>
<p>La somme par mois donne la projection. Chaque couche est lue séparément : une projection à 80 % de forecast pondéré n'a pas la même solidité qu'une projection à 80 % de factures émises.</p>

<h2>Les délais à mesurer</h2>
<ul>
<li><strong>Signature → facture</strong> : souvent oublié, parfois plusieurs semaines (l'article sur la <a href="/blog/fuite-de-revenus-5-cas-concrets-pme">fuite de revenus</a> en donne un cas).</li>
<li><strong>Facture → encaissement</strong> : le <a href="/blog/dso-reduire-delai-de-paiement-depuis-le-crm">DSO</a>, par client plutôt qu'en moyenne ; certains clients paient toujours à 75 jours.</li>
</ul>
<p>Ces délais se mesurent sur les données rapprochées CRM × facturation × banque ; sans rapprochement, il faut les estimer, et la projection en souffre.</p>

<h2>Les pièges</h2>
<ul>
<li><strong>Compter les stagnants</strong> dans la couche forecast.</li>
<li><strong>Ignorer les échéances fiscales</strong> (TVA, IS, URSSAF) côté sorties : la projection d'encaissement n'est qu'une moitié de la trésorerie.</li>
<li><strong>Une seule probabilité</strong> pour toutes les étapes.</li>
</ul>

<h2>Ce que fait Revold</h2>
<p>La page Trésorerie de Revold calcule la projection pondérée des encaissements à partir des deals HubSpot, des factures Pennylane, Sage, Stripe, Chargebee ou GoCardless et des délais de paiement observés par client, y ajoute les échéances fiscales, et lit les factures en retard et les échéances à venir dans le brief Comptabilité. La <a href="/plateforme-revenue">plateforme revenue</a> décrit la chaîne complète ; la définition est dans le <a href="/glossaire-revops#projection-de-tresorerie">glossaire</a>.</p>
`,
  },
  {
    slug: "objectifs-commerciaux-quotas-atteignables-pipeline",
    title: "Objectifs commerciaux : fixer des quotas atteignables à partir du pipeline, pas du budget",
    description:
      "Un objectif commercial fixé depuis le budget sans regarder le pipeline est un vœu. Méthode pour dériver les quotas du pipeline (couverture, taux de closing, cycle), les répartir par commercial et par trimestre, et les suivre avec des alertes.",
    category: "Sales Intelligence",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-11-19",
    readTime: "7 min",
    keywords: ["objectifs commerciaux", "fixer des objectifs commerciaux", "quota commercial", "couverture du pipeline", "objectif de vente réaliste"],
    related: [
      { href: "/forecast-commercial", label: "Forecast commercial" },
      { href: "/blog/pipeline-commercial-b2b-etapes-taux-conversion", label: "Pipeline commercial B2B" },
      { href: "/produits/alertes-previsions", label: "Alertes, objectifs et actions" },
      { href: "/kpi-revops", label: "KPI RevOps" },
    ],
    faq: [
      { q: "Comment fixer un objectif commercial réaliste ?", a: "En partant du pipeline : pipeline pondéré disponible sur la période + pipeline à créer (nombre de deals × panier × taux de closing, dans le délai du cycle de vente). L'objectif budgétaire est ensuite confronté à ce calcul, pas l'inverse." },
      { q: "Qu'est-ce que la couverture du pipeline ?", a: "Le rapport entre le pipeline ouvert et l'objectif de la période. Les repères courants demandent 3 à 4 fois l'objectif en pipeline brut, selon le taux de closing." },
      { q: "À quelle fréquence suivre les objectifs ?", a: "Chaque semaine pour l'équipe, chaque jour pour les exceptions (objectif en retard à moins de 30 jours de l'échéance). Un objectif sans suivi automatique est oublié dès la troisième semaine." },
    ],
    content: `
<p><strong>En bref :</strong> un quota fixé depuis le budget (« +20 % par rapport à l'an dernier ») sans regarder le pipeline est un vœu. La méthode inverse part du pipeline : combien peut-on signer sur le trimestre avec le pipeline actuel et celui qu'on peut encore créer dans le délai du cycle de vente ? Le quota devient un calcul, réparti par commercial, et suivi avec des alertes quand il décroche.</p>

<h2>Dériver l'objectif du pipeline</h2>
<ol>
<li><strong>Pipeline pondéré disponible</strong> : deals ouverts dont la date de fermeture tombe dans la période, montant × probabilité d'étape (la <a href="/forecast-commercial">méthode de forecast</a>).</li>
<li><strong>Pipeline à créer</strong> : les deals créés dans la période ne se signeront dans la période que si le cycle de vente le permet. Avec un cycle de 60 jours, un deal créé en novembre ne compte pas pour le T4.</li>
<li><strong>Capacité</strong> : nombre de deals qu'un commercial peut travailler en parallèle, × panier moyen × taux de closing.</li>
<li><strong>Objectif atteignable</strong> = pondéré disponible + (deals créables dans le délai × panier × taux de closing).</li>
</ol>
<p>Confrontez ce chiffre au budget. L'écart est la conversation utile : il faut plus de pipeline (marketing, prospection), un meilleur taux de closing, ou un budget révisé.</p>

<h2>La couverture du pipeline</h2>
<p>Le rapport pipeline brut ÷ objectif est le garde-fou le plus simple. Les repères courants demandent 3 à 4 × avec un taux de closing autour de 25 à 30 % ; avec un taux de 50 %, 2 × suffit. Mesurez-la par commercial : une couverture moyenne correcte cache souvent un commercial à 1 × et un autre à 6 ×.</p>

<h2>Répartir sans démotiver</h2>
<ul>
<li><strong>Par territoire ou segment</strong>, avec un potentiel mesuré (nombre de comptes cibles, panier moyen du segment), pas à parts égales.</li>
<li><strong>Par trimestre</strong>, en tenant compte de la saisonnalité observée (l'historique des deux dernières années).</li>
<li><strong>En laissant la rampe</strong> : un commercial arrivé en septembre n'a pas de pipeline mûr avant deux cycles de vente.</li>
</ul>

<h2>Suivre, et alerter</h2>
<p>Un objectif se suit à trois horizons : la progression (signé ÷ objectif), la trajectoire (pondéré disponible + signé ÷ objectif) et l'échéance. Le signal qui compte est « moins de 60 % de progression à moins de 30 jours de l'échéance » : il laisse le temps d'agir. Dans Revold, les objectifs sont câblés sur le KPI réel (signé par commercial, par pipeline, par période), la progression est calculée par le moteur déterministe, et l'alerte de décrochage part au propriétaire ; le brief du jour lit les objectifs en retard et ceux qui viennent d'être atteints. La page <a href="/produits/alertes-previsions">Alertes, objectifs et actions</a> décrit le mécanisme.</p>
`,
  },
  {
    slug: "churn-silencieux-signaux-support-avant-resiliation",
    title: "Churn silencieux : les signaux dans le support et la facturation qui précèdent la résiliation",
    description:
      "La résiliation est la fin d'une histoire qui commence des semaines plus tôt : tickets non résolus, baisse d'usage, paiement échoué, contraction. Comment lire ces signaux par client en croisant support, abonnements et CRM, et qui doit agir.",
    category: "RevOps",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-11-24",
    readTime: "7 min",
    keywords: ["churn silencieux", "signaux de churn", "prédire le churn", "réduire le churn B2B", "rétention client SaaS", "alertes churn"],
    related: [
      { href: "/blog/bon-taux-de-churn-b2b-benchmarks-2026", label: "Quel est un bon taux de churn en B2B ?" },
      { href: "/solutions/reduire-churn", label: "Réduire le churn avec Revold" },
      { href: "/hubspot-stripe", label: "HubSpot et Stripe" },
      { href: "/equipes/csm", label: "Revold pour le service client" },
    ],
    faq: [
      { q: "Quels sont les signaux avant-coureurs du churn ?", a: "Un ticket non résolu au-delà du SLA, une hausse du nombre de tickets, un paiement échoué ou un retard inhabituel, une baisse de sièges ou de plan, l'absence de contact depuis plus de 90 jours, et le départ de l'interlocuteur principal." },
      { q: "Qui doit agir sur un signal de churn ?", a: "Le propriétaire du compte, nommément, avec le montant de MRR en jeu. Une alerte sans destinataire n'est pas traitée. Le service client agit sur les tickets, le commercial sur la relation, la finance sur le paiement." },
      { q: "Peut-on prédire le churn sans IA ?", a: "Oui : trois ou quatre règles simples sur des données croisées (support, abonnements, CRM) détectent la majorité des cas. L'IA n'apporte quelque chose qu'avec un volume de clients important." },
    ],
    content: `
<p><strong>En bref :</strong> la résiliation est rarement une surprise pour le client ; c'en est une pour le fournisseur parce que les signaux sont dispersés : les tickets dans l'outil de support, le paiement échoué dans Stripe, la baisse de sièges dans Chargebee, le silence dans le CRM. Croisés par client, quatre règles simples détectent la plupart des départs plusieurs semaines à l'avance. Le reste est une question de propriétaire et de rituel.</p>

<h2>Les signaux, et où ils vivent</h2>
<ul>
<li><strong>Support</strong> : ticket non résolu au-delà du SLA, deux tickets ou plus sur le même sujet en 30 jours, baisse brutale de la satisfaction.</li>
<li><strong>Facturation et abonnements</strong> : paiement échoué, retard inhabituel pour ce client, passage d'annuel à mensuel, baisse de sièges ou de plan (contraction).</li>
<li><strong>CRM</strong> : aucun contact depuis 90 jours, interlocuteur principal parti (changement de poste détecté), renouvellement à moins de 60 jours sans activité.</li>
<li><strong>Produit</strong> (si disponible) : baisse d'usage, fonctionnalités clés non utilisées.</li>
</ul>

<h2>Pourquoi ils ne sont pas vus</h2>
<p>Chaque signal est visible dans son outil, par l'équipe qui l'utilise. Aucun ne l'est pour le propriétaire du compte, qui ne va pas lire l'outil de support ni Stripe. Le churn silencieux est un problème de rapprochement : tant que le client de Zendesk, celui de Stripe et celui de HubSpot ne sont pas la même ligne, personne ne voit le cumul.</p>

<h2>Quatre règles qui suffisent</h2>
<ol>
<li><strong>Paiement échoué ou contraction</strong> → alerte immédiate au propriétaire, avec le MRR du compte.</li>
<li><strong>Ticket hors SLA sur un compte de plus de X € de MRR</strong> → alerte au propriétaire et au responsable support.</li>
<li><strong>Renouvellement à 60 jours sans activité CRM</strong> → tâche de contact au commercial.</li>
<li><strong>Deux signaux quelconques en 30 jours</strong> → compte marqué « à risque », revu au rituel hebdomadaire.</li>
</ol>

<h2>Le rituel de rétention</h2>
<p>Chaque semaine, la liste des comptes à risque triée par MRR, avec les signaux et le propriétaire. Une décision par compte : appel, geste commercial, escalade support, ou acceptation du départ (documentée). Le taux de comptes sauvés est le KPI du rituel ; la <a href="/blog/nrr-retention-nette-calcul-et-leviers">rétention nette</a> est son résultat à douze mois.</p>

<h2>Ce que fait Revold</h2>
<p>Revold rapproche les tickets (Zendesk, Intercom, Crisp, HubSpot), les abonnements (Stripe, Chargebee, GoCardless, Pennylane) et le CRM par client, applique ces règles comme des alertes câblées, et lit dans le brief Service client les tickets ouverts, hors SLA et sans mise à jour. La page <a href="/solutions/reduire-churn">Réduire le churn</a> décrit l'ensemble ; l'article sur le <a href="/blog/bon-taux-de-churn-b2b-benchmarks-2026">bon taux de churn</a> donne les repères.</p>
`,
  },
  {
    slug: "reporting-hubspot-limites-tableaux-de-bord-natifs",
    title: "Reporting HubSpot : les limites des tableaux de bord natifs, et comment les dépasser",
    description:
      "Les tableaux de bord HubSpot suffisent pour le pipeline ; ils butent sur la facturation, les propriétés de date personnalisées, les pipelines mélangés et les limites de rapports par abonnement. Ce qu'ils font bien, où ils s'arrêtent, et quoi ajouter.",
    category: "Intégrations",
    author: AUTHOR,
    authorRole: ROLE,
    date: "2026-11-26",
    readTime: "7 min",
    keywords: ["reporting HubSpot", "tableau de bord HubSpot", "rapports HubSpot limites", "rapports personnalisés HubSpot", "dashboard HubSpot ventes"],
    related: [
      { href: "/tableau-de-bord-commercial", label: "Tableau de bord commercial" },
      { href: "/alternative/hubspot-previsions", label: "Prévisions HubSpot vs Revold" },
      { href: "/integrations/hubspot", label: "Revold pour HubSpot" },
      { href: "/produits/tableaux-de-bord", label: "Tableaux de bord et templates Revold" },
    ],
    faq: [
      { q: "Les tableaux de bord HubSpot suffisent-ils pour piloter les ventes ?", a: "Pour le pipeline, le forecast par catégorie et l'activité des commerciaux, oui. Ils ne voient pas la facturation ni l'encaissement, et le nombre de rapports personnalisés dépend de l'abonnement." },
      { q: "Peut-on afficher le facturé et l'encaissé dans HubSpot ?", a: "Seulement en poussant ces données dans des propriétés du CRM par intégration, ce qui reste partiel et fragile. Une plateforme qui lit HubSpot et la facturation côte à côte évite cette copie." },
      { q: "Comment éviter les étapes en double dans les rapports HubSpot ?", a: "En filtrant chaque rapport sur un pipeline. Deux pipelines qui partagent un libellé d'étape (« Proposition ») fusionnent leurs chiffres dans un rapport « toutes transactions »." },
    ],
    content: `
<p><strong>En bref :</strong> les tableaux de bord HubSpot font bien ce pour quoi ils sont conçus : le pipeline, l'activité, le forecast par catégorie. Ils s'arrêtent où le CRM s'arrête : pas de facturé ni d'encaissé, pas de pondération sur une propriété de date personnalisée, des étapes homonymes mélangées entre pipelines, un nombre de rapports personnalisés limité par l'abonnement. Il ne s'agit pas de les remplacer mais de les prolonger.</p>

<h2>Ce que HubSpot fait bien</h2>
<ul>
<li>Le pipeline par étape et par propriétaire, en temps réel.</li>
<li>L'activité commerciale (appels, e-mails, réunions) par commercial.</li>
<li>Le forecast par catégorie (pipeline, best case, commit) avec le suivi de précision.</li>
<li>Les rapports d'attribution marketing sur les données HubSpot.</li>
</ul>

<h2>Où les tableaux de bord natifs s'arrêtent</h2>
<ol>
<li><strong>La facturation et l'encaissement.</strong> HubSpot ne sait pas ce que Pennylane, Sage ou Stripe ont facturé et encaissé. Le tableau de bord s'arrête à « Gagné ».</li>
<li><strong>Les propriétés de date personnalisées.</strong> Le forecast natif pondère sur <code>closedate</code>. Si l'équipe pilote sur une date de signature prévue, elle n'a pas de forecast natif.</li>
<li><strong>Les pipelines mélangés.</strong> Un rapport par étape sans filtre de pipeline additionne les étapes homonymes de tous les pipelines.</li>
<li><strong>Le nombre de rapports.</strong> Les rapports personnalisés sont plafonnés selon le niveau d'abonnement ; les portails qui pilotent finement atteignent la limite.</li>
<li><strong>Les alertes.</strong> HubSpot notifie sur des workflows, pas sur des seuils de KPI calculés.</li>
</ol>

<h2>Trois façons de dépasser ces limites</h2>
<ul>
<li><strong>Pousser les données dans HubSpot</strong> (propriétés « montant facturé », « montant encaissé ») par intégration. Ça marche pour un montant, pas pour une réconciliation ; et la copie diverge vite.</li>
<li><strong>Exporter vers un outil de BI</strong> (Looker Studio, Power BI) et modéliser. Puissant, mais la logique de revenu est à construire et à maintenir, comme le décrit le comparatif <a href="/alternative/looker-studio">Looker Studio</a>.</li>
<li><strong>Lire HubSpot et la facturation côte à côte</strong> dans une plateforme qui rapproche les deux par client, pondère sur la date de votre choix, filtre par pipeline et pose des alertes sur les KPIs. C'est l'approche de Revold.</li>
</ul>

<h2>Ce que fait Revold avec HubSpot</h2>
<p>Connexion OAuth en un clic, lecture seule, puis des tableaux par équipe avec templates par métier, un forecast pondéré par échéance avec la propriété de date de votre choix, les deals stagnants au seuil configurable, l'écart signé / facturé après rapprochement avec Pennylane, Sage, Stripe, Chargebee ou GoCardless, et des alertes sur chaque KPI. Les tableaux de bord HubSpot restent en place pour l'activité quotidienne. La page <a href="/integrations/hubspot">Revold pour HubSpot</a> et le comparatif avec <a href="/alternative/hubspot-previsions">l'outil Prévisions</a> détaillent la complémentarité.</p>
`,
  },
];
