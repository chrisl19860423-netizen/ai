/**
 * AI Gateway API for HomePod/iPhone Shortcuts
 * POST /api/ai
 */

// System prompts for different modes
const SYSTEM_PROMPTS = {
  idea: `你是一个简洁的思考助手。请用一句话总结用户的想法，然后给出一个下一步行动建议（仅1条）。要求：简洁、中文、实用。`,
  
  todo: `你是一个任务规划助手。请根据用户的输入，输出：
1. 目标：一句话描述目标
2. TODO：列出3条待办事项，每条前面标注优先级（P1/P2/P3）
3. 第一最小动作：立即可以执行的最小步骤

要求：中文、精炼、可执行。`,
  
  daily: `你是一个日常复盘助手。请根据用户的输入，输出三段式总结：
- Progress（进展）：1-3条已完成或正在推进的事项
- Problem（问题）：1-3条遇到的困难或挑战
- Plan（计划）：1-3条下一步计划

要求：中文、精炼、每段1-3条。`
};

/**
 * Parse request body (supports both JSON object and JSON string)
 */
async function parseBody(request) {
  try {
    const text = await request.text();
    if (!text) return null;
    
    // Try to parse as JSON
    try {
      return JSON.parse(text);
    } catch {
      // If already an object (shouldn't happen with fetch, but handle it)
      return text;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Validate API key from request headers
 */
function validateApiKey(request) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.GATEWAY_API_KEY;
  
  if (!expectedKey) {
    return { valid: false, error: 'Server configuration error: GATEWAY_API_KEY not set' };
  }
  
  if (!apiKey || apiKey !== expectedKey) {
    return { valid: false, error: 'Unauthorized: Invalid API key' };
  }
  
  return { valid: true };
}

/**
 * Call upstream OpenAI-compatible API
 */
async function callUpstreamAPI(text, mode) {
  const upstreamBase = process.env.UPSTREAM_BASE || 'https://api.openai.com/v1';
  const upstreamKey = process.env.UPSTREAM_KEY;
  const model = process.env.MODEL || 'gpt-3.5-turbo';
  
  if (!upstreamKey) {
    throw new Error('Server configuration error: UPSTREAM_KEY not set');
  }
  
  const systemPrompt = SYSTEM_PROMPTS[mode];
  if (!systemPrompt) {
    throw new Error(`Invalid mode: ${mode}. Must be one of: idea, todo, daily`);
  }
  
  const url = `${upstreamBase}/chat/completions`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${upstreamKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.7,
        max_tokens: 500
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Upstream API error (${response.status}): ${errorText.substring(0, 200)}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from upstream API');
    }
    
    return data.choices[0].message.content.trim();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: Upstream API did not respond within 30 seconds');
    }
    
    throw error;
  }
}

/**
 * Main handler
 */
export default async function handler(request) {
  // Only accept POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Only POST is supported.' }),
      { 
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Validate API key
  const authResult = validateApiKey(request);
  if (!authResult.valid) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Parse request body
  let body;
  try {
    body = await parseBody(request);
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Invalid request body', detail: error.message.substring(0, 200) }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Handle string body (parse as JSON)
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON format in request body' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  // Validate required fields
  if (!body || typeof body !== 'object') {
    return new Response(
      JSON.stringify({ error: 'Request body must be a JSON object' }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  const { text, mode } = body;
  
  if (!text || typeof text !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid "text" field' }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  if (!mode || !['idea', 'todo', 'daily'].includes(mode)) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid "mode" field. Must be one of: idea, todo, daily' }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Call upstream API
  try {
    const reply = await callUpstreamAPI(text, mode);
    
    return new Response(
      JSON.stringify({ reply }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    const errorMessage = error.message || 'Unknown error';
    const detail = errorMessage.substring(0, 300);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process AI request',
        detail: detail
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

