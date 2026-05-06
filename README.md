# super_rag

`super_rag` est un petit projet Node.js qui combine deux briques :

- un agent conversationnel en ligne de commande qui utilise Groq pour dialoguer et appeler des outils
- un script d'indexation qui prépare un corpus Markdown pour la recherche sémantique dans Pinecone

Le projet sert de base d'expérimentation pour un assistant capable de répondre à des questions, faire des calculs, consulter la météo et lancer des recherches web.

## Fonctionnalités

- conversation en CLI avec historique de dialogue
- appels d'outils pour la météo, les calculs et la recherche web
- indexation de fichiers Markdown dans `corpus/`
- génération d'embeddings via Mistral puis insertion dans Pinecone

## Prérequis

- Node.js 18 ou supérieur
- un compte Groq avec une clé API
- une clé API Mistral pour les embeddings
- un index Pinecone déjà créé

## Installation

```bash
npm install
```

## Variables d'environnement

Crée un fichier `.env` à la racine du projet avec au minimum :

```env
GROQ_API_KEY=your_groq_key
MISTRAL_API_KEY=your_mistral_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=your_index_name
```

## Lancer l'agent

```bash
npm run dev
```

La commande démarre `agent.js` avec Nodemon. Le script initialise un agent avec trois outils :

- `get_weather` pour la météo d'une ville
- `calculate` pour évaluer une expression mathématique
- `web_search` pour récupérer des résultats web récents

## Indexer le corpus

```bash
node create-index.js
```

Le script parcourt les fichiers `.md` et `.txt` du dossier `corpus/`, découpe le texte en chunks, récupère des embeddings via l'API Mistral, puis envoie les vecteurs dans l'index Pinecone.

## Structure du projet

- `agent.js` : point d'entrée de l'agent CLI et définition des outils
- `agent-loop.js` : boucle d'exécution qui interroge le modèle et gère les tool calls
- `create-index.js` : indexation du corpus dans Pinecone
- `tools/` : implémentations locales des outils métier
- `corpus/` : documentation source utilisée comme base de connaissances

## Notes

- `create-index.js` contient encore quelques commentaires `TODO` indiquant des pistes d'évolution.
- `agent.js` lance actuellement une requête de démonstration codée en dur. Tu peux adapter ce point d'entrée pour interagir avec l'utilisateur en continu.

## Licence

ISC