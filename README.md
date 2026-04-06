# Revold — Plateforme d'intelligence revenue

Application Next.js avec TypeScript, Tailwind CSS et configuration Vercel.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`)

## Lancer en local

1. Copier les variables d'environnement :

```bash
cp .env.example .env.local
```

2. Installer et lancer :
```bash
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Pages principales

- `/login` : écran de connexion Revold (email + mot de passe)
- `/dashboard` : vue d'ensemble revenue avec scorecards, KPI et insight IA

## Déploiement Vercel

Le projet inclut un `vercel.json` avec configuration explicite :

- framework: `nextjs`
- install command: `npm install`
- build command: `npm run build`
- dev command: `npm run dev`
