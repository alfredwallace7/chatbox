export async function fetchModels(baseUrl: string, apiKey?: string): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
      }
    });
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    // OpenAI and Ollama style: { data: [{id: 'foo'}, ...] } or { models: [{id: 'foo'}, ...] }
    let models: any[] = [];
    if (Array.isArray(data.models)) {
      models = data.models;
    } else if (Array.isArray(data.data)) {
      models = data.data;
    }
    // Sort by created field descending if available
    if (models.length > 0 && models[0].created !== undefined) {
      models.sort((a, b) => (b.created || 0) - (a.created || 0));
    }
    return models.map((m: any) => m.id || m.name || m.model || '');
  } catch (err) {
    return [];
  }
}
