const { parseLlmJson, callOpenAIChatCompletions, getOpenAIConfig } = require('./openai');
const { parseIntent, isComplexQuestion } = require('./aiChatIntents');
const {
  resolveClientByName,
  resolveCompanyByName,
  countInvoicesByClient,
  countInvoicesByCompany,
  getInvoiceTotalByClient,
  getInvoiceTotalByCompany,
  sumInvoiceAmountByPeriod,
  getInvoiceSummaryByClientPeriod,
  getOutstandingSummary,
  searchClients,
  getWorkspaceStats,
  getRecurringBillsSummary,
  getImportedInvoicesSummary,
  countInvoicesInPeriod,
  listInvoices,
  formatInr,
  monthLabel,
  periodToDateRange,
  isValidPeriod
} = require('./aiChatQueries');

const SUGGESTED_PROMPTS = [
  'How many invoices this month?',
  'Total invoice amount in June 2026',
  'Which invoices are unpaid?',
  'Total amount for ANIL JAIN & ASSOCIATES'
];

function getAiChatConfig() {
  const enabled = String(process.env.AI_CHAT_ENABLED || '1').trim() !== '0';
  const dailyLimit = Math.max(1, parseInt(process.env.AI_CHAT_DAILY_LIMIT || '50', 10) || 50);
  const maxTokens = Math.min(800, Math.max(50, parseInt(process.env.AI_CHAT_MAX_TOKENS || '300', 10) || 300));
  const timeoutMs = Math.min(20000, Math.max(3000, Number(process.env.AI_CHAT_TIMEOUT_MS || 8000)));
  return { enabled, dailyLimit, maxTokens, timeoutMs };
}

