import 'dotenv/config';
import readline from 'node:readline';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { runAgent } from './agent-loop.js';
import { get_weather } from './tools/weather.js';
import { calculate } from './tools/calculate.js';
import { web_search } from './tools/search.js';

const SYSTEM_MESSAGE = { role: 'system', content: 'Tu es un assistant intelligent qui peut répondre à des questions, faire des recherches sur le web, récupérer la météo, et faire des calculs. Utilise les outils à ta disposition pour fournir les meilleures réponses possibles.' };

const weatherTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Récupère la météo actuelle pour une ville donnée. Utiliser quand on parle de météo, température, conditions climatiques.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: "Le nom de la ville, en anglais de préférence (ex: 'Paris', 'London', 'Tokyo')"
        }
      },
      required: ['city']
    }
  }
};

const calculatriceTool = {
  type: 'function',
  function: {
    name: 'calculate',
    description: 'Évalue une expression mathématique et retourne le résultat. Utiliser pour tout calcul arithmétique.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: "L'expression à évaluer, ex: '(15 * 4) / 3' ou '2 ** 32'"
        }
      },
      required: ['expression']
    }
  }
};

const searchTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Recherche des informations récentes sur le web. Utiliser pour des faits actuels, des événements récents, des prix, des données en temps réel, ou quand on n\'est pas certain d\'une information. CITER TOUT LE TEMPS la source (URL) de l\'information trouvée. CITE TES SOURCES !',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La requête de recherche, en anglais pour de meilleurs résultats'
        }
      },
      required: ['query']
    }
  }
};

const tools = [weatherTool, calculatriceTool, searchTool];
const toolFunctions = { get_weather, calculate, web_search };

runAgent(tools, toolFunctions, "et a paris ?")
  .then(response => console.log('\nRéponse finale de l\'agent :', response))
  .catch(error => console.error('Erreur lors de l\'exécution de l\'agent :', error));
