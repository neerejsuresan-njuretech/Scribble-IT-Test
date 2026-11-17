import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { runWikiSearchGrounding, type WikiGroundingMode } from './server/gemini.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

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
      const rawMessage = err instanceof Error ? err.message : 'Failed to fetch Google Search grounded update.';
      let status = 500;
      let message = rawMessage;

      if (/GEMINI_API_KEY is not configured/i.test(rawMessage)) {
        status = 503;
      } else if (/API_KEY_INVALID|PERMISSION_DENIED|403|401/i.test(rawMessage)) {
        status = 403;
        message = 'Gemini API authentication failed. Please verify the API key configured in Settings > Secrets.';
      } else if (/RESOURCE_EXHAUSTED|429/i.test(rawMessage)) {
        status = 429;
        message = 'Gemini API rate limit reached. Please retry shortly or verify quota in Settings > Secrets.';
      } else if (/NOT_FOUND|404/i.test(rawMessage)) {
        status = 502;
        message = 'Configured Gemini model was unavailable upstream.';
      }

      res.status(status).json({ error: message });
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
