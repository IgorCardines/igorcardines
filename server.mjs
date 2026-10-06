// Sito igorcardines.it: file statici più un accesso con password, controllato qui sul server.
// Nessuna dipendenza: basta Node >= 20.
//   public/   servito a tutti (pagina di accesso, stile, robots.txt)
//   private/  servito solo dopo l'accesso (pannello, elenco dei servizi)
//
// In locale:  node --env-file=.env server.mjs   →  http://localhost:8080
import http from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORTA = Number(process.env.PORT) || 8080;
const UTENTE = process.env.UTENTE_SITO || 'igor';
const PASSWORD = process.env.PASSWORD_SITO;
if (!PASSWORD) {
  console.error('Manca PASSWORD_SITO: copiare .env.example in .env e impostarla.');
  process.exit(1);
}
// Senza segreto fisso le sessioni valgono fino al prossimo riavvio.
const SEGRETO = process.env.SEGRETO_SESSIONE || randomBytes(32).toString('hex');
// Cambiare la password invalida tutte le sessioni aperte.
const CHIAVE = createHmac('sha256', SEGRETO).update(PASSWORD).digest();

const COOKIE = 'sessione';
const DURATA = 30 * 24 * 3600; // secondi
const MAX_TENTATIVI = 10;      // tentativi sbagliati per IP...
const FINESTRA = 15 * 60e3;    // ...in 15 minuti

const RADICE = path.dirname(fileURLToPath(import.meta.url));

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const SICUREZZA = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex',
};

// --- sessione: cookie "scadenza.firma", firmato con HMAC ---

function firma(testo) {
  return createHmac('sha256', CHIAVE).update(testo).digest('base64url');
}

function uguali(a, b) {
  // Confronto a tempo costante anche se le lunghezze differiscono.
  const ha = createHmac('sha256', CHIAVE).update(String(a)).digest();
  const hb = createHmac('sha256', CHIAVE).update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

function nuovaSessione() {
  const scadenza = Math.floor(Date.now() / 1000) + DURATA;
  return `${scadenza}.${firma(String(scadenza))}`;
}

function autenticato(req) {
  const cookie = (req.headers.cookie || '')
    .split(';').map((c) => c.trim().split('='))
    .find(([nome]) => nome === COOKIE);
  if (!cookie) return false;
  const [scadenza, f] = (cookie[1] || '').split('.');
  if (!scadenza || !f || !uguali(f, firma(scadenza))) return false;
  return Number(scadenza) > Date.now() / 1000;
}

function cookieSessione(valore, durata) {
  return `${COOKIE}=${valore}; Path=/; Max-Age=${durata}; HttpOnly; Secure; SameSite=Strict`;
}

// --- limite ai tentativi sbagliati ---

const tentativi = new Map(); // ip -> { n, dal }

function ipDi(req) {
  // Caddy sostituisce X-Forwarded-For con l'IP del client: l'ultimo valore è affidabile.
  const xff = req.headers['x-forwarded-for'];
  return xff ? xff.split(',').pop().trim() : req.socket.remoteAddress;
}

function bloccato(ip) {
  const t = tentativi.get(ip);
  if (t && Date.now() - t.dal > FINESTRA) tentativi.delete(ip);
  return (tentativi.get(ip)?.n || 0) >= MAX_TENTATIVI;
}

function sbagliato(ip) {
  const t = tentativi.get(ip) || { n: 0, dal: Date.now() };
  t.n++;
  tentativi.set(ip, t);
}

// --- stato dei servizi, controllato dal server e tenuto per un minuto ---

let statoInCache = { quando: 0, dati: null };

async function statoServizi() {
  if (Date.now() - statoInCache.quando < 60e3) return statoInCache.dati;
  const elenco = JSON.parse(await readFile(path.join(RADICE, 'private', 'servizi.json'), 'utf8'));
  const indirizzi = [...elenco.progetti, ...elenco.privati].map((s) => s.url).filter(Boolean);
  const esiti = await Promise.all(indirizzi.map(async (url) => {
    try {
      const r = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(5000) });
      // 401 e 302 vanno bene: il servizio risponde e chiede il suo login.
      return [url, r.status < 500 ? 'online' : 'errore'];
    } catch {
      return [url, 'offline'];
    }
  }));
  statoInCache = { quando: Date.now(), dati: Object.fromEntries(esiti) };
  return statoInCache.dati;
}

// --- risposte ---

function rispondi(res, codice, corpo, intestazioni = {}) {
  res.writeHead(codice, { ...SICUREZZA, ...intestazioni });
  res.end(corpo);
}

function json(res, codice, dati, intestazioni = {}) {
  rispondi(res, codice, JSON.stringify(dati), {
    'Content-Type': TIPI['.json'], 'Cache-Control': 'no-store', ...intestazioni,
  });
}

async function file(res, cartella, percorso, privato) {
  const base = path.join(RADICE, cartella);
  const completo = path.join(base, path.normalize('/' + percorso));
  if (!completo.startsWith(base + path.sep)) return false;
  let contenuto;
  try {
    contenuto = await readFile(completo);
  } catch {
    return false;
  }
  rispondi(res, 200, contenuto, {
    'Content-Type': TIPI[path.extname(completo)] || 'application/octet-stream',
    'Cache-Control': privato ? 'private, no-store' : 'no-cache',
  });
  return true;
}

async function leggiCorpo(req) {
  let corpo = '';
  for await (const pezzo of req) {
    corpo += pezzo;
    if (corpo.length > 4096) throw new Error('troppo grande');
  }
  return JSON.parse(corpo);
}

async function gestisci(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let percorso;
  try {
    percorso = decodeURIComponent(url.pathname);
  } catch {
    return rispondi(res, 400, 'Richiesta non valida');
  }
  const dentro = autenticato(req);

  if (percorso === '/api/accesso' && req.method === 'POST') {
    const ip = ipDi(req);
    if (bloccato(ip)) return json(res, 429, { errore: 'Troppi tentativi. Riprova tra qualche minuto.' });
    let dati;
    try {
      dati = await leggiCorpo(req);
    } catch {
      return json(res, 400, { errore: 'Richiesta non valida.' });
    }
    // Entrambi i confronti sempre, per non rivelare quale dei due è sbagliato.
    const okUtente = uguali(dati.utente, UTENTE);
    const okPassword = uguali(dati.password, PASSWORD);
    if (!(okUtente && okPassword)) {
      sbagliato(ip);
      return json(res, 401, { errore: 'Nome utente o password errati.' });
    }
    tentativi.delete(ip);
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookieSessione(nuovaSessione(), DURATA) });
  }

  if (percorso === '/api/esci' && req.method === 'POST') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': cookieSessione('', 0) });
  }

  if (percorso === '/api/stato' && req.method === 'GET') {
    if (!dentro) return json(res, 401, { errore: 'Accesso richiesto.' });
    return json(res, 200, await statoServizi());
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return rispondi(res, 405, 'Metodo non consentito');

  if (percorso === '/') {
    return dentro
      ? file(res, 'private', 'index.html', true)
      : file(res, 'public', 'accesso.html', false);
  }
  if (await file(res, 'public', percorso, false)) return;
  if (dentro && await file(res, 'private', percorso, true)) return;
  rispondi(res, 404, 'Non trovato', { 'Content-Type': TIPI['.txt'] });
}

http.createServer((req, res) => {
  gestisci(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) rispondi(res, 500, 'Errore interno');
  });
}).listen(PORTA, () => console.log(`igorcardines.it in ascolto sulla porta ${PORTA}`));
