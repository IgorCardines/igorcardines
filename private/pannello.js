const ETICHETTE = { online: 'Online', offline: 'Non raggiungibile', errore: 'Errore', attesa: 'Verifica…' };
// Frasi della riga "<code> … </code>" nel banner (segnaposto).
const FRASI = ['Sviluppo applicazioni web.', 'Metto online i tuoi progetti.', 'Automatizzo il lavoro ripetitivo.'];

function crea(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo != null) el.textContent = testo;
  return el;
}

function badgeStato(servizio) {
  if (!servizio.url) return crea('span', 'stato', 'Da installare');
  const s = crea('span', 'stato', ETICHETTE.attesa);
  s.dataset.url = servizio.url;
  s.dataset.stato = 'attesa';
  return s;
}

function apriLink(servizio, testo) {
  if (!servizio.url) return crea('span', 'link spento', 'In arrivo');
  const a = crea('a', 'link', testo);
  a.href = servizio.url;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

function schedaProgetto(p) {
  const el = crea('article', 'scheda progetto');
  const anteprima = crea('div', 'anteprima');
  if (p.immagine) {
    const img = crea('img');
    img.src = p.immagine;
    img.alt = p.nome;
    img.loading = 'lazy';
    anteprima.append(img);
  } else {
    anteprima.append(crea('span', 'finta', p.url ? new URL(p.url).host : 'anteprima'));
  }
  const corpo = crea('div', 'corpo');
  const titolo = crea('h5');
  titolo.append(crea('span', null, p.nome), badgeStato(p));
  corpo.append(titolo);
  if (p.stack) corpo.append(crea('div', 'stack', p.stack));
  corpo.append(crea('p', null, p.descrizione), apriLink(p, 'Visita il sito'));
  el.append(anteprima, corpo);
  return el;
}

function schedaPrivata(s) {
  const el = crea('article', 'scheda' + (s.url ? '' : ' futura'));
  const titolo = crea('h5');
  titolo.append(crea('span', null, s.nome), badgeStato(s));
  el.append(titolo, crea('p', null, s.descrizione));
  if (s.url) el.append(crea('div', 'indirizzo', new URL(s.url).host));
  el.append(apriLink(s, 'Apri'));
  return el;
}

function contaFinoA(el, n, suffisso = '') {
  const inizio = performance.now();
  const passo = (t) => {
    const k = Math.min(1, (t - inizio) / 1200);
    el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))) + suffisso;
    if (k < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

async function aggiornaStato() {
  const r = await fetch('api/stato');
  if (r.status === 401) return location.reload();
  if (!r.ok) return;
  const stati = await r.json();
  for (const el of document.querySelectorAll('.stato[data-url]')) {
    const s = stati[el.dataset.url] || 'offline';
    el.dataset.stato = s;
    el.textContent = ETICHETTE[s];
  }
  const attivi = Object.values(stati).filter((s) => s === 'online').length;
  contaFinoA(document.getElementById('n-servizi'), attivi);
}

async function caricaServizi() {
  const r = await fetch('servizi.json');
  if (!r.ok) return location.reload();
  const { progetti, privati } = await r.json();
  document.getElementById('lista-progetti').append(...progetti.map(schedaProgetto));
  document.getElementById('lista-privati').append(...privati.map(schedaPrivata));
  contaFinoA(document.getElementById('n-progetti'), progetti.filter((p) => p.url).length);
  aggiornaStato();
  setInterval(aggiornaStato, 60e3);
}

// --- barra del profilo: anelli e barre delle competenze ---

function disegnaCompetenze() {
  const R = 22, C = 2 * Math.PI * R;
  for (const el of document.querySelectorAll('.anello')) {
    const v = Number(el.dataset.valore);
    el.querySelector('.percento').innerHTML =
      `<svg viewBox="0 0 49 49"><circle class="traccia" cx="24.5" cy="24.5" r="${R}"/>` +
      `<circle class="valore" cx="24.5" cy="24.5" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>` +
      `<span>${v}%</span>`;
    const cerchio = el.querySelector('.valore');
    cerchio.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0, 0, .3642, 1)';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      cerchio.style.strokeDashoffset = C * (1 - v / 100);
    }));
  }
  for (const el of document.querySelectorAll('.barra-voce')) {
    const v = Number(el.dataset.valore);
    const nome = el.querySelector('h6');
    const testa = crea('div', 'intestazione');
    testa.append(nome, crea('span', 'percento', v + ' %'));
    const traccia = crea('div', 'traccia');
    const valore = crea('div', 'valore');
    valore.style.cssText = 'width:0;transition:width 1.4s cubic-bezier(0, 0, .3642, 1)';
    traccia.append(valore);
    el.append(testa, traccia);
    requestAnimationFrame(() => requestAnimationFrame(() => { valore.style.width = v + '%'; }));
  }
}

// --- riga di codice che si scrive da sola ---

function scriviFrasi() {
  const el = document.getElementById('frase');
  let i = 0, n = 0, cancella = false;
  const giro = () => {
    const frase = FRASI[i];
    n += cancella ? -1 : 1;
    el.textContent = frase.slice(0, n);
    let attesa = cancella ? 40 : 90;
    if (!cancella && n === frase.length) { cancella = true; attesa = 2000; }
    else if (cancella && n === 0) { cancella = false; i = (i + 1) % FRASI.length; attesa = 400; }
    setTimeout(giro, attesa);
  };
  giro();
}

// --- pannelli laterali (menu a destra, profilo a sinistra su schermi stretti) ---

const velo = document.getElementById('velo');
function chiudiTutto() {
  for (const id of ['menu', 'info']) document.getElementById(id).classList.remove('aperto');
  velo.classList.remove('attivo');
}
for (const b of document.querySelectorAll('[data-apri]')) {
  b.addEventListener('click', () => {
    const pannello = document.getElementById(b.dataset.apri);
    const apri = !pannello.classList.contains('aperto');
    chiudiTutto();
    if (apri) { pannello.classList.add('aperto'); velo.classList.add('attivo'); }
  });
}
velo.addEventListener('click', chiudiTutto);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') chiudiTutto(); });
for (const a of document.querySelectorAll('.menu nav a')) a.addEventListener('click', chiudiTutto);

// Voce del menu e scritta verticale seguono la sezione visibile.
const voci = [...document.querySelectorAll('.menu nav a')];
const osservatore = new IntersectionObserver((sezioni) => {
  for (const s of sezioni) {
    if (!s.isIntersecting) continue;
    const voce = voci.find((a) => a.getAttribute('href') === '#' + s.target.id);
    if (!voce) continue;
    voci.forEach((a) => a.classList.toggle('attivo', a === voce));
    document.getElementById('pagina-corrente').textContent = voce.textContent;
  }
}, { rootMargin: '-40% 0px -55% 0px' });
for (const a of voci) osservatore.observe(document.querySelector(a.getAttribute('href')));

document.getElementById('esci').addEventListener('click', async () => {
  await fetch('api/esci', { method: 'POST' });
  location.reload();
});

document.getElementById('anno').textContent = new Date().getFullYear();
for (const el of document.querySelectorAll('[data-conta]')) contaFinoA(el, Number(el.dataset.conta), ' +');
disegnaCompetenze();
scriviFrasi();
caricaServizi();
