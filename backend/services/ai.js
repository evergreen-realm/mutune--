const axios = require('axios');
const logger = require('../utils/logger');

// ── Lazy model requires to avoid circular deps ──────────────────────────────
const getModels = () => ({
  Property: require('../models/Property'),
  Tenant: require('../models/Tenant'),
  Payment: require('../models/Payment'),
  MaintenanceTicket: require('../models/MaintenanceTicket')
});

// ── Tool definitions for Kimi AI ─────────────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_payment_status',
      description: 'Check the latest payment record for a tenant or unit. Use when the user asks about payment status, arrears, or rent confirmation.',
      parameters: {
        type: 'object',
        properties: {
          tenant_code: { type: 'string', description: 'Tenant code like TNT-MOM-0001' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_maintenance_ticket',
      description: 'Create a new maintenance ticket. Use when the user reports a fault — plumbing, electrical, structural, etc.',
      parameters: {
        type: 'object',
        required: ['category', 'description'],
        properties: {
          category: { type: 'string', enum: ['plumbing', 'electrical', 'structural', 'security', 'appliance', 'pest_control', 'cleaning', 'other'] },
          description: { type: 'string', description: 'Detailed description of the issue' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'emergency'], description: 'Defaults to medium' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_property_details',
      description: 'Get property information by name, code, or area. Use for occupancy stats and unit availability.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Property name, code, or area (e.g. "Bamburi Court", "PROP-001", "Nyali")' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_tenant_details',
      description: 'Look up a tenant by name, code, or unit. Returns lease info and contact.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Tenant name, code, phone, or unit number' }
        }
      }
    }
  }
];

