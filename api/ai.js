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
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Validate API key from request headers
 */
function validateApiKey(req) {
  const apiKey = req.headers['x-api-key'];
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
async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  
  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Only POST is supported.' });
    return;
  }
  
  // Validate API key
  const authResult = validateApiKey(req);
  if (!authResult.valid) {
    res.status(401).json({ error: authResult.error });
    return;
  }
  
  // Parse request body
  let body;
  try {
    body = await parseBody(req);
  } catch (error) {
    res.status(400).json({ 
      error: 'Invalid request body', 
      detail: error.message.substring(0, 200) 
    });
    return;
  }
  
  // Handle string body (parse as JSON)
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'Invalid JSON format in request body' });
      return;
    }
  }
  
  // Validate required fields
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object' });
    return;
  }
  
  const { text, mode } = body;
  
  if (!text || typeof text !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "text" field' });
    return;
  }
  
  if (!mode || !['idea', 'todo', 'daily'].includes(mode)) {
    res.status(400).json({ 
      error: 'Missing or invalid "mode" field. Must be one of: idea, todo, daily' 
    });
    return;
  }
  
  // Call upstream API
  try {
    const reply = await callUpstreamAPI(text, mode);
    res.status(200).json({ reply });
  } catch (error) {
    const errorMessage = error.message || 'Unknown error';
    const detail = errorMessage.substring(0, 300);
    res.status(500).json({ 
      error: 'Failed to process AI request',
      detail: detail
    });
  }
}

module.exports = handler;

