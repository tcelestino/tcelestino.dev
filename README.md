# tcelestino.dev

Pagina estatica minimalista. Hospedada como Cloudflare Worker com static assets.

## Deploy manual

    npx wrangler login
    npx wrangler deploy

O dominio `tcelestino.dev` precisa estar como zona na conta Cloudflare. O wrangler cria o registro DNS e o certificado automaticamente (custom domain).

## Deploy automatico

O workflow `.github/workflows/deploy.yml` publica a cada push na `main`. Secrets necessarios no repositorio:

- `CLOUDFLARE_API_TOKEN`: token com o template "Edit Cloudflare Workers"
- `CLOUDFLARE_ACCOUNT_ID`

## Fonte

IBM Plex Sans (SIL OFL 1.1), self-hosted em `public/fonts`.
