# Audits

Ce dossier contient les rapports d'audit générés automatiquement par les
routines remote Claude Code (`.claude/agents/`).

## Format des fichiers

`audits/<YYYY-MM-DD>-<type>.md`

Exemples :
- `audits/2026-05-04-cto-daily.md` — audit quotidien CTO Revold
- `audits/2026-05-04-revenue-weekly.md` — audit hebdo Revenue Strategist

## Workflow

1. La routine remote (CCR) clone le repo, fait son audit, écrit le rapport ici
2. Elle commit + push (`git push origin main`)
3. Le workflow GitHub `.github/workflows/audit-slack-notify.yml` se déclenche
4. Il extrait le titre + résumé du fichier .md
5. Il poste sur Slack `#alerte-revold` avec un lien vers le rapport complet

## Pourquoi ce détour ?

Le sandbox CCR Anthropic bloque les requêtes sortantes vers `hooks.slack.com`
ET vers `revold.io`. github.com est dans l'allowlist (puisque l'agent doit
pouvoir cloner). Donc on passe par GitHub Actions qui n'a aucune restriction
réseau pour faire le pont vers Slack.

## Structure d'un fichier d'audit

```markdown
# <Titre H1 court — affiché en titre Slack>

<Contenu markdown — les ~1500 premiers chars sont envoyés sur Slack
en mrkdwn, le reste est accessible via le bouton "Voir le rapport complet">

...
```
