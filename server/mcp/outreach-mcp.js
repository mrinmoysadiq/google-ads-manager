// Remote MCP server for the Outreach CRM.
//
// Claude (claude.ai / desktop / mobile) connects to POST /mcp/<token> as a
// custom connector. Every tool call is forwarded to the existing
// /api/outreach REST routes, signed as the token's owner, so all validation,
// duplicate detection and non-admin lead scoping stay in one place.

const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { resolveTokenUser } = require('./tokens');

const SECRET = process.env.JWT_SECRET || 'infinix_secret_key_v2';
const PORT = process.env.PORT || 5001;
const API_BASE = `http://127.0.0.1:${PORT}/api/outreach`;

// Integer arguments also accept numeric strings: a client still holding an older copy of the
// tool list sends params it doesn't know (e.g. a newly added source_id) as text.
const intArg = () => z.coerce.number().int();

// ─── REST bridge ──────────────────────────────────────────────────────────────

function makeApi(user) {
  const bearer = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '5m' });
  return async function api(method, path, { query, body } = {}) {
    const qs = query
      ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
      : '';
    const res = await fetch(API_BASE + path + qs, {
      method,
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  };
}

const ok = data => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = message => ({ content: [{ type: 'text', text: `Error: ${message}` }], isError: true });

function tool(handler) {
  return async args => {
    try { return ok(await handler(args)); } catch (err) { return fail(err.message); }
  };
}

// Strip the heavy base64 screenshot from lead payloads before returning them to Claude.
function slimLead(lead) {
  if (!lead || typeof lead !== 'object') return lead;
  const { source_image, ...rest } = lead;
  return source_image ? { ...rest, has_source_image: true } : rest;
}

// ─── Server ───────────────────────────────────────────────────────────────────

function buildServer(user) {
  const api = makeApi(user);
  const performed_by = `${user.name} (via Claude)`;

  // GET /leads/:id enforces non-admin scoping, so call it before any write.
  const loadLead = id => api('GET', `/leads/${id}`);

  async function assertStage(stage) {
    const stages = await api('GET', '/pipeline-stages');
    const match = stages.find(s => s.name.toLowerCase() === stage.trim().toLowerCase());
    if (!match) throw new Error(`Unknown stage "${stage}". Valid stages: ${stages.map(s => s.name).join(', ')}`);
    return match.name;
  }

  // Channels are managed in the CRM; match case-insensitively and return the stored name
  async function assertChannel(channel) {
    const channels = (await api('GET', '/channels')).filter(c => c.active !== 0);
    const match = channels.find(c => c.name.toLowerCase() === channel.trim().toLowerCase());
    if (!match) throw new Error(`Unknown channel "${channel}". Valid channels: ${channels.map(c => c.name).join(', ')}`);
    return match.name;
  }

  // The stage for touchpoint N is the Nth touchpoint-type stage, whatever it's named — or,
  // when the pipeline has a single touchpoint stage, that stage for every touchpoint
  async function touchpointStage(number) {
    const stages = (await api('GET', '/pipeline-stages')).filter(s => s.active !== 0);
    const touchpointStages = stages.filter(s => s.stage_type === 'touchpoint');
    const match = stages.find(s => s.touchpoint_number === number) || (touchpointStages.length === 1 ? touchpointStages[0] : null);
    if (!match) throw new Error(`No pipeline stage is set up for touchpoint ${number}`);
    return match.name;
  }

  const server = new McpServer({ name: 'infinix-outreach-crm', version: '1.1.0' }, {
    instructions:
      `Outreach CRM for ${user.name} (${user.role === 'admin' ? 'admin — sees all leads' : 'team member — sees only their own leads'}). ` +
      'Call list_pipeline_stages / list_specialists / list_industries / list_lead_sources to get valid names and IDs before creating or moving leads. ' +
      'Use search_leads to find a lead ID by company, contact, email or phone. ' +
      'Each stage has a type. Moving a lead to a "touchpoint" stage should go through log_touchpoint; moving it to an ' +
      '"interested", "not_interested" or "meeting_lost" stage should go through log_response, so the message is recorded ' +
      'alongside the stage change.',
  });

  const leadFields = {
    company_name: z.string().optional(),
    contact_name: z.string().optional(),
    job_title: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    location: z.string().optional(),
    industry_id: intArg().optional().describe('From list_industries'),
    source_id: intArg().optional().describe('How the lead was acquired, from list_lead_sources'),
    source_url: z.string().optional().describe('Where the lead was found, e.g. a Meta Ads Library link'),
    fb_page_url: z.string().optional(),
    ig_url: z.string().optional(),
    linkedin_url: z.string().optional(),
    next_followup_date: z.string().optional().describe('YYYY-MM-DD'),
    custom_fields: z.record(z.string(), z.string().nullable()).optional()
      .describe('Map of custom field_key → value (see list_custom_fields)'),
  };

  // ── Reference data ─────────────────────────────────────────────────────────

  server.registerTool('list_pipeline_stages', {
    title: 'List pipeline stages',
    description: 'All pipeline stages in order. Lead status must be one of these names.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, tool(async () => (await api('GET', '/pipeline-stages'))
    .filter(s => s.active !== 0)
    .map(s => ({ id: s.id, name: s.name, order: s.order_index, type: s.stage_type, touchpoint_number: s.touchpoint_number || undefined }))));

  server.registerTool('list_specialists', {
    title: 'List specialists',
    description: 'Outreach specialists (sales reps) with their IDs. Leads are assigned to one or more specialists.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, tool(async () => (await api('GET', '/specialists'))
    .map(s => ({ id: s.id, name: s.name, active: !!s.active, manager: s.manager_name || null }))));

  server.registerTool('list_lead_sources', {
    title: 'List lead sources',
    description: 'How leads were acquired (e.g. Manual, Cold Email Responder, Facebook Ads, Referral) with their IDs.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, tool(async () => (await api('GET', '/sources'))
    .map(s => ({ id: s.id, name: s.name, active: s.active !== 0, leads: s.lead_count }))));

  server.registerTool('list_channels', {
    title: 'List channels',
    description: 'Outreach channels a touchpoint or reply can be logged on (e.g. LinkedIn, Email, WhatsApp).',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, tool(async () => (await api('GET', '/channels'))
    .filter(c => c.active !== 0).map(c => c.name)));

  server.registerTool('list_industries', {
    title: 'List industries',
    description: 'Industry categories with their IDs.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, tool(async () => (await api('GET', '/industries')).map(i => ({ id: i.id, name: i.name, active: i.active !== 0 }))));

  server.registerTool('create_industry', {
    title: 'Create industry',
    description: 'Add a new industry category.',
    inputSchema: { name: z.string() },
  }, tool(({ name }) => api('POST', '/industries', { body: { name } })));

  server.registerTool('list_custom_fields', {
    title: 'List custom lead fields',
    description: 'Custom fields configured for leads (field_key, label, type, options).',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, tool(async () => (await api('GET', '/custom-fields'))
    .map(f => ({ field_key: f.field_key, label: f.label, type: f.field_type, options: f.options }))));

  // ── Leads ──────────────────────────────────────────────────────────────────

  server.registerTool('search_leads', {
    title: 'Search leads',
    description: 'Find leads. Search matches company, contact, email, phone, location, job title and website. ' +
      'Results are paginated and sorted by most recent stage change by default.',
    inputSchema: {
      search: z.string().optional(),
      statuses: z.array(z.string()).optional().describe('Filter to these pipeline stages'),
      specialist_id: intArg().optional(),
      industry_id: intArg().optional(),
      source_id: intArg().optional().describe('From list_lead_sources'),
      followup_overdue: z.boolean().optional().describe('Only leads whose next follow-up date has passed'),
      created_from: z.string().optional().describe('YYYY-MM-DD, by lead created date'),
      created_to: z.string().optional().describe('YYYY-MM-DD, by lead created date'),
      sort_by: z.enum(['status_updated_at', 'created_at', 'company_name', 'contact_name', 'status', 'next_followup_date']).optional(),
      sort_dir: z.enum(['ASC', 'DESC']).optional(),
      page: intArg().min(1).optional(),
      limit: intArg().min(1).max(100).optional().describe('Default 25'),
    },
    annotations: { readOnlyHint: true },
  }, tool(async a => {
    const r = await api('GET', '/leads', {
      query: {
        search: a.search,
        status: a.statuses?.join(','),
        specialist_id: a.specialist_id,
        industry_id: a.industry_id,
        source_id: a.source_id,
        followup_overdue: a.followup_overdue ? 'true' : undefined,
        date_from: a.created_from,
        date_to: a.created_to,
        sort_by: a.sort_by || 'status_updated_at',
        sort_dir: a.sort_dir || 'DESC',
        page: a.page || 1,
        limit: a.limit || 25,
      },
    });
    return {
      total: r.total, page: r.page, total_pages: r.totalPages,
      leads: r.data.map(l => ({
        id: l.id, company_name: l.company_name, contact_name: l.contact_name, status: l.status,
        email: l.email, phone: l.phone, website: l.website, location: l.location,
        industry: l.industry_name, source: l.source_name, specialists: l.specialist_names,
        next_followup_date: l.next_followup_date, touchpoint_count: l.touchpoint_count,
        last_touchpoint_date: l.last_touchpoint_date, channels_used: l.channels_used,
        status_updated_at: l.status_updated_at, created_at: l.created_at,
      })),
    };
  }));

  server.registerTool('get_lead', {
    title: 'Get lead details',
    description: 'Full lead record including touchpoints, status history, logged responses, specialists and custom fields.',
    inputSchema: { lead_id: intArg() },
    annotations: { readOnlyHint: true },
  }, tool(async ({ lead_id }) => slimLead(await loadLead(lead_id))));

  server.registerTool('create_lead', {
    title: 'Create lead',
    description: 'Create a new lead in the first "new" stage. Rejected if another lead already has the same email, phone or Facebook page.',
    inputSchema: {
      ...leadFields,
      company_name: z.string(),
      specialist_ids: z.array(intArg()).min(1).optional()
        .describe('Assigned specialists (first is primary). Defaults to your own specialist record.'),
    },
  }, tool(async a => {
    let specialist_ids = a.specialist_ids;
    if (!specialist_ids) {
      const mine = (await api('GET', '/specialists')).find(s => s.name.toLowerCase() === user.name.toLowerCase());
      if (!mine) throw new Error('specialist_ids is required (no specialist record matches your name). Use list_specialists.');
      specialist_ids = [mine.id];
    }
    return slimLead(await api('POST', '/leads', { body: { ...a, specialist_ids, performed_by } }));
  }));

  server.registerTool('update_lead', {
    title: 'Update lead details',
    description: 'Change lead fields (contact info, follow-up date, custom fields, assigned specialists). ' +
      'Only the fields you pass are changed. To change the stage use move_lead_stage, log_touchpoint or log_response.',
    inputSchema: {
      lead_id: intArg(),
      ...leadFields,
      specialist_ids: z.array(intArg()).min(1).optional().describe('Replaces all assigned specialists'),
    },
  }, tool(async ({ lead_id, ...fields }) => {
    await loadLead(lead_id);
    return slimLead(await api('PATCH', `/leads/${lead_id}`, { body: { ...fields, performed_by } }));
  }));

  server.registerTool('move_lead_stage', {
    title: 'Move lead to stage',
    description: 'Change a lead\'s pipeline stage (recorded in status history). ' +
      'Prefer log_touchpoint for touchpoint-type stages and log_response for interested / not_interested / meeting_lost stages.',
    inputSchema: {
      lead_id: intArg(),
      stage: z.string().describe('Exact stage name from list_pipeline_stages'),
      next_followup_date: z.string().optional().describe('YYYY-MM-DD'),
    },
  }, tool(async ({ lead_id, stage, next_followup_date }) => {
    await loadLead(lead_id);
    const status = await assertStage(stage);
    const body = { status, performed_by };
    if (next_followup_date !== undefined) body.next_followup_date = next_followup_date;
    const lead = await api('PATCH', `/leads/${lead_id}`, { body });
    return { id: lead.id, company_name: lead.company_name, status: lead.status, next_followup_date: lead.next_followup_date };
  }));

  server.registerTool('log_touchpoint', {
    title: 'Log touchpoint',
    description: 'Record an outreach touchpoint (creates or overwrites touchpoint N) and, by default, move the lead to the stage for touchpoint N (see touchpoint_number in list_pipeline_stages).',
    inputSchema: {
      lead_id: intArg(),
      touchpoint_number: intArg().min(1),
      channel: z.string().describe('Channel name from list_channels'),
      date: z.string().optional().describe('YYYY-MM-DD, defaults to today'),
      message_body: z.string().optional(),
      loom_url: z.string().optional(),
      notes: z.string().optional(),
      move_to_stage: z.boolean().optional().describe('Default true'),
      next_followup_date: z.string().optional().describe('YYYY-MM-DD'),
    },
  }, tool(async a => {
    await loadLead(a.lead_id);
    const channel = await assertChannel(a.channel);
    // Resolve the stage first so a missing stage doesn't leave a half-done write
    const stage = a.move_to_stage !== false ? await touchpointStage(a.touchpoint_number) : null;
    const touchpoint = await api('PUT', `/leads/${a.lead_id}/touchpoints/${a.touchpoint_number}`, {
      body: {
        date: a.date || new Date().toISOString().slice(0, 10),
        channel, message_body: a.message_body, loom_url: a.loom_url, notes: a.notes,
      },
    });
    const body = {};
    if (stage) body.status = stage;
    if (a.next_followup_date !== undefined) body.next_followup_date = a.next_followup_date;
    let lead = null;
    if (Object.keys(body).length) lead = await api('PATCH', `/leads/${a.lead_id}`, { body: { ...body, performed_by } });
    return { touchpoint, lead: lead && { id: lead.id, status: lead.status, next_followup_date: lead.next_followup_date } };
  }));

  server.registerTool('log_response', {
    title: 'Log lead response',
    description: 'Record a reply received from a lead and optionally move it to a new stage (e.g. Interested, Not Interested, Appointment Booked).',
    inputSchema: {
      lead_id: intArg(),
      channel: z.string().describe('Where they replied — a channel name from list_channels'),
      message_body: z.string().describe('What the lead said'),
      date: z.string().optional().describe('YYYY-MM-DD, defaults to today'),
      notes: z.string().optional(),
      new_stage: z.string().optional().describe('Stage to move the lead to, from list_pipeline_stages'),
    },
  }, tool(async a => {
    await loadLead(a.lead_id);
    const channel = await assertChannel(a.channel);
    const status = a.new_stage ? await assertStage(a.new_stage) : null;
    const response = await api('POST', `/leads/${a.lead_id}/responses`, {
      body: { date: a.date || new Date().toISOString().slice(0, 10), channel, message_body: a.message_body, notes: a.notes },
    });
    let lead = null;
    if (status) lead = await api('PATCH', `/leads/${a.lead_id}`, { body: { status, performed_by } });
    return { response, lead: lead && { id: lead.id, status: lead.status } };
  }));

  server.registerTool('delete_lead', {
    title: 'Delete lead',
    description: 'Move a lead to the trash (it can be restored from the web app).',
    inputSchema: { lead_id: intArg() },
    annotations: { destructiveHint: true },
  }, tool(async ({ lead_id }) => {
    const lead = await loadLead(lead_id);
    await api('DELETE', `/leads/${lead_id}`);
    return { deleted: true, id: lead_id, company_name: lead.company_name };
  }));

  // ── Reporting ──────────────────────────────────────────────────────────────

  server.registerTool('get_dashboard', {
    title: 'Pipeline dashboard',
    description: 'Pipeline metrics: totals, response/interested/appointment/close rates, count per stage, per channel and per specialist. ' +
      'Dates filter by when the lead last changed stage.',
    inputSchema: {
      date_from: z.string().optional().describe('YYYY-MM-DD'),
      date_to: z.string().optional().describe('YYYY-MM-DD'),
      specialist_id: intArg().optional(),
    },
    annotations: { readOnlyHint: true },
  }, tool(a => api('GET', '/dashboard', { query: a })));

  server.registerTool('get_overdue_followups', {
    title: 'Overdue follow-ups',
    description: 'Leads whose next follow-up date has passed and are not closed, dead or lost.',
    inputSchema: { specialist_id: intArg().optional() },
    annotations: { readOnlyHint: true },
  }, tool(a => api('GET', '/overdue', { query: a })));

  server.registerTool('get_activity', {
    title: 'Daily activity',
    description: 'New leads created and stage moves in a date range, by stage and by specialist. Defaults to yesterday.',
    inputSchema: {
      date_from: z.string().optional().describe('YYYY-MM-DD'),
      date_to: z.string().optional().describe('YYYY-MM-DD'),
      specialist_id: intArg().optional(),
    },
    annotations: { readOnlyHint: true },
  }, tool(a => api('GET', '/activity', { query: a })));

  return server;
}

// ─── Express handler: app.all('/mcp/:token', handleMcpRequest) ─────────────────

async function handleMcpRequest(req, res) {
  const user = resolveTokenUser(req.params.token);
  if (!user) {
    return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Invalid or revoked connector token' }, id: null });
  }
  if (req.method !== 'POST') {
    // Stateless server: no SSE stream or session to resume/terminate.
    return res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
  }
  try {
    const server = buildServer(user);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP error:', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
}

module.exports = { handleMcpRequest };
