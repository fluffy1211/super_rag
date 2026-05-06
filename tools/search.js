export async function web_search({ query }) {
  const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (educational project)' }
  });

  const data = await response.json();

  const results = data.RelatedTopics
    .filter(t => t.Text)
    .slice(0, 5)
    .map(t => ({ text: t.Text, url: t.FirstURL }));

  if (results.length > 0) return results;
  if (data.AbstractText) return [{ text: data.AbstractText, url: data.AbstractURL }];
  return { message: 'Aucun résultat trouvé.' };
}
