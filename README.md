# super_rag

`super_rag` est un projet Node.js de pipeline RAG de bout en bout.

L'objectif est de prendre un corpus de documents Markdown/TXT, de l'indexer dans Pinecone avec des embeddings Mistral, puis de permettre à un utilisateur de poser des questions sur ce corpus via une CLI.

Ce README suit les étapes du projet "pipeline RAG complète" du Jour 4, en s'appuyant sur les scripts présents dans ce repo.

## Objectif du projet

Le pipeline repose sur 3 idées simples :

1. `Retrieval` : retrouver les passages les plus pertinents dans le corpus
2. `Augmentation` : injecter ces passages dans le prompt
3. `Generation` : produire une réponse fondée sur les sources

Le but n'est pas seulement d'obtenir une réponse, mais une réponse :

- fondée sur le corpus
- traçable avec des sources
- observable avec des métriques
- testable sur un jeu de questions

## Stack utilisée

- `Node.js` pour l'orchestration
- `Mistral` pour les embeddings et la génération
- `Pinecone` comme base vectorielle
- `LangChain.js` pour une version alternative du pipeline
- `franc` pour détecter la langue des chunks

## Prérequis

- `Node.js 18+`
- une clé API `MISTRAL_API_KEY`
- une clé API `PINECONE_API_KEY`
- un index Pinecone déjà créé

Important :

- l'index Pinecone doit être compatible avec les embeddings Mistral
- `mistral-embed` produit des vecteurs de dimension `1024`

## Installation

```bash
npm install
```

## Variables d'environnement

Créer un fichier `.env` à la racine du projet :

```env
MISTRAL_API_KEY=your_mistral_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=your_index_name
```

## Structure utile du projet

- [README.md](/c:/Users/joeln/Downloads/Ecole/API/super_rag/README.md)
- [pipeline_rag/scripts/create-index.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/scripts/create-index.js)
- [pipeline_rag/scripts/eval.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/scripts/eval.js)
- [pipeline_rag/cli.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/cli.js)
- [pipeline_rag/index-corpus.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/index-corpus.js)
- [pipeline_rag/llm.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/llm.js)
- [pipeline_rag/rag-pipeline-langchain.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/rag-pipeline-langchain.js)
- `pipeline_rag/corpus/` : corpus principal
- `old/` : ancienne version et fichiers historiques

## Étapes du projet

## 1. Préparer le corpus

Le corpus se trouve dans `pipeline_rag/corpus/`.

Le script charge tous les fichiers `.md` et `.txt`, puis prépare leur contenu pour l'indexation.

Dans [pipeline_rag/scripts/create-index.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/scripts/create-index.js), la fonction `loadCorpus(dir)` :

- lit les fichiers du dossier
- charge leur contenu texte
- conserve le nom du fichier comme source

Pourquoi c'est important :

- chaque chunk doit rester lié à son document d'origine
- les citations finales dépendent directement de ces métadonnées

## 2. Chunking du corpus

Le projet découpe chaque document en `chunks` avec chevauchement.

Fonction concernée :

- `chunckWithOverlap(text, chunkSize, overlap)`

Configuration actuelle :

- `chunkSize: 400`
- `overlap: 50`

Ce choix permet :

- de ne pas envoyer un document entier au modèle
- de préserver le contexte entre deux morceaux
- d'améliorer la précision du retrieval

Exemple de logique :

- un chunk contient environ `400` mots
- le chunk suivant réutilise `50` mots du précédent

## 3. Embeddings et indexation Pinecone

Une fois les chunks créés, ils sont transformés en vecteurs via Mistral puis envoyés dans Pinecone.

Fonctions concernées dans [pipeline_rag/scripts/create-index.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/scripts/create-index.js) :

- `embedBatch(texts)`
- `embedAndIndex(chunks, filename, index, progress)`
- `main()`

Le pipeline fait concrètement :

1. découpe les documents en chunks
2. envoie les chunks par petits groupes à l'API d'embedding
3. construit un objet Pinecone pour chaque chunk
4. ajoute des métadonnées :
   `text`, `source`, `chunkIndex`, `language`, `indexedAt`
5. insère les vecteurs dans Pinecone par lots

Le projet utilise aussi un `CircuitBreaker` et un système de `retry` dans [pipeline_rag/llm.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/llm.js) pour rendre les appels Mistral plus robustes face :

- aux erreurs `429`
- aux erreurs `503`
- aux timeouts

### Lancer l'indexation

```bash
node pipeline_rag/index-corpus.js
```

Résultat attendu :

- chargement du corpus
- création des chunks
- affichage de la progression d'upsert
- index Pinecone alimenté avec les vecteurs

## 4. Retrieval : retrouver les bons chunks

Une fois l'index créé, la première étape de la question-réponse est le retrieval.

Fonction concernée :

- `retrieveContext(query, topK = 5)`

Cette fonction :

1. transforme la question en embedding
2. interroge Pinecone avec `topK`
3. récupère les chunks les plus proches sémantiquement
4. filtre les résultats avec `score >= 0.5`

Elle retourne :

