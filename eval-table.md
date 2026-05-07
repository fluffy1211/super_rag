# Eval Table — RAG Pipeline

| # | Question | Top-1 score | Avg top-3 score | Tokens (in/out) | Coût ($) | Pertinence (1-5) | Fidélité (1-5) | Notes |
|---|----------|-------------|-----------------|-----------------|----------|------------------|----------------|-------|
| 1 | How do I configure OpenAI models for authentication in PydanticAI? | 0.88 | 0.86 | 568 / 97 | $0.0004 | 1 | 5 | Chunks non pertinents, réponse fidèle mais inutile |
| 2 | What are the different message types and request/response parts available in the messages module? | 0.78 | 0.74 | 2052 / 569 | $0.0017 | 5 | 5 | Réponse complète et fidèle aux chunks récupérés. |
| 3 | How can I integrate Mistral models into my PydanticAI project? | 0.86 | 0.82 | 633 / 18 | $0.0004 | 5 | 5 | Réponse fidèle mais hors sujet, pertinence maximale. |
| 4 | What tools are available in PydanticAI and how do I use the built-in tools? | 0.88 | 0.87 | 2074 / 1781 | $0.0026 | 5 | 4 | Très complet mais quelques détails techniques approximatifs |
| 5 | How do I set up and use embeddings in my PydanticAI application? | 0.88 | 0.84 | 611 / 79 | $0.0004 | 5 | 1 | Réponse incorrecte malgré chunks très pertinents |
| 6 | What is the difference between Ollama, Cohere, and Anthropic model implementations? | 0.79 | 0.78 | 2377 / 45 | $0.0014 | 2 | 1 | Chunks non pertinents, réponse non générée à partir des documents |
| 7 | How do I configure model profiles and manage multiple model configurations? | 0.77 | 0.74 | 2593 / 1351 | $0.0026 | 5 | 5 | Réponse complète et fidèle aux chunks fournis. |
| 8 | What output formats does PydanticAI support and how do I structure response outputs? | 0.85 | 0.83 | 2342 / 1223 | $0.0023 | 5 | 4 | Très complet mais quelques détails techniques mal interprétés |
| 9 | How does the model wrapper work and how can I wrap custom models? | 0.75 | 0.73 | 1538 / 879 | $0.0016 | 5 | 5 | Réponse complète, précise et fidèle aux chunks récupérés. |
| 10 | What is A2A in PydanticAI and how does it relate to the API structure? | 0.87 | 0.84 | 2093 / 658 | $0.0018 | 5 | 5 | Réponse complète, précise et fidèle aux chunks fournis. |
| | **Moyenne Pertinence** | | | | | 4.3 | | |
| | **Moyenne Fidélité** | | | | | | 4.0 | |
| | **Coût total (10 requêtes)** | | | | $0.0153 | | | |
| | **Latence moyenne** | | | | 5286 ms | | | |