function initAiChatTables(emailDb) {
  emailDb.exec(`
    CREATE TABLE IF NOT EXISTS ai_chat_usage (
      workspaceId TEXT NOT NULL,
      usageDate TEXT NOT NULL,
      messageCount INTEGER DEFAULT 0,
      PRIMARY KEY (workspaceId, usageDate)
    );
  `);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getUsageCount(emailDb, workspaceId) {
  const row = emailDb.prepare(`
    SELECT messageCount FROM ai_chat_usage WHERE workspaceId = ? AND usageDate = ?
  `).get(workspaceId, todayKey());
  return row?.messageCount || 0;
}

function incrementUsage(emailDb, workspaceId) {
  emailDb.prepare(`
    INSERT INTO ai_chat_usage (workspaceId, usageDate, messageCount)
    VALUES (?, ?, 1)
    ON CONFLICT(workspaceId, usageDate) DO UPDATE SET messageCount = messageCount + 1
  `).run(workspaceId, todayKey());
}

function checkRateLimit(emailDb, workspaceId) {
  const { dailyLimit } = getAiChatConfig();
  return getUsageCount(emailDb, workspaceId) < dailyLimit;
}

function listWorkspaceClients(db, workspaceId) {
  return db.prepare('SELECT id, name FROM clients WHERE workspaceId = ?').all(workspaceId);
}

function listWorkspaceCompanies(db, workspaceId) {
  return db.prepare('SELECT id, name FROM companies WHERE workspaceId = ?').all(workspaceId);
}

function resolveCompany(db, workspaceId, companyHint) {
  const result = resolveCompanyByName(db, workspaceId, companyHint);
  if (result.status === 'matched') {
    return { ok: true, company: result.company };
  }
  if (result.status === 'ambiguous') {
    return {
      ok: false,
      reply: `I found multiple companies matching "${result.query}". Please be more specific:\n${result.matches.map((c) => `• ${c.name}`).join('\n')}`,
      source: 'template',
      data: { ambiguousCompanies: result.matches }
    };
  }
  if (result.status === 'not_found') {
    return {
      ok: false,
      reply: `I could not find a company matching "${companyHint}". Check the spelling or open the Companies page.`,
      source: 'template',
      data: { companyHint }
    };
  }
  return {
    ok: false,
    reply: 'Please specify which company you mean.',
    source: 'template'
  };
}

function sanitizeClassifiedParams(params) {
  const next = { ...params };
  if (next.year != null && next.month != null && isValidPeriod(next.year, next.month)) {
    next.period = { year: Number(next.year), month: Number(next.month) };
  } else {
    delete next.year;
    delete next.month;
    delete next.period;
  }
  return next;
}

function resolveClient(db, workspaceId, clientHint) {
  const result = resolveClientByName(db, workspaceId, clientHint);
  if (result.status === 'matched') {
    return { ok: true, client: result.client };
  }
  if (result.status === 'ambiguous') {
    return {
      ok: false,
      reply: `I found multiple clients matching "${result.query}". Please be more specific:\n${result.matches.map((c) => `• ${c.name}`).join('\n')}`,
      source: 'template',
      data: { ambiguousClients: result.matches }
    };
  }
  if (result.status === 'not_found') {
    return {
      ok: false,
      reply: `I could not find a client matching "${clientHint}". Check the spelling or open the Clients page.`,
      source: 'template',
      data: { clientHint }
    };
  }
  return {
    ok: false,
    reply: 'Please specify which client you mean.',
    source: 'template'
  };
}

function buildInvoiceLinks({
  invoices = [],
  clientId,
  clientName,
  companyId,
  companyName,
  maxInvoiceLinks = 5
}) {
  const links = [];
  const filterLinks = [];

  if (clientId && clientName) {
    filterLinks.push({
      label: `View all invoices for ${clientName}`,
      href: `/invoices?client=${clientId}`
    });
  }
  if (companyId && companyName) {
    filterLinks.push({
      label: `View all invoices for ${companyName}`,
      href: `/invoices?company=${companyId}`
    });
  }

  const invoiceLinks = invoices.slice(0, maxInvoiceLinks).map((inv) => ({
    label: `${inv.invoiceNumber} — ${formatInr(inv.total)}`,
    href: `/invoice/${inv.id}`
  }));

  if (invoiceLinks.length === 1) {
    return [...invoiceLinks, ...filterLinks];
  }
  if (invoiceLinks.length > 1) {
    return [...filterLinks, ...invoiceLinks];
  }
  return filterLinks;
}

function formatTemplateReply(intent, data, message) {
  switch (intent) {
    case 'invoice_count_by_client':
      return `You have issued ${data.count} invoice${data.count === 1 ? '' : 's'} to ${data.clientName}${data.periodLabel ? ` ${data.periodLabel}` : ''}. Use the links below to open invoices.`;

    case 'list_invoices_by_client':
      if (data.count === 0) {
        return `No invoices found for ${data.clientName}${data.periodLabel ? ` ${data.periodLabel}` : ''}.`;
      }
      return `Found ${data.count} invoice${data.count === 1 ? '' : 's'} for ${data.clientName}${data.periodLabel ? ` ${data.periodLabel}` : ''}. Use the links below to open them.`;

    case 'list_invoices_by_company':
      if (data.count === 0) {
        return `No invoices found for company ${data.companyName}${data.periodLabel ? ` ${data.periodLabel}` : ''}.`;
      }
      return `Found ${data.count} invoice${data.count === 1 ? '' : 's'} for company ${data.companyName}${data.periodLabel ? ` ${data.periodLabel}` : ''}. Use the links below to open them.`;

    case 'invoice_amount_by_period':
      return `In ${data.periodLabel}, you issued ${data.count} invoice${data.count === 1 ? '' : 's'} totaling ${formatInr(data.total)}.`;

    case 'invoice_count_by_period':
      return `In ${data.periodLabel}, you issued ${data.count} invoice${data.count === 1 ? '' : 's'}.`;

    case 'invoice_summary_by_client_period':
      return `For ${data.clientName} in ${data.periodLabel}: ${data.count} invoice${data.count === 1 ? '' : 's'}, total ${formatInr(data.total)}. Use the links below to open invoices.`;

    case 'invoice_total_by_client':
      return `Total for ${data.clientName}: ${data.count} invoice${data.count === 1 ? '' : 's'}, ${formatInr(data.total)}. Use the links below to open invoices.`;

    case 'invoice_count_by_company':
      return `Company ${data.companyName} has ${data.count} invoice${data.count === 1 ? '' : 's'}${data.periodLabel ? ` ${data.periodLabel}` : ''}. Use the links below to open invoices.`;

    case 'invoice_total_by_company':
      return `Company ${data.companyName}: ${data.count} invoice${data.count === 1 ? '' : 's'}, total ${formatInr(data.total)}. Use the links below to open invoices.`;

    case 'outstanding_summary':
      if (data.count === 0) {
        return 'All invoices are marked as paid. No outstanding amount.';
      }
      return `You have ${data.count} unpaid invoice${data.count === 1 ? '' : 's'} totaling ${formatInr(data.total)}.`;

    case 'client_search':
      if (!data.clients.length) {
        return `No clients found matching "${data.query}".`;
      }
      return `Found ${data.clients.length} client${data.clients.length === 1 ? '' : 's'}:\n${data.clients.map((c) => `• ${c.name}${c.city ? ` (${c.city})` : ''}${c.state ? `, ${c.state}` : ''}`).join('\n')}`;

    case 'workspace_stats':
      return `Workspace summary: ${data.clientCount} clients, ${data.companyCount} companies, ${data.invoiceCount} invoices. Paid: ${data.paidCount} (${formatInr(data.paidTotal)}). Unpaid: ${data.unpaidCount} (${formatInr(data.unpaidTotal)}).`;

    case 'recurring_bills_summary': {
      const active = data.active?.length || 0;
      if (active === 0) {
        return 'No active recurring bills.';
      }
      const lines = data.active.slice(0, 5).map(
        (r) => `• ${r.name} (${r.frequency}, next: ${r.nextRunDate || '—'})`
      );
      return `You have ${active} active recurring bill${active === 1 ? '' : 's'}:\n${lines.join('\n')}`;
    }

    case 'imported_invoices_summary': {
      if (!data.total) {
        return 'No imported invoices in this workspace.';
      }
      const parts = (data.byStatus || []).map((r) => `${r.status}: ${r.count}`).join(', ');
      return `Imported invoices: ${data.total} total (${parts}).`;
    }

    default:
      return null;
  }
}

async function classifyWithLlm(message, apiKey, baseUrl, model, timeoutMs, maxTokens) {
  const content = await callOpenAIChatCompletions({
    apiKey,
    baseUrl,
    model,
    timeoutMs,
    maxTokens,
    temperature: 0,
    systemContent: 'Classify the user message for an Indian invoice app. Return only JSON: {"intent":"invoice_count_by_client|invoice_total_by_client|list_invoices_by_client|invoice_amount_by_period|invoice_summary_by_client_period|invoice_count_by_company|invoice_total_by_company|list_invoices_by_company|outstanding_summary|client_search|workspace_stats|recurring_bills_summary|imported_invoices_summary|general|unknown","clientHint":string|null,"companyHint":string|null,"year":number|null,"month":number|null,"state":string|null}. Use company intents when user says company. Use list_invoices_by_client when user wants to show/view all invoices for a client.',
    prompt: message
  });
  return parseLlmJson(content);
}

async function polishWithLlm({ message, data, apiKey, baseUrl, model, timeoutMs, maxTokens }) {
  const content = await callOpenAIChatCompletions({
    apiKey,
    baseUrl,
    model,
    timeoutMs,
    maxTokens,
    temperature: 0.2,
    systemContent: 'You answer questions for an Indian CA firm invoice app. Use ONLY numbers and facts from the DATA JSON. Do not invent figures. Be concise (2-4 sentences). Use INR formatting when mentioning amounts.',
    prompt: `User question: ${message}\n\nDATA:\n${JSON.stringify(data)}`
  });
  return String(content || '').trim();
}

async function answerGeneral(message, history, apiKey, baseUrl, model, timeoutMs, maxTokens) {
  const systemContent = `You help users of an Indian invoice generation app for CA firms. Answer questions about GST basics (CGST, SGST, IGST), invoicing workflow, and how to use features: Clients, Companies, New Invoice, Recurring Bills, Imported Invoices, Email. Be concise. If you do not know workspace-specific numbers, say to ask a data question like "how many invoices in June". Do not make up invoice counts or amounts.`;

  const messages = [{ role: 'system', content: systemContent }];
  for (const h of history.slice(-4)) {
    if (h?.role && h?.content) {
      messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content) });
    }
  }
  messages.push({ role: 'user', content: message });

  const content = await callOpenAIChatCompletions({
    apiKey,
    baseUrl,
    model,
    timeoutMs,
    maxTokens,
    temperature: 0.3,
    messages
  });
  return String(content || '').trim();
}