- `text`
- `source`
- `score`
- `chunkIndex`
- `retrievalTime`

Idée clé :

- si les chunks retrouvés sont mauvais, la réponse finale sera mauvaise
- le retrieval est donc une étape centrale du pipeline

## 5. Génération RAG

Après le retrieval, le projet construit une réponse à partir du contexte récupéré.

Fonction concernée :

- `generateCompletion(query, context)`

Cette fonction :

1. construit un `system prompt` strict
2. injecte les chunks retrouvés dans le `user prompt`
3. appelle `mistral-small-latest`
4. retourne la réponse et le temps de génération

Le prompt impose plusieurs règles :

- répondre uniquement à partir du contexte
- citer les sources
- ne pas inventer
- dire explicitement si l'information n'est pas trouvée
- refuser les questions hors sujet

Cette étape correspond au `G` de `RAG`.

## 6. Pipeline complète + observability

La fonction qui assemble le tout est :

- `ragQuery(question, options = { topK: 5, verbose: false })`

Elle enchaîne :

1. `retrieveContext(...)`
2. `generateCompletion(...)`
3. affichage optionnel des métriques

Quand `verbose: true`, le script affiche :

- les chunks récupérés
- leur source
- leur score
- le meilleur score
- le score moyen
- le temps de retrieval
- le temps de génération
- les tokens consommés

Exemple d'appel :

```js
const answer = await ragQuery("How do I configure OpenAI models?", {
  topK: 5,
  verbose: true
});
```

Remarque importante :

- dans l'état actuel du repo, `ragQuery` retourne seulement la `answer`
- les métriques sont affichées en console en mode verbose, mais ne sont pas encore renvoyées comme objet complet

## 7. Évaluation de la pipeline

Le projet contient une base d'évaluation dans [pipeline_rag/scripts/eval.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/scripts/eval.js).

Ce script :

- pose 10 questions de référence
- exécute le retrieval
- exécute la génération
- calcule quelques métriques :
  `top1Score`, `avgTop3Score`, `promptTokens`, `completionTokens`, `costUSD`, `latencyMs`
- demande ensuite à un LLM de juger :
  `pertinence` et `fidelite`
- génère un fichier `eval-table.md`

### Lancer l'évaluation

```bash
node pipeline_rag/scripts/eval.js
```

Cette étape sert de baseline mesurée pour comparer les futures améliorations.

## 8. Version LangChain

Le repo contient une version alternative dans [pipeline_rag/rag-pipeline-langchain.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/rag-pipeline-langchain.js).

Objectif :

- reproduire la même logique RAG
- mais avec les abstractions LangChain

Cette version permet de comparer :

- l'approche "from scratch"
- l'approche "framework"

## 9. CLI interactive

Le point d'entrée utilisateur est [pipeline_rag/cli.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/cli.js).

Cette CLI :

- ouvre une boucle `readline`
- attend les questions utilisateur
- ignore les entrées vides
- limite la taille des requêtes
- ferme proprement sur `Ctrl+C`

### Lancer la CLI

```bash
node pipeline_rag/cli.js
```

Exemple de flux :

```text
Mini-Perplexity - posez vos questions sur le corpus
> How do I configure model profiles?
Recherche en cours...
...
```

## 10. Robustesse et gestion d'erreurs

Le projet ajoute un garde-fou dans [pipeline_rag/llm.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/llm.js) avec :

- `withRetry(...)`
- `CircuitBreaker`
- timeout via `AbortController`

Un script de test est aussi présent :

- [pipeline_rag/test-error-handling.js](/c:/Users/joeln/Downloads/Ecole/API/super_rag/pipeline_rag/test-error-handling.js)

Il sert à explorer :

- le happy path
- les timeouts
- le rate limiting
- l'ouverture du circuit breaker

## Commandes utiles

```bash
npm install
node pipeline_rag/index-corpus.js
node pipeline_rag/cli.js
node pipeline_rag/scripts/eval.js
node pipeline_rag/test-error-handling.js
node pipeline_rag/rag-pipeline-langchain.js
```

## État actuel du repo

Ce dépôt couvre déjà une grande partie des attentes du projet :

- indexation du corpus
- retrieval
- génération RAG
- CLI interactive
- baseline d'évaluation
- version LangChain
- garde-fous réseau

Quelques écarts ou pistes d'amélioration restent visibles :

- `ragQuery` ne retourne pas encore un objet complet `{ answer, sources, chunks, metrics }`
- `eval-table.md` est généré par le script mais n'est pas encore versionné dans ce repo
- la version LangChain retourne actuellement une réponse simple, sans structure enrichie
- certaines étapes du TP sont partiellement couvertes plutôt que finalisées au format exact demandé

## Résumé

Ce projet implémente une pipeline RAG complète :

1. charger un corpus
2. le découper en chunks
3. produire des embeddings
4. indexer dans Pinecone
5. retrouver les passages pertinents
6. générer une réponse contrainte par les sources
7. observer les métriques
8. évaluer la qualité du système

Autrement dit, c'est un mini moteur de question-réponse documentaire, spécialisé sur un corpus local.
