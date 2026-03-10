/**
 * CAP³S WhatsApp Bot — whatsapp-web.js bridge
 *
 * Zero signup. Scan once. Bot is live.
 *
 * Setup:
 *   npm install
 *   node bot.js
 *   → scan the QR code that appears in the terminal with your phone's WhatsApp
 *
 * On any incoming message the bot:
 *   1. POSTs { from, text } to the FastAPI /api/v1/whatsapp/process endpoint
 *   2. Replies with the localised clinical response
 *
 * Outbound document sending  (called by FastAPI diet-plan blast):
 *   POST http://localhost:8180/send-document
 *   Body: { "phone": "+919876543210", "filePath": "/abs/path/plan.pdf", "caption": "..." }
 *
 * LocalAuth saves the session in .wwebjs_auth/ — you only need to scan once.
 * After that, just run `node bot.js` and it reconnects automatically.
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');

const BACKEND_URL = 'http://localhost:8179/api/v1/whatsapp/process';

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    // headless: false,  // uncomment to watch the browser window during debug
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

// ── QR: scan this once with your phone ───────────────────────────────────────
client.on('qr', (qr) => {
  console.log('\n📱  Scan the QR code below with your WhatsApp:\n');
  qrcode.generate(qr, { small: true });
});

// ── Ready ─────────────────────────────────────────────────────────────────────
client.on('ready', () => {
  console.log('\n✅  CAP³S WhatsApp bot is live and ready to receive patient messages.\n');
});

// ── Auth failure ──────────────────────────────────────────────────────────────
client.on('auth_failure', (msg) => {
  console.error('❌  Auth failure:', msg);
  console.error('    Delete the .wwebjs_auth/ folder and restart to re-scan.');
});

// ── Disconnected ──────────────────────────────────────────────────────────────
client.on('disconnected', (reason) => {
  console.warn('⚠️   Disconnected:', reason);
});

// ── Incoming message ──────────────────────────────────────────────────────────
client.on('message', async (msg) => {
  // Skip messages sent by this account (echoes of our own replies)
  if (msg.fromMe) return;

  // Skip group messages — the bot is patient-to-bot only
  if (msg.from.endsWith('@g.us')) return;

  const from = msg.from;   // e.g. "919876543210@c.us"
  const text = msg.body || '';

  console.log(`📨  Message from ${from}: "${text.slice(0, 80)}"`);

  try {
    const res = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, text }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`⚠️   Backend error ${res.status}: ${errBody.slice(0, 200)}`);
      await msg.reply('⚠️ CAP³S system is temporarily unavailable. Please try again.');
      return;
    }

    const { reply } = await res.json();
    console.log(`💬  Replying: "${reply.slice(0, 80)}"`);
    await msg.reply(reply);

  } catch (err) {
    console.error('❌  Failed to reach FastAPI backend:', err.message);
    console.error('    Is the backend running at', BACKEND_URL, '?');
    await msg.reply(
      '⚠️ CAP³S bot cannot reach the server right now. Please contact the nurse station.'
    );
  }
});

// ── Boot ──────────────────────────────────────────────────────────────────────
console.log('🚀  Starting CAP³S WhatsApp bot...');
console.log(`    Backend: ${BACKEND_URL}`);
console.log('    Session will be saved in .wwebjs_auth/ (no rescan on restart)\n');
client.initialize();

// ══════════════════════════════════════════════════════════════════════════════
// OUTBOUND DOCUMENT HTTP SERVER  (port 8180)
// FastAPI calls POST /send-document to push PDF diet plans to patients.
// ══════════════════════════════════════════════════════════════════════════════

const DOC_SERVER_PORT = 8180;

const docServer = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/send-document') {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', async () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const { phone, filePath, caption } = payload;
    if (!phone || !filePath) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'phone and filePath are required' }));
      return;
    }

    // Resolve the proper WhatsApp ID (handles LID system in newer WA versions)
    const rawNumber = phone.replace(/^\+/, '');

    try {
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `File not found: ${filePath}` }));
        return;
      }

      // getNumberId resolves the LID-aware chat ID; falls back to @c.us if needed
      const numberId = await client.getNumberId(rawNumber);
      if (!numberId) {
        console.error(`❌  Number ${phone} is not registered on WhatsApp`);
        res.writeHead(404);
        res.end(JSON.stringify({ error: `Number ${phone} not found on WhatsApp` }));
        return;
      }
      const chatId = numberId._serialized;

      const media = MessageMedia.fromFilePath(filePath);
      await client.sendMessage(chatId, media, { caption: caption || '🏥 CAP³S 30-Day Diet Plan' });

      console.log(`📤  Diet plan sent → ${phone}  (${path.basename(filePath)})`);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, phone, file: path.basename(filePath) }));
    } catch (err) {
      console.error(`❌  Failed to send document to ${phone}:`, err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

docServer.listen(DOC_SERVER_PORT, '127.0.0.1', () => {
  console.log(`📡  Document-send server listening on http://127.0.0.1:${DOC_SERVER_PORT}`);
  console.log('    FastAPI can POST /send-document to push PDFs to any WhatsApp number.\n');
});