async function executeDataIntent(db, importedDb, workspaceId, intent, params) {
  const periodRange = () => {
    if (params.period && isValidPeriod(params.period.year, params.period.month)) {
      const range = periodToDateRange(params.period.year, params.period.month);
      return {
        fromDate: range.fromDate,
        toDate: range.toDate,
        periodLabel: `in ${monthLabel(params.period.year, params.period.month)}`
      };
    }
    return { fromDate: undefined, toDate: undefined, periodLabel: '' };
  };

  switch (intent) {
    case 'invoice_count_by_client': {
      const resolved = resolveClient(db, workspaceId, params.clientHint);
      if (!resolved.ok) return resolved;
      const { fromDate, toDate, periodLabel } = periodRange();
      const { count } = countInvoicesByClient(db, workspaceId, {
        clientId: resolved.client.id,
        fromDate,
        toDate
      });
      const invoices = listInvoices(db, workspaceId, {
        clientId: resolved.client.id,
        fromDate,
        toDate,
        limit: count === 1 ? 1 : 5
      });
      return {
        intent,
        data: {
          count,
          clientName: resolved.client.name,
          clientId: resolved.client.id,
          periodLabel,
          invoices
        },
        complex: false
      };
    }

    case 'list_invoices_by_client': {
      const resolved = resolveClient(db, workspaceId, params.clientHint);
      if (!resolved.ok) return resolved;
      const { fromDate, toDate, periodLabel } = periodRange();
      const { count } = countInvoicesByClient(db, workspaceId, {
        clientId: resolved.client.id,
        fromDate,
        toDate
      });
      const invoices = listInvoices(db, workspaceId, {
        clientId: resolved.client.id,
        fromDate,
        toDate,
        limit: 10
      });
      return {
        intent,
        data: {
          count,
          clientName: resolved.client.name,
          clientId: resolved.client.id,
          periodLabel,
          invoices
        },
        complex: false
      };
    }

    case 'invoice_amount_by_period': {
      if (!isValidPeriod(params.year, params.month)) {
        return {
          ok: false,
          reply: 'Please specify a valid month, e.g. "total invoice amount in June 2026".',
          source: 'template'
        };
      }
      const summary = sumInvoiceAmountByPeriod(db, workspaceId, {
        year: params.year,
        month: params.month
      });
      return {
        intent,
        data: {
          count: summary.count,
          total: summary.total,
          periodLabel: monthLabel(params.year, params.month)
        },
        complex: false
      };
    }

    case 'invoice_count_by_period': {
      if (!isValidPeriod(params.year, params.month)) {
        return {
          ok: false,
          reply: 'Please specify a valid month, e.g. "how many invoices in June 2026".',
          source: 'template'
        };
      }
      const summary = countInvoicesInPeriod(db, workspaceId, {
        year: params.year,
        month: params.month
      });
      return {
        intent,
        data: {
          count: summary.count,
          periodLabel: monthLabel(params.year, params.month)
        },
        complex: false
      };
    }

    case 'invoice_summary_by_client_period': {
      const resolved = resolveClient(db, workspaceId, params.clientHint);
      if (!resolved.ok) return resolved;
      if (!isValidPeriod(params.year, params.month)) {
        return {
          ok: false,
          reply: 'Please specify a valid month and year, e.g. "invoices to Acme in June 2026".',
          source: 'template'
        };
      }
      const summary = getInvoiceSummaryByClientPeriod(db, workspaceId, {
        clientId: resolved.client.id,
        year: params.year,
        month: params.month
      });
      const { fromDate, toDate } = periodToDateRange(params.year, params.month);
      const invoices = listInvoices(db, workspaceId, {
        clientId: resolved.client.id,
        fromDate,
        toDate,
        limit: 5
      });
      return {
        intent,
        data: {
          count: summary.count,
          total: summary.total,
          clientName: summary.clientName,
          clientId: resolved.client.id,
          periodLabel: monthLabel(params.year, params.month),
          invoices
        },
        complex: false
      };
    }

    case 'invoice_total_by_client': {
      const resolved = resolveClient(db, workspaceId, params.clientHint);
      if (!resolved.ok) return resolved;
      const summary = getInvoiceTotalByClient(db, workspaceId, resolved.client.id);
      const invoices = listInvoices(db, workspaceId, {
        clientId: resolved.client.id,
        limit: summary.count === 1 ? 1 : 5
      });
      return {
        intent,
        data: {
          ...summary,
          clientId: resolved.client.id,
          invoices
        },
        complex: false
      };
    }

    case 'invoice_count_by_company': {
      const resolved = resolveCompany(db, workspaceId, params.companyHint);
      if (!resolved.ok) return resolved;
      const { fromDate, toDate, periodLabel } = periodRange();
      const { count } = countInvoicesByCompany(db, workspaceId, {
        companyId: resolved.company.id,
        fromDate,
        toDate
      });
      const invoices = listInvoices(db, workspaceId, {
        companyId: resolved.company.id,
        fromDate,
        toDate,
        limit: count === 1 ? 1 : 5
      });
      return {
        intent,
        data: {
          count,
          companyName: resolved.company.name,
          companyId: resolved.company.id,
          periodLabel,
          invoices
        },
        complex: false
      };
    }

    case 'list_invoices_by_company': {
      const resolved = resolveCompany(db, workspaceId, params.companyHint);
      if (!resolved.ok) return resolved;
      const { fromDate, toDate, periodLabel } = periodRange();
      const { count } = countInvoicesByCompany(db, workspaceId, {
        companyId: resolved.company.id,
        fromDate,
        toDate
      });
      const invoices = listInvoices(db, workspaceId, {
        companyId: resolved.company.id,
        fromDate,
        toDate,
        limit: 10
      });
      return {
        intent,
        data: {
          count,
          companyName: resolved.company.name,
          companyId: resolved.company.id,
          periodLabel,
          invoices
        },
        complex: false
      };
    }

    case 'invoice_total_by_company': {
      const resolved = resolveCompany(db, workspaceId, params.companyHint);
      if (!resolved.ok) return resolved;
      const summary = getInvoiceTotalByCompany(db, workspaceId, resolved.company.id);
      const invoices = listInvoices(db, workspaceId, {
        companyId: resolved.company.id,
        limit: summary.count === 1 ? 1 : 5
      });
      return {
        intent,
        data: {
          ...summary,
          companyId: resolved.company.id,
          invoices
        },
        complex: false
      };
    }

    case 'outstanding_summary': {
      const data = getOutstandingSummary(db, workspaceId);
      return { intent, data, complex: data.count > 0 && data.recent?.length > 3 };
    }

    case 'client_search': {
      const clients = searchClients(db, workspaceId, {
        name: params.name,
        state: params.state,
        city: params.city
      });
      return {
        intent,
        data: { clients, query: params.state || params.name || params.city || '' },
        complex: clients.length > 8
      };
    }

    case 'workspace_stats': {
      const data = getWorkspaceStats(db, workspaceId);
      return { intent, data, complex: false };
    }

    case 'recurring_bills_summary': {
      const data = getRecurringBillsSummary(db, workspaceId);
      return { intent, data, complex: (data.active?.length || 0) > 5 };
    }

    case 'imported_invoices_summary': {
      const data = getImportedInvoicesSummary(importedDb, workspaceId);
      return { intent, data, complex: false };
    }

    default:
      return null;
  }
}

