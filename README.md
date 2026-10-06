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

`/srv/apps/igorcardines` (container `igorcardines:8080`), dietro Caddy. File di riferimento in
`project/_infra/srv/apps/igorcardines/`. Rilascio automatico a ogni push su `main`.

Primo passaggio da nginx a Node, sull'host:

```bash
cp /srv/apps/igorcardines/src/.env.example /srv/apps/igorcardines/.env
chmod 600 /srv/apps/igorcardines/.env   # poi inserire i valori (gli stessi del .env di sviluppo)
cp PROJECT_PATH/_infra/srv/apps/igorcardines/docker-compose.yml /srv/apps/igorcardines/
cp PROJECT_PATH/_infra/srv/bin/autodeploy /srv/bin/autodeploy
/srv/bin/deploy igorcardines
# nel Caddyfile: reverse_proxy igorcardines:80 -> igorcardines:8080, poi
docker compose -f /srv/proxy/docker-compose.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```