// ── Tool execution ───────────────────────────────────────────────────────────
async function executeTool(toolName, args, callerUser) {
  const { Property, Tenant, Payment, MaintenanceTicket } = getModels();

  try {
    switch (toolName) {
      case 'get_payment_status': {
        let tenant;
        if (args.tenant_code) {
          tenant = await Tenant.findOne({ tenant_code: args.tenant_code }).lean();
        } else if (callerUser.role === 'tenant') {
          tenant = await Tenant.findOne({ user_id: callerUser._id }).lean();
        }
        if (!tenant) {
          return { found: false, message: 'Tenant not found. Provide a valid tenant code.' };
        }
        const payment = await Payment.findOne({ tenant_id: tenant._id })
          .sort({ created_at: -1 })
          .lean();
        if (!payment) {
          return { found: true, tenant: tenant.full_name, status: 'No payment records found' };
        }
        return {
          found: true,
          tenant: tenant.full_name,
          tenant_code: tenant.tenant_code,
          amount_kes: payment.amount_kes,
          status: payment.status,
          receipt: payment.mpesa_receipt || payment.transaction_id,
          date: new Date(payment.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
        };
      }

      case 'create_maintenance_ticket': {
        if (!callerUser) return { error: 'Authentication required' };

        let propertyId = callerUser.current_property_id;
        let unitId = callerUser.current_unit_id;

        if (callerUser.role === 'tenant') {
          const tenant = await Tenant.findOne({ user_id: callerUser._id }).lean();
          if (tenant) {
            propertyId = tenant.current_property_id;
            unitId = tenant.current_unit_id;
          }
        }

        const count = await MaintenanceTicket.countDocuments();
        const ticket = await MaintenanceTicket.create({
          ticket_code: `MT-${String(count + 1).padStart(5, '0')}`,
          category: args.category,
          description: args.description,
          priority: args.priority || 'medium',
          status: 'open',
          property_id: propertyId,
          unit_id: unitId,
          created_by: callerUser._id
        });

        return {
          success: true,
          ticket_code: ticket.ticket_code,
          message: `Maintenance ticket ${ticket.ticket_code} created successfully. Our team will respond within ${args.priority === 'emergency' ? '2 hours' : '72 hours'}.`
        };
      }

      case 'get_property_details': {
        const query = args.query || '';
        const properties = await Property.find({
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { property_code: { $regex: query, $options: 'i' } },
            { 'address.area': { $regex: query, $options: 'i' } }
          ]
        }).limit(3).lean();

        if (!properties.length) {
          return { found: false, message: `No property found matching "${query}"` };
        }

        return {
          found: true,
          results: properties.map(p => ({
            name: p.name,
            code: p.property_code,
            area: p.address?.area,
            type: p.type,
            total_units: p.units?.length || 0,
            occupied: p.units?.filter(u => u.status === 'occupied').length || 0,
            vacant: p.units?.filter(u => u.status === 'vacant').length || 0
          }))
        };
      }

      case 'get_tenant_details': {
        const query = args.query || '';
        const tenant = await Tenant.findOne({
          $or: [
            { full_name: { $regex: query, $options: 'i' } },
            { tenant_code: { $regex: query, $options: 'i' } },
            { phone: { $regex: query, $options: 'i' } }
          ]
        }).lean();

        if (!tenant) {
          return { found: false, message: `No tenant found matching "${query}"` };
        }

        return {
          found: true,
          tenant_code: tenant.tenant_code,
          name: tenant.full_name,
          status: tenant.tenancy_status,
          rent_kes: tenant.rent_amount_kes,
          lease_end: tenant.lease_end ? new Date(tenant.lease_end).toLocaleDateString('en-KE') : 'N/A'
        };
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    logger.error('Tool execution error', { toolName, message: err.message });
    return { error: `Tool failed: ${err.message}` };
  }
}

// ── Build role-aware system prompt ───────────────────────────────────────────
function buildSystemPrompt(user, context) {
  const today = new Date().toISOString().split('T')[0];
  let prompt = `You are MutuneRent AI, the intelligent property management assistant for Mutune Estate Agency, Mombasa, Kenya. Today is ${today}.

Current user: ${user.full_name || 'User'} — Role: ${user.role}`;

  if (context.propertyName) prompt += `\nUser's property: ${context.propertyName}`;
  if (context.propertyCode) prompt += ` (${context.propertyCode})`;
  if (context.tenantName) prompt += `\nTenant name: ${context.tenantName}`;
  if (context.unitId) prompt += `\nUnit: ${context.unitId}`;
  if (context.assigned_properties?.length) {
    prompt += `\nAssigned properties: ${context.assigned_properties.join(', ')}`;
  }

  prompt += `

ROLE-SPECIFIC CAPABILITIES:
${user.role === 'agent' ? `- View assigned properties and tenants\n- Create maintenance tickets\n- Check payment status\n- Record check‑in visits` : ''}
${user.role === 'landlord' ? `- View property performance metrics\n- Request property addition (pending admin approval)\n- View rental income reports` : ''}
${user.role === 'admin' ? `- Full system management\n- Approve landlord property additions\n- Monitor agent performance\n- Manage inventory and auctions` : ''}
${user.role === 'tenant' ? `- View lease details\n- Pay rent (guide through M-Pesa STK)\n- Submit maintenance requests\n- View notices` : ''}

RULES:
1. Only discuss properties and data the user has access to based on their role.
2. Never reveal: National ID numbers, full bank account details, or other users' passwords.
3. For payments: reference M-Pesa receipt numbers (format: QCF…). Always confirm the paybill (e.g., 400200) and reference (unit number/tenant code).
4. For maintenance: emergency (flood/fire/electrical hazard) → immediate dispatch (2hr SLA); non-urgent → 72hr SLA.
5. Reference Kenyan law when relevant: Rent Restriction Act (Cap 296), Landlord and Tenant (Shops, Hotels and Catering Establishments) Act.
6. Greet in English with Swahili when appropriate ("Habari! Here's what I found…").
7. If uncertain about legal advice, recommend EARB (Estate Agents Registration Board) or Rent Tribunal, Mombasa.
8. Responses must be concise (under 200 words) and actionable.
9. Use tools when the user's intent matches a tool function — don't just suggest, call them.

M-PESA REMINDER FORMAT:
Paybill: 400200 | Reference: [TENANT CODE or UNIT NUMBER] | Amount: KES [RENT AMOUNT]`;

  return prompt;
}

class KimiAIService {
  constructor() {
    this.apiKey = process.env.KIMI_API_KEY;
    this.baseURL = process.env.KIMI_API_URL || 'https://api.moonshot.ai/v1/chat/completions';
    this.sessions = new Map();

    // Clean stale sessions every 30 minutes
    setInterval(() => {
      const cutoff = Date.now() - 30 * 60 * 1000;
      for (const [key, session] of this.sessions.entries()) {
        if (session.lastAccess < cutoff) this.sessions.delete(key);
      }
    }, 30 * 60 * 1000).unref();
  }

  _getSession(sessionId) {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = { messages: [], lastAccess: Date.now(), rateWindow: [] };
      this.sessions.set(sessionId, session);
    }
    session.lastAccess = Date.now();
    return session;
  }

  _checkRateLimit(userId) {
    const rateKey = `rate_${userId}`;
    const now = Date.now();
    const windowStart = now - 60000;
    const session = this._getSession(rateKey);
    session.rateWindow = (session.rateWindow || []).filter(t => t > windowStart);
    if (session.rateWindow.length >= 30) {
      throw Object.assign(
        new Error('Rate limit exceeded: 30 requests per minute'),
        { status: 429, code: 'RATE_LIMIT' }
      );
    }
    session.rateWindow.push(now);
  }

  async chat({ message, sessionId, userId, role: _role, context = {}, user }) {
    this._checkRateLimit(userId);

    const histKey = `hist_${sessionId}`;
    const session = this._getSession(histKey);

    const callerUser = user || { _id: userId, role: _role };
    const systemPrompt = buildSystemPrompt(callerUser, context);
    const historySlice = session.messages.slice(-20);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historySlice,
      { role: 'user', content: message }
    ];

    try {
      const payload = {
        model: 'kimi-k2.5',
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 4096,
        thinking: { type: 'enabled' }
      };

      const response = await axios.post(this.baseURL, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      let assistantMessage = response.data.choices[0].message;
      let finalResponse = assistantMessage.content || '';

      // Tool Call Loop
      if (assistantMessage.tool_calls?.length) {
        const toolMessages = [assistantMessage];

        for (const toolCall of assistantMessage.tool_calls) {
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (_) {
            args = {};
          }

          const result = await executeTool(toolCall.function.name, args, callerUser);
          logger.info('Kimi AI tool executed', { tool: toolCall.function.name, userId, result: JSON.stringify(result).slice(0, 200) });

          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }

        // Second API Call with tool outputs
        const secondPayload = {
          model: 'kimi-k2.5',
          messages: [...messages, ...toolMessages],
          temperature: 0.3,
          max_tokens: 4096
        };

        const secondResponse = await axios.post(this.baseURL, secondPayload, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        assistantMessage = secondResponse.data.choices[0].message;
        finalResponse = assistantMessage.content || finalResponse;
      }

      // Store in session
      session.messages.push({ role: 'user', content: message });
      const storeMessage = { role: 'assistant', content: finalResponse };
      if (assistantMessage.reasoning_content) {
        storeMessage.reasoning_content = assistantMessage.reasoning_content;
      }
      session.messages.push(storeMessage);

      if (session.messages.length > 40) {
        session.messages = session.messages.slice(-40);
      }

      const toolIntent = this._detectToolIntent(message);
      const tokensUsed = response.data.usage?.total_tokens || 0;

      logger.info('Kimi AI chat completed', { userId, sessionId, tokensUsed });

      return {
        response: finalResponse,
        sessionId,
        toolIntent,
        tokensUsed
      };
    } catch (err) {
      logger.error('Kimi AI request failed', { message: err.message, stack: err.stack });
      // Fallback response on failure
      const fallbackMsg = "Pole sana, I'm having trouble connecting to my brain right now. Can you please repeat that or contact admin if the issue persists?";
      return {
        response: fallbackMsg,
        sessionId,
        toolIntent: null,
        tokensUsed: 0
      };
    }
  }

  _detectToolIntent(userMessage) {
    const msg = userMessage.toLowerCase();
    const tools = [];
    if (/payment|rent|paid|arrears|receipt|mpesa|m-pesa/.test(msg)) {
      tools.push({ tool: 'get_payment_status', confidence: 0.85 });
    }
    if (/maintenance|repair|fix|broken|leak|fault|issue|problem|burst|short/.test(msg)) {
      tools.push({ tool: 'create_maintenance_ticket', confidence: 0.9 });
    }
    if (/property|building|estate|block|complex|house/.test(msg)) {
      tools.push({ tool: 'get_property_details', confidence: 0.7 });
    }
    if (/tenant|who lives|resident|occupant|renter/.test(msg)) {
      tools.push({ tool: 'get_tenant_details', confidence: 0.75 });
    }
    return tools.length > 0 ? tools : null;
  }

  getHistory(sessionId) {
    const session = this.sessions.get(`hist_${sessionId}`);
    return session ? session.messages : [];
  }

  clearHistory(sessionId) {
    this.sessions.delete(`hist_${sessionId}`);
    return { cleared: true };
  }
}

module.exports = new KimiAIService();
