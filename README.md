# Futurepedia Scraper

Scraper Node.js qui extrait tous les outils IA listés sur [futurepedia.io](https://www.futurepedia.io) via Playwright (rendu JS).

## Fonctionnement

1. **Découverte** — Scrape automatiquement toutes les catégories/sous-catégories depuis la page `/ai-tools`
2. **Listings** — Parcourt chaque sous-catégorie, scroll et pagine pour collecter toutes les fiches outils
3. **Détails** — Visite chaque page outil pour extraire les infos complètes (description, prix, avis, liens sociaux, etc.)
4. **Export** — Génère un CSV et un JSON dédupliqués

## Prérequis

- Node.js >= 18

## Installation

```bash
npm install
npx playwright install chromium
```

## Lancement

```bash
npm start
```

## Fichiers de sortie

| Fichier | Contenu |
|---|---|
| `futurepedia_tools.csv` | Données tabulaires (28 colonnes) |
| `futurepedia_tools_full.json` | Données complètes au format JSON |

### Colonnes CSV

`name`, `description`, `full_description`, `category`, `subcategory`, `tags`, `all_categories`, `pricing`, `prices_found`, `rating`, `overall_rating`, `review_count`, `rating_dimensions`, `features`, `pros`, `cons`, `official_url`, `url`, `external_url`, `logo_url`, `social_links`, `platform`, `verified`, `visit_count`, `last_updated`, `target_users`, `creator`, `badge`

## Structure du projet

```
src/
├── index.js                    # Point d'entrée
├── config/
│   ├── constants.js            # Configuration (concurrence, timeouts, user-agents)
│   └── extractors.js           # Scripts JS évalués dans le navigateur
├── services/
│   ├── categoryDiscovery.js    # Découverte dynamique des catégories
│   ├── scraper.js              # Scraping des listings et des pages détail
│   ├── stats.js                # Suivi des stats en temps réel
│   └── dashboard.js            # Affichage terminal du dashboard
└── utils/
    ├── semaphore.js            # Contrôle de concurrence
    ├── helpers.js              # Fonctions utilitaires (scroll, retry, sleep)
    └── csv.js                  # Export CSV
```

## Configuration

Les paramètres sont dans `src/config/constants.js` :

| Paramètre | Défaut | Description |
|---|---|---|
| `LISTING_CONCURRENCY` | 4 | Workers parallèles pour les pages listing |
| `DETAIL_CONCURRENCY` | 6 | Workers parallèles pour les pages détail |
| `SCRAPE_DETAILS` | true | Activer/désactiver le scraping des pages détail |
| `BATCH_SIZE` | 60 | Taille des batches pour les détails |
| `MAX_RETRIES` | 2 | Nombre de tentatives en cas d'échec |
