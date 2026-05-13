const BASE_URL = 'https://safetyiq-api.onrender.com';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface SourceChunk {
  document_title: string;
  page_number: number;
  similarity: number;
  content: string;
}

export interface QueryResponse {
  answer: string;
  sources: SourceChunk[];
}

export async function sendQuery(
  question: string,
  history: Message[]
): Promise<QueryResponse> {
  const response = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question, history }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