async function handleChatMessage({ db, importedDb, emailDb, workspaceId, message, history }) {
  const { enabled, dailyLimit, maxTokens, timeoutMs } = getAiChatConfig();
  if (!enabled) {
    return {
      reply: 'Ask AI is currently disabled.',
      source: 'template',
      suggestedPrompts: SUGGESTED_PROMPTS
    };
  }

  const trimmed = String(message || '').trim();
  if (!trimmed) {
    return {
      reply: 'Please enter a question.',
      source: 'template',
      suggestedPrompts: SUGGESTED_PROMPTS
    };
  }

  const clients = listWorkspaceClients(db, workspaceId);
  const companies = listWorkspaceCompanies(db, workspaceId);
  let parsed = parseIntent(trimmed, clients, companies);
  const { apiKey, model, baseUrl } = getOpenAIConfig();
  const hasOpenAi = apiKey.length > 0;

  let usedLlm = false;

  if (parsed.intent === 'unknown' && hasOpenAi) {
    if (!checkRateLimit(emailDb, workspaceId)) {
      return {
        reply: `Daily AI limit reached (${dailyLimit} messages). Data questions with simple counts may still work tomorrow.`,
        source: 'template'
      };
    }
    try {
      const classified = await classifyWithLlm(trimmed, apiKey, baseUrl, model, timeoutMs, maxTokens);
      incrementUsage(emailDb, workspaceId);
      usedLlm = true;
      if (classified?.intent && classified.intent !== 'unknown') {
        parsed = {
          intent: classified.intent,
          confidence: 0.7,
          params: sanitizeClassifiedParams({
            clientHint: classified.clientHint || null,
            companyHint: classified.companyHint || null,
            year: classified.year ?? null,
            month: classified.month ?? null,
            state: classified.state || null,
            name: classified.state || null
          })
        };
      }
    } catch (_) {
      // fall through to unknown handler
    }
  }

  if (parsed.intent === 'general') {
    if (!hasOpenAi) {
      return {
        reply: 'I can answer workspace data questions (e.g. "How many invoices in June?"). General AI answers need OPENAI_API_KEY on the server.',
        source: 'template',
        suggestedPrompts: SUGGESTED_PROMPTS
      };
    }
    if (!checkRateLimit(emailDb, workspaceId)) {
      return {
        reply: `Daily AI limit reached (${dailyLimit} messages). Try again tomorrow.`,
        source: 'template'
      };
    }
    try {
      const reply = await answerGeneral(trimmed, history, apiKey, baseUrl, model, timeoutMs, maxTokens);
      incrementUsage(emailDb, workspaceId);
      return { reply, source: 'general' };
    } catch (err) {
      return {
        reply: `Could not get an AI answer: ${err.message}`,
        source: 'template'
      };
    }
  }

  if (parsed.intent === 'unknown') {
    return {
      reply: 'I am not sure how to answer that. Try one of these:',
      source: 'template',
      suggestedPrompts: SUGGESTED_PROMPTS
    };
  }

  const result = await executeDataIntent(db, importedDb, workspaceId, parsed.intent, parsed.params);
  if (!result) {
    return {
      reply: 'I could not fetch that data.',
      source: 'template',
      suggestedPrompts: SUGGESTED_PROMPTS
    };
  }
  if (result.reply) {
    return { reply: result.reply, source: result.source || 'template', data: result.data };
  }

  const showInvoiceLinks =
    parsed.intent === 'list_invoices_by_client' ||
    parsed.intent === 'list_invoices_by_company' ||
    result.data?.count === 1;

  const links = buildInvoiceLinks({
    invoices: showInvoiceLinks ? result.data?.invoices || [] : [],
    clientId: result.data?.clientId,
    clientName: result.data?.clientName,
    companyId: result.data?.companyId,
    companyName: result.data?.companyName,
    maxInvoiceLinks:
      parsed.intent === 'list_invoices_by_client' || parsed.intent === 'list_invoices_by_company'
        ? 5
        : 1
  });

  const usePolish =
    hasOpenAi &&
    (isComplexQuestion(trimmed) || result.complex) &&
    checkRateLimit(emailDb, workspaceId);

  if (usePolish) {
    try {
      const reply = await polishWithLlm({
        message: trimmed,
        data: result.data,
        apiKey,
        baseUrl,
        model,
        timeoutMs,
        maxTokens
      });
      incrementUsage(emailDb, workspaceId);
      usedLlm = true;
      return { reply, source: 'llm', data: result.data, intent: parsed.intent, links };
    } catch (_) {
      // fall back to template
    }
  }

  const templateReply = formatTemplateReply(parsed.intent, result.data, trimmed);
  return {
    reply: templateReply || 'Here is what I found.',
    source: 'template',
    data: result.data,
    intent: parsed.intent,
    links,
    usedLlm
  };
}

