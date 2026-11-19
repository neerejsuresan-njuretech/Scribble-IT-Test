import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  runWikiSearchGrounding,
  triageIncidentWithAi,
  assessChangeWithAi,
  draftKbArticleWithAi,
  runItsmCopilotTurn,
  runIncidentTriageAssistant,
  type WikiGroundingMode,
  type CopilotTurnMessage,
  type TriageAssistantKbCandidate,
} from './server/gemini.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function sendGeminiError(res: Response, err: unknown, fallbackMessage: string) {
  const rawMessage = err instanceof Error ? err.message : fallbackMessage;
  let status = 500;
  let message = rawMessage;

  if (/GEMINI_API_KEY is not configured/i.test(rawMessage)) {
    status = 503;
  } else if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(rawMessage)) {
    status = 403;
    message = 'Gemini API authentication failed. Please verify the API key configured in Settings > Secrets.';
  } else if (/RESOURCE_EXHAUSTED|429/i.test(rawMessage)) {
    status = 429;
    message = 'Gemini API rate limit reached. Please retry shortly or check quota in Settings > Secrets.';
  } else if (/NOT_FOUND|404/i.test(rawMessage)) {
    status = 502;
    message = 'Configured Gemini model was unavailable upstream.';
  }

  res.status(status).json({ error: message });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', (req, res, next) => {
    const allowedOrigin = process.env.ALLOWED_ORIGIN?.trim();
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'scribble-it-server', timestamp: new Date().toISOString() });
  });

  app.post('/api/wiki/grounding', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        query?: string;
        mode?: WikiGroundingMode;
        existingTitle?: string;
        existingSection?: string;
        existingContent?: string;
      };

      const mode: WikiGroundingMode =
        body.mode === 'industry_news' || body.mode === 'page_refresh'
          ? body.mode
          : 'documentation_update';

      const query = (body.query || '').trim();
      if (!query && mode !== 'page_refresh') {
        res.status(400).json({ error: 'A search topic or question is required.' });
        return;
      }
      if (mode === 'page_refresh' && !query && !body.existingTitle?.trim()) {
        res.status(400).json({ error: 'Select a wiki page or provide a search query to check for updates.' });
        return;
      }

      const result = await runWikiSearchGrounding({
        query,
        mode,
        existingTitle: body.existingTitle,
        existingSection: body.existingSection,
        existingContent: body.existingContent,
      });

      res.json(result);
    } catch (err) {
      sendGeminiError(res, err, 'Failed to fetch Google Search grounded update.');
    }
  });

  app.post('/api/ai/triage-incident', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        id?: string;
        title?: string;
        description?: string;
        category?: string;
        priority?: string;
        affectedCI?: string;
        recentActivity?: string[];
        availableQueues?: string[];
      };
      if (!body.title?.trim() && !body.description?.trim()) {
        res.status(400).json({ error: 'Provide an incident title or description for AI triage.' });
        return;
      }

      const result = await triageIncidentWithAi({
        id: body.id,
        title: (body.title || '').trim(),
        description: (body.description || '').trim(),
        category: body.category,
        priority: body.priority,
        affectedCI: body.affectedCI,
        recentActivity: body.recentActivity,
        availableQueues: Array.isArray(body.availableQueues) ? body.availableQueues : undefined,
      });
      res.json(result);
    } catch (err) {
      sendGeminiError(res, err, 'Incident AI triage failed.');
    }
  });

  app.post('/api/ai/assess-change', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        id?: string;
        title?: string;
        type?: string;
        reason?: string;
        implementationPlan?: string;
        rollbackPlan?: string;
        testPlan?: string;
      };
      if (!body.title?.trim()) {
        res.status(400).json({ error: 'Change Request title is required for AI CAB assessment.' });
        return;
      }

      const result = await assessChangeWithAi({
        id: body.id,
        title: body.title.trim(),
        type: body.type || 'normal',
        reason: body.reason || '',
        implementationPlan: body.implementationPlan || '',
        rollbackPlan: body.rollbackPlan || '',
        testPlan: body.testPlan || '',
      });
      res.json(result);
    } catch (err) {
      sendGeminiError(res, err, 'Change Request CAB assessment failed.');
    }
  });

  app.post('/api/ai/draft-kb', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        topic?: string;
        category?: string;
        sourceIncidentTitle?: string;
        sourceIncidentDescription?: string;
        sourceResolution?: string;
      };
      const topic = (body.topic || body.sourceIncidentTitle || '').trim();
      if (!topic) {
        res.status(400).json({ error: 'Provide a topic or incident summary to draft a Knowledge Base article.' });
        return;
      }

      const result = await draftKbArticleWithAi({
        topic,
        category: body.category,
        sourceIncidentTitle: body.sourceIncidentTitle,
        sourceIncidentDescription: body.sourceIncidentDescription,
        sourceResolution: body.sourceResolution,
      });
      res.json(result);
    } catch (err) {
      sendGeminiError(res, err, 'Knowledge Base AI drafting failed.');
    }
  });

  app.post('/api/ai/copilot', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        message?: string;
        history?: CopilotTurnMessage[];
        tenantContext?: string;
      };
      const message = (body.message || '').trim();
      if (!message) {
        res.status(400).json({ error: 'Enter a prompt for the ITSM Copilot.' });
        return;
      }

      const result = await runItsmCopilotTurn({
        message,
        history: Array.isArray(body.history) ? body.history : [],
        tenantContext: body.tenantContext || 'No active records in tenant.',
      });
      res.json(result);
    } catch (err) {
      sendGeminiError(res, err, 'AI Copilot failed to respond.');
    }
  });

  app.post('/api/ai/triage-assistant', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        id?: string;
        title?: string;
        description?: string;
        priority?: string;
        status?: string;
        category?: string;
        assignmentGroup?: string;
        affectedCI?: string;
        slaDeadline?: string;
        recentActivity?: string[];
        kbArticles?: TriageAssistantKbCandidate[];
      };

      if (!body.id?.trim() || (!body.title?.trim() && !body.description?.trim())) {
        res.status(400).json({ error: 'Selected incident ID and details are required for Triage Assistant.' });
        return;
      }

      const result = await runIncidentTriageAssistant({
        id: body.id.trim(),
        title: (body.title || '').trim(),
        description: (body.description || '').trim(),
        priority: body.priority || 'P3',
        status: body.status || 'new',
        category: body.category || 'software',
        assignmentGroup: body.assignmentGroup,
        affectedCI: body.affectedCI,
        slaDeadline: body.slaDeadline,
        recentActivity: Array.isArray(body.recentActivity) ? body.recentActivity : [],
        kbArticles: Array.isArray(body.kbArticles) ? body.kbArticles : [],
      });

      res.json(result);
    } catch (err) {
      sendGeminiError(res, err, 'Triage Assistant analysis failed.');
    }
  });

  // ==========================================
  // TELEPHONY CTI PROVIDER & PERSONAL MOBILE BRIDGE API
  // ==========================================

  app.get('/api/telephony/status', (_req: Request, res: Response) => {
    const twilioConfigured = Boolean(
      process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim()
    );
    res.json({
      twilioConfigured,
      twilioFromNumber: twilioConfigured ? process.env.TWILIO_FROM_NUMBER?.trim() : null,
      webhookSecretConfigured: Boolean(process.env.TELEPHONY_WEBHOOK_SECRET?.trim()),
      supportedProviders: [
        'amazon_connect',
        'twilio',
        'sip_webrtc',
        'ringcentral',
        'genesys',
        'custom_provider',
        'personal_mobile',
      ],
    });
  });

  app.post('/api/telephony/test-connection', async (req: Request, res: Response) => {
    const body = req.body as {
      providerType?: string;
      endpointUrl?: string;
      amazonConnectInstanceAlias?: string;
      amazonConnectRegion?: string;
    };

    const startedAt = Date.now();
    try {
      if (body.providerType === 'twilio') {
        const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
        const token = process.env.TWILIO_AUTH_TOKEN?.trim();
        if (!sid || !token) {
          res.status(400).json({
            ok: false,
            error:
              'Twilio server credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER) are not configured in Settings > Secrets.',
          });
          return;
        }
        const authHeader = Buffer.from(`${sid}:${token}`).toString('base64');
        const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, {
          headers: { Authorization: `Basic ${authHeader}` },
        });
        const latencyMs = Date.now() - startedAt;
        if (!twRes.ok) {
          res.status(502).json({
            ok: false,
            latencyMs,
            error: `Twilio API rejected credentials (HTTP ${twRes.status}).`,
          });
          return;
        }
        const account = (await twRes.json()) as { friendly_name?: string; status?: string };
        res.json({
          ok: true,
          latencyMs,
          detail: `Connected to Twilio account "${account.friendly_name || sid}" (${account.status || 'active'}).`,
        });
        return;
      }

      let targetUrl = (body.endpointUrl || '').trim();
      if (body.providerType === 'amazon_connect' && !targetUrl && body.amazonConnectInstanceAlias?.trim()) {
        targetUrl = `https://${body.amazonConnectInstanceAlias.trim()}.my.connect.aws/ccp-v2`;
      }

      if (!targetUrl) {
        res.status(400).json({ ok: false, error: 'Provide a valid HTTPS or WSS provider endpoint URL to verify.' });
        return;
      }

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
      } catch {
        res.status(400).json({ ok: false, error: 'Malformed URL. Use https://... or wss://...' });
        return;
      }

      if (parsedUrl.protocol === 'wss:' || parsedUrl.protocol === 'ws:') {
        const probeHttp = `${parsedUrl.protocol === 'wss:' ? 'https:' : 'http:'}//${parsedUrl.host}${parsedUrl.pathname}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const probeRes = await fetch(probeHttp, { method: 'HEAD', signal: controller.signal });
          clearTimeout(timeout);
          res.json({
            ok: true,
            latencyMs: Date.now() - startedAt,
            status: probeRes.status,
            detail: `SIP/WebRTC host ${parsedUrl.host} reachable (HTTP ${probeRes.status}). Ready for WSS upgrade.`,
          });
          return;
        } catch (err) {
          clearTimeout(timeout);
          res.status(502).json({
            ok: false,
            latencyMs: Date.now() - startedAt,
            error: `Unable to reach SIP/WebRTC gateway ${parsedUrl.host}: ${err instanceof Error ? err.message : 'Connection failed'}`,
          });
          return;
        }
      }

      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        res.status(400).json({ ok: false, error: 'Only https://, http://, or wss:// endpoints are supported.' });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const probeRes = await fetch(parsedUrl.toString(), {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        res.json({
          ok: true,
          latencyMs: Date.now() - startedAt,
          status: probeRes.status,
          detail: `Provider endpoint ${parsedUrl.host} responded (HTTP ${probeRes.status}) in ${Date.now() - startedAt}ms.`,
        });
      } catch (err) {
        clearTimeout(timeout);
        res.status(502).json({
          ok: false,
          latencyMs: Date.now() - startedAt,
          error: `Endpoint unreachable: ${err instanceof Error ? err.message : 'Network error'}`,
        });
      }
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Telephony connectivity probe failed.',
      });
    }
  });

  app.post('/api/telephony/bridge-call', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        providerType?: string;
        targetNumber?: string;
        personalMobileNumber?: string;
        callerName?: string;
        tenantName?: string;
        outboundWebhookUrl?: string;
      };

      const targetNumber = (body.targetNumber || '').trim();
      if (!targetNumber) {
        res.status(400).json({ error: 'Destination phone number is required.' });
        return;
      }

      // Path A: Real Twilio Two-Leg Carrier Bridge (rings agent's personal mobile, then dials target customer)
      if (body.providerType === 'twilio' || (body.providerType === 'personal_mobile' && process.env.TWILIO_ACCOUNT_SID)) {
        const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
        const token = process.env.TWILIO_AUTH_TOKEN?.trim();
        const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();

        if (!sid || !token || !fromNumber) {
          res.status(503).json({
            error:
              'Server-side carrier bridge requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in Settings > Secrets. Use Native Mobile Dialer or QR Handoff for zero-config personal mobile calling.',
          });
          return;
        }

        const firstLegTo = (body.personalMobileNumber || '').trim() || targetNumber;
        const safeTarget = targetNumber.replace(/[<>&"']/g, '');
        const twiml =
          body.personalMobileNumber && body.personalMobileNumber.trim() !== targetNumber
            ? `<Response><Say>Connecting Scribble I T support call to ${safeTarget}.</Say><Dial callerId="${fromNumber}">${safeTarget}</Dial></Response>`
            : `<Response><Say>Scribble I T outbound support call connected.</Say></Response>`;

        const form = new URLSearchParams({
          To: firstLegTo,
          From: fromNumber,
          Twiml: twiml,
        });

        const authHeader = Buffer.from(`${sid}:${token}`).toString('base64');
        const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        });

        const data = (await twRes.json()) as { sid?: string; status?: string; message?: string };
        if (!twRes.ok) {
          res.status(502).json({ error: data.message || `Twilio bridge failed (HTTP ${twRes.status}).` });
          return;
        }

        res.json({
          ok: true,
          mode: 'twilio_bridge',
          callSid: data.sid,
          status: data.status || 'queued',
          message: body.personalMobileNumber
            ? `Ringing your personal mobile (${firstLegTo}) to bridge with ${targetNumber}.`
            : `Outbound carrier call queued to ${targetNumber}.`,
        });
        return;
      }

      // Path B: Generic Custom Telephony Provider Outbound Webhook (Amazon Connect Lambda, RingCentral, Genesys, Asterisk ARI, etc.)
      if (body.outboundWebhookUrl?.trim()) {
        const parsed = new URL(body.outboundWebhookUrl.trim());
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (process.env.TELEPHONY_WEBHOOK_SECRET?.trim()) {
          headers['X-ScribbleIT-Signature'] = process.env.TELEPHONY_WEBHOOK_SECRET.trim();
        }
        const hookRes = await fetch(parsed.toString(), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            event: 'outbound_call_request',
            providerType: body.providerType || 'custom_provider',
            targetNumber,
            agentMobileNumber: body.personalMobileNumber || null,
            callerName: body.callerName || null,
            tenantName: body.tenantName || 'Scribble IT',
            timestamp: new Date().toISOString(),
          }),
        });
        if (!hookRes.ok) {
          res.status(502).json({ error: `Provider webhook returned HTTP ${hookRes.status}.` });
          return;
        }
        res.json({
          ok: true,
          mode: 'provider_webhook',
          message: `Outbound call signal dispatched to ${parsed.host}.`,
        });
        return;
      }

      res.status(400).json({
        error:
          'No carrier bridge webhook or Twilio server credentials configured. Use Native Mobile Dialer, QR Handoff, or Amazon Connect CCP.',
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to dispatch telephony call bridge.',
      });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Scribble IT server listening on http://0.0.0.0:${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Scribble IT server:', err);
  process.exit(1);
});
