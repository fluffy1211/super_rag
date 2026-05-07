import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';
import { MistralAIEmbeddings, ChatMistralAI } from '@langchain/mistralai';
import { PineconeStore } from '@langchain/pinecone';
import { createRetrievalChain } from 'langchain/chains/retrieval';
import { createStuffDocumentsChain } from 'langchain/chains/combine_documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';

export async function ragQueryLangchain(question) {
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

    const embeddings = new MistralAIEmbeddings({ model: 'mistral-embed' });
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex,
    });

    const llm = new ChatMistralAI({ model: 'mistral-small-latest' });

    const prompt = ChatPromptTemplate.fromMessages([
        ['system', `Tu es un assistant documentaire strict. Tu réponds uniquement aux questions portant sur le contenu des documents fournis. Règles :
        1. Réponds en synthétisant les informations du contexte fourni. Tu peux reformuler et expliquer.
        2. Cite les sources entre crochets (ex: [Source: docs_a2a.md]) pour chaque point clé.
        3. Si le contexte ne contient pas l’information nécessaire, réponds : "Je ne trouve pas cette information dans les documents fournis. [Source : <liste des sources consultées>]"
        4. Ne fabrique pas d’informations absentes du contexte.
        5. Si la demande est hors sujet (blague, opinion, fiction, ou toute requête sans lien avec les documents), réponds uniquement : "Requête hors sujet. Je réponds uniquement aux questions sur les documents fournis."`],
        ['human', 'Voici les documents pertinents:\n{context}\n\nEn te basant uniquement sur ces documents, réponds à la question suivante:\n{input}'],
    ]);

    const combineDocsChain = await createStuffDocumentsChain({ llm, prompt });
    const chain = await createRetrievalChain({ retriever: vectorStore.asRetriever(), combineDocsChain });

    const response = await chain.invoke({ input: question });
    return response.answer;
}

console.log(await ragQueryLangchain("How do I configure OpenAI models for authentication in PydanticAI?"));