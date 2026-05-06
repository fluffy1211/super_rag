
import 'dotenv/config';
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

export const conversationHistory = [
  { role: 'system', content: 'Tu es un assistant intelligent qui peut répondre à des questions, faire des recherches sur le web, récupérer la météo, et faire des calculs. Utilise les outils à ta disposition pour fournir les meilleures réponses possibles.' }
];

export async function runAgent(tools, toolFunctions, userMessage, history = conversationHistory, systemPrompt = null) {
  if (systemPrompt) {
    history = [{ role: 'system', content: systemPrompt }];
  }
  history.push({ role: 'user', content: userMessage });

  let iterations = 0;

  // La boucle : on tourne jusqu'à ce que le modèle dise "stop"
  while (iterations < 20) {
    iterations++;
    const callStart = Date.now();

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: history,
        tools,
        tool_choice: 'auto'
      })
    });

    const data = await response.json();
    if (!response.ok || !data.choices) {
      throw new Error(`API error ${response.status}: ${JSON.stringify(data)}`);
    }
    const choice = data.choices[0];

    process.stdout.write('\nIA : ');
    process.stdout.write(choice.message.content ?? '');

    // On ajoute la réponse du modèle à l'historique (avec ou sans tool_calls)
    history.push(choice.message);

    if (choice.finish_reason === 'stop') {
      // Le modèle a fini, on retourne la réponse textuelle
      return choice.message.content;
    }

    if (choice.finish_reason === 'tool_calls') {
      // Le modèle veut appeler des outils — potentiellement plusieurs à la fois
      for (const toolCall of choice.message.tool_calls) {
        const fn = toolFunctions[toolCall.function.name];
        const args = JSON.parse(toolCall.function.arguments);

        // On exécute l'outil
        const result = await fn(args);

        // On renvoie le résultat au modèle sous forme de message "tool"
        history.push({
          role: 'tool',
          tool_call_id: toolCall.id, // l'ID est important pour matcher l'appel
          content: JSON.stringify(result)
        });
      }
      // La boucle repart : le modèle reçoit les résultats et décide quoi faire
    }
  }
}

// while (true) {
//   const input = await question('\nVous : ');
//   await runAgent([], {}, input);
// }
