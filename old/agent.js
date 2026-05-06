import { get_weather } from './tools/weather.js';
import { calculate } from './tools/calculate.js';
import { web_search } from './tools/search.js';

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

export const tools = [weatherTool, calculatriceTool, searchTool];
export const toolFunctions = { get_weather, calculate, web_search };

