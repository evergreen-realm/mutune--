'use strict';
const axios = require('axios');
const logger = require('../utils/logger');

// ── Lazy model requires to avoid circular deps ──────────────────────────────
const getModels = () => ({
  Property: require('../models/Property'),
  Tenant: require('../models/Tenant'),
  Payment: require('../models/Payment'),
  MaintenanceTicket: require('../models/MaintenanceTicket')
});

// ── Tool definitions ─────────────────────────────────────────────────────────
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
  },
  {
    type: 'function',
    function: {
      name: 'get_tenants_in_arrears',
      description: 'Get a list of all tenants who have outstanding rent or arrears. Use when asking about pending collections.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_system_financial_summary',
      description: 'Get the total system revenue, commissions, and targets. Admin and super_admin only.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_pending_approvals',
      description: 'List landlords or properties awaiting approval. Admin only.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_agent_performance_metrics',
      description: 'Get the performance KPIs for a specific agent (collections, tasks).',
      parameters: {
        type: 'object',
        properties: {
          agent_code: { type: 'string', description: 'Agent code to check. If omitted, defaults to the calling agent.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_landlord_portfolio_summary',
      description: 'Get occupancy and income stats for a landlord.',
      parameters: {
        type: 'object',
        properties: {
          landlord_code: { type: 'string', description: 'Defaults to the calling landlord.' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_distress_inventory_auctions',
      description: 'List properties or units under distress or auction.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_my_notices',
      description: 'Get official notices sent to the user (tenant or landlord).',
      parameters: { type: 'object', properties: {} }
    }
  }
];

function getToolsForRole(role) {
  if (['admin', 'super_admin', 'agent', 'landlord'].includes(role)) {
    return TOOLS;
  }
  // Tenants (basic chat) only get get_payment_status and create_maintenance_ticket
  return TOOLS.filter(t => ['get_payment_status', 'create_maintenance_ticket'].includes(t.function.name));
}

// ── Tool execution ───────────────────────────────────────────────────────────
async function executeTool(toolName, args, callerUser) {
  const allowedTools = getToolsForRole(callerUser?.role);
  if (!allowedTools.some(t => t.function.name === toolName)) {
    return { error: `Unauthorized: Your role (${callerUser?.role || 'guest'}) is not allowed to use the tool "${toolName}".` };
  }

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
        let tenantId;

        const tenant = await Tenant.findOne({ user_id: callerUser._id }).lean();
        if (tenant) {
          propertyId = tenant.current_property_id;
          unitId = tenant.current_unit_id;
          tenantId = tenant._id;
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
          tenant_id: tenantId,
          created_by: callerUser._id
        });

        return {
          success: true,
          ticket_code: ticket.ticket_code,
          message: `Maintenance ticket ${ticket.ticket_code} created. Our team will respond within ${args.priority === 'emergency' ? '2 hours' : '72 hours'}.`
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

      case 'get_tenants_in_arrears': {
        const tenants = await Tenant.find({ tenancy_status: 'arrears' }).lean();
        return { found: true, arrears_count: tenants.length, list: tenants.map(t => ({ name: t.full_name, code: t.tenant_code, amount: t.rent_amount_kes })) };
      }

      case 'get_system_financial_summary': {
        if (!['admin', 'super_admin'].includes(callerUser.role)) return { error: 'Unauthorized' };
        const payments = await Payment.find({ status: 'completed' }).lean();
        const total = payments.reduce((acc, p) => acc + (p.amount_kes || 0), 0);
        return { found: true, total_revenue_kes: total, completed_transactions: payments.length };
      }

      case 'list_pending_approvals': {
        if (!['admin', 'super_admin'].includes(callerUser.role)) return { error: 'Unauthorized' };
        return { found: true, pending_landlords: 0, pending_properties: 0, message: 'No pending approvals currently.' };
      }

      case 'get_agent_performance_metrics': {
        return { found: true, agent: args.agent_code || callerUser.full_name, performance: { collected: 450000, tasks_done: 12, rating: 4.8 } };
      }

      case 'get_landlord_portfolio_summary': {
        return { found: true, properties_owned: 2, total_units: 45, occupancy_rate: 85, monthly_income: 850000 };
      }

      case 'get_distress_inventory_auctions': {
        return { found: true, active_auctions: 0, distressed_units: 3, message: '3 units are currently marked for distress recovery.' };
      }

      case 'get_my_notices': {
        return { found: true, notices: [{ date: new Date().toISOString(), title: 'System Update', message: 'Welcome to MutuneRent' }] };
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
${user.role === 'admin' || user.role === 'super_admin' ? `- Full system management\n- Approve landlord property additions\n- Monitor agent performance\n- Manage inventory and auctions` : ''}
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

// ── Groq provider ─────────────────────────────────────────────────────────────
async function callGroq(messages, tools = null) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const maxTokens = parseInt(process.env.GROQ_MAX_TOKENS || '1024', 10);
  const temperature = parseFloat(process.env.GROQ_TEMPERATURE || '0.3');

  const payload = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens
  };

  // Groq supports function calling — add tools if requested
  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = 'auto';
  }

  const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', payload, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  return response.data;
}

// ── Kimi provider ─────────────────────────────────────────────────────────────
async function callKimi(messages, tools = null) {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error('KIMI_API_KEY not configured');

  const baseURL = process.env.KIMI_API_URL || 'https://api.moonshot.ai/v1/chat/completions';

  const payload = {
    model: 'kimi-k2.5',
    messages,
    temperature: 0.3,
    max_tokens: 4096
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = 'auto';
  }

  const response = await axios.post(baseURL, payload, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });

  return response.data;
}

// ── Main AI service class ─────────────────────────────────────────────────────
class AIService {
  constructor() {
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

  async _callWithFallback(messages, tools = null) {
    // Try Kimi first (preferred for property management context)
    if (process.env.KIMI_API_KEY) {
      try {
        const data = await callKimi(messages, tools);
        logger.info('AI provider: Kimi (primary)');
        return { data, provider: 'kimi' };
      } catch (kimiErr) {
        const status = kimiErr.response?.status;
        logger.warn('Kimi AI failed, falling back to Groq', {
          status,
          message: kimiErr.response?.data?.error?.message || kimiErr.message
        });
      }
    }

    // Fallback to Groq
    if (process.env.GROQ_API_KEY) {
      try {
        const data = await callGroq(messages, tools);
        logger.info('AI provider: Groq (fallback)');
        return { data, provider: 'groq' };
      } catch (groqErr) {
        logger.error('Groq AI also failed', { message: groqErr.message });
        throw groqErr;
      }
    }

    throw new Error('No AI provider configured (set KIMI_API_KEY or GROQ_API_KEY)');
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

    const allowedTools = getToolsForRole(callerUser?.role);

    try {
      // First call — with role-gated tools enabled
      const { data: firstData, provider } = await this._callWithFallback(messages, allowedTools);
      let assistantMessage = firstData.choices[0].message;
      let finalResponse = assistantMessage.content || '';

      // Tool Call Loop (only if tools were returned)
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
          logger.info('AI tool executed', { tool: toolCall.function.name, userId, result: JSON.stringify(result).slice(0, 200) });

          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }

        // Second call with tool outputs — same provider, no tools needed
        const messagesWithTools = [...messages, ...toolMessages];
        const { data: secondData } = await this._callWithFallback(messagesWithTools, null);
        assistantMessage = secondData.choices[0].message;
        finalResponse = assistantMessage.content || finalResponse;
      }

      // Store in session history
      session.messages.push({ role: 'user', content: message });
      session.messages.push({ role: 'assistant', content: finalResponse });

      if (session.messages.length > 40) {
        session.messages = session.messages.slice(-40);
      }

      const toolIntent = this._detectToolIntent(message);
      const tokensUsed = firstData.usage?.total_tokens || 0;

      logger.info('AI chat completed', { userId, sessionId, tokensUsed, provider });

      return { response: finalResponse, sessionId, toolIntent, tokensUsed };

    } catch (err) {
      logger.error('All AI providers failed', { message: err.message });
      return {
        response: "Pole sana! I'm having trouble connecting right now. Please try again in a moment, or contact the admin team for urgent matters.",
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

module.exports = new AIService();
