const Groq = require('groq-sdk');
const logger = require('../utils/logger');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
  maxRetries: 2
});

const SYSTEM_PROMPT = `You are MutuneRent AI, a property management assistant for Mutune Estate Agency in Mombasa, Kenya. You help agents and tenants with property-related queries.

RULES:
1. Only discuss properties and tenants the user has access to.
2. Never expose sensitive data: ID numbers, passwords, full bank details.
3. For payment queries, reference M-Pesa receipt numbers when available.
4. For maintenance: emergency (flood/electric hazard) → immediate dispatch; non-urgent → schedule within 72hrs.
5. When citing legal basis, reference Kenyan law: Rent Restriction Act (Cap 296), Landlord and Tenant Act.
6. Respond in English with Swahili greetings when appropriate ("Habari, I've checked...").
7. If uncertain about legal advice, recommend consulting EARB or Rent Tribunal.
8. Keep responses concise (under 200 words) and actionable.

AVAILABLE TOOLS (you can suggest these but cannot execute them directly):
- check_payment_status(tenant_id)
- create_maintenance_ticket(property_id, unit_id, category, description)
- get_property_details(property_code)
- get_tenant_history(tenant_id)

Current date: ${new Date().toISOString().split('T')[0]}`;

class AIService {
  constructor() {
    // In-memory session storage (MVP — no persistence across restarts)
    this.sessions = new Map();
  }

  async chat({ message, sessionId, userId, role: _role, context = {} }) {
    try {
      // Rate limit: simple in-memory sliding window (30 req/min for Groq free tier)
      const now = Date.now();
      const windowStart = now - 60000;
      const rateKey = `rate_${userId}`;
      const recentRequests = (this.sessions.get(rateKey) || []).filter(t => t > windowStart);
      if (recentRequests.length >= 30) {
        throw Object.assign(
          new Error('Rate limit exceeded: 30 requests per minute'),
          { status: 429, code: 'RATE_LIMIT' }
        );
      }
      recentRequests.push(now);
      this.sessions.set(rateKey, recentRequests);

      // Build message history
      const historyKey = `hist_${sessionId || userId}`;
      const history = this.sessions.get(historyKey) || [];

      // Add system prompt on first message
      if (history.length === 0) {
        history.push({ role: 'system', content: SYSTEM_PROMPT });
      }

      // Enrich user message with context if provided
      let enrichedMessage = message;
      if (context.tenantName) {
        enrichedMessage = `[Context: Tenant ${context.tenantName}, Unit ${context.unitId}] ${message}`;
      } else if (context.propertyCode) {
        enrichedMessage = `[Context: Property ${context.propertyCode}] ${message}`;
      }

      history.push({ role: 'user', content: enrichedMessage });

      // Call Groq Cloud
      const completion = await groq.chat.completions.create({
        messages: history.slice(-10), // Keep last 10 messages for context window
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: parseFloat(process.env.GROQ_TEMPERATURE) || 0.3,
        max_tokens: parseInt(process.env.GROQ_MAX_TOKENS, 10) || 1024,
        top_p: 0.9
      });

      const response = completion.choices[0]?.message?.content || 'I apologize, I could not process that request.';

      // Store assistant response in history
      history.push({ role: 'assistant', content: response });
      this.sessions.set(historyKey, history);

      // Detect tool intent from user message
      const toolIntent = this.detectToolIntent(message);

      logger.info('AI chat completed', {
        userId,
        sessionId,
        model: completion.model,
        tokens: completion.usage?.total_tokens
      });

      return {
        response,
        sessionId: sessionId || userId,
        toolIntent,
        tokensUsed: completion.usage?.total_tokens || 0
      };
    } catch (error) {
      logger.error('AI chat failed', { userId, message: error.message, status: error.status });
      throw error;
    }
  }

  detectToolIntent(userMessage) {
    const lowerMsg = userMessage.toLowerCase();
    const tools = [];

    if (lowerMsg.includes('payment') || lowerMsg.includes('rent') || lowerMsg.includes('paid') || lowerMsg.includes('arrears')) {
      tools.push({ tool: 'check_payment_status', confidence: 0.8 });
    }
    if (lowerMsg.includes('maintenance') || lowerMsg.includes('repair') || lowerMsg.includes('fix') || lowerMsg.includes('broken') || lowerMsg.includes('leak')) {
      tools.push({ tool: 'create_maintenance_ticket', confidence: 0.85 });
    }
    if (lowerMsg.includes('property') || lowerMsg.includes('house') || lowerMsg.includes('unit') || lowerMsg.includes('building')) {
      tools.push({ tool: 'get_property_details', confidence: 0.7 });
    }
    if (lowerMsg.includes('tenant') || lowerMsg.includes('who lives') || lowerMsg.includes('history')) {
      tools.push({ tool: 'get_tenant_history', confidence: 0.7 });
    }

    return tools.length > 0 ? tools : null;
  }

  getHistory(sessionId) {
    return this.sessions.get(`hist_${sessionId}`) || [];
  }

  clearHistory(sessionId) {
    this.sessions.delete(`hist_${sessionId}`);
    return { cleared: true };
  }
}

module.exports = new AIService();
