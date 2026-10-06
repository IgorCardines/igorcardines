# igorcardines.it

Sito personale: vetrina dei progetti e pannello dei servizi privati del VPS.
Per ora è tutto dietro un accesso con password.

- `server.mjs` — piccolo server Node senza dipendenze: controlla l'accesso e serve i file.
- `public/` — servito a tutti: pagina di accesso, stile, `robots.txt`.
- `private/` — servito solo dopo l'accesso: pannello e `servizi.json` (l'elenco delle schede:
  per aggiungere un servizio basta aggiungere una voce, `"url": null` = "da installare").
- `.env` — utente, password e segreto delle sessioni. Non va su git; modello in `.env.example`.

In locale (la 8080 qui è già di code-server): `PORT=8099 node --env-file=.env server.mjs`
(da code-server: `https://code.igorcardines.it/proxy/8099/`).

## Produzione

`/srv/apps/igorcardines`: container `igorcardines`, porta 80 (come il vecchio nginx), dietro Caddy.
Rilascio automatico a ogni push su `main`.

Utente, password e segreto delle sessioni stanno nel `docker-compose.yml` sull'host (modello in
`project/_infra/srv/apps/igorcardines/`). Per cambiarli da code-server: aggiornare `.env`, rigenerare
il compose con i valori veri e installarlo con `ssh vps compose igorcardines < compose.yml`.
