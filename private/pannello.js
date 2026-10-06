const ETICHETTE = { online: 'Online', offline: 'Non raggiungibile', errore: 'Errore', attesa: 'Verifica…' };

function scheda(servizio) {
  const el = document.createElement(servizio.url ? 'a' : 'div');
  el.className = 'scheda' + (servizio.url ? '' : ' futura');
  if (servizio.url) {
    el.href = servizio.url;
    el.target = '_blank';
    el.rel = 'noopener';
  }

  const riga = document.createElement('div');
  riga.className = 'riga';
  const nome = document.createElement('span');
  nome.className = 'nome';
  nome.textContent = servizio.nome;
  const stato = document.createElement('span');
  stato.className = 'stato';
  if (servizio.url) {
    stato.dataset.url = servizio.url;
    stato.dataset.stato = 'attesa';
    stato.textContent = ETICHETTE.attesa;
  } else {
    stato.textContent = 'Da installare';
  }
  riga.append(nome, stato);

  const descrizione = document.createElement('p');
  descrizione.className = 'descrizione';
  descrizione.textContent = servizio.descrizione;
  el.append(riga, descrizione);

  if (servizio.url) {
    const indirizzo = document.createElement('span');
    indirizzo.className = 'indirizzo';
    indirizzo.textContent = new URL(servizio.url).host;
    el.append(indirizzo);
  }
  return el;
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
}

async function avvia() {
  const r = await fetch('servizi.json');
  if (!r.ok) return location.reload();
  const { progetti, privati } = await r.json();
  document.getElementById('progetti').append(...progetti.map(scheda));
  document.getElementById('privati').append(...privati.map(scheda));
  aggiornaStato();
  setInterval(aggiornaStato, 60e3);
}

document.getElementById('esci').addEventListener('click', async () => {
  await fetch('api/esci', { method: 'POST' });
  location.reload();
});

avvia();