function registerAiChatRoutes({ app, db, importedDb, emailDb, requireAuth }) {
  const auth = requireAuth || ((req, res, next) => next());
  initAiChatTables(emailDb);

  app.get('/api/ai/chat/status', auth, (req, res) => {
    try {
      const { enabled, dailyLimit } = getAiChatConfig();
      const { apiKey } = getOpenAIConfig();
      const used = getUsageCount(emailDb, req.workspaceId);
      res.json({
        enabled,
        openaiConfigured: apiKey.length > 0,
        dailyLimit,
        usedToday: used,
        remainingToday: Math.max(0, dailyLimit - used),
        suggestedPrompts: SUGGESTED_PROMPTS
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/ai/chat', auth, async (req, res) => {
    try {
      const message = String(req.body?.message || '').trim();
      const history = Array.isArray(req.body?.history) ? req.body.history.slice(-4) : [];
      const result = await handleChatMessage({
        db,
        importedDb,
        emailDb,
        workspaceId: req.workspaceId,
        message,
        history
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = {
  registerAiChatRoutes,
  initAiChatTables,
  handleChatMessage,
  formatTemplateReply,
  buildInvoiceLinks,
  getAiChatConfig,
  getUsageCount,
  incrementUsage,
  checkRateLimit,
  SUGGESTED_PROMPTS
};
