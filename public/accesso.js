const finestra = document.getElementById('accesso');
const modulo = document.getElementById('modulo');
const errore = document.getElementById('errore');
const pulsante = modulo.querySelector('button');

finestra.showModal();
// Il modal non si chiude con Esc: senza accesso non c'è altro da vedere.
finestra.addEventListener('cancel', (e) => e.preventDefault());

modulo.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dati = Object.fromEntries(new FormData(modulo));
  if (!dati.utente || !dati.password) {
    errore.textContent = 'Inserisci nome utente e password.';
    return;
  }
  errore.textContent = '';
  pulsante.disabled = true;
  try {
    const r = await fetch('api/accesso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dati),
    });
    if (r.ok) return location.reload();
    errore.textContent = (await r.json().catch(() => ({}))).errore || 'Accesso non riuscito.';
    modulo.password.select();
  } catch {
    errore.textContent = 'Server non raggiungibile. Riprova.';
  } finally {
    pulsante.disabled = false;
  }
});
