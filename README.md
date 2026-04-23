# Silvana Therapy

Sistema de gestión de citas y landing page para una consulta de psicoterapia online (terapia individual, de pareja y consulta gratuita).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Route Handlers + Server Actions (monolito modular) |
| Base de datos | Supabase (PostgreSQL + Auth + RLS) |
| Pagos | Stripe + PayPal (recargo 10% en PayPal) |
| Calendario | Google Calendar API + Meet (OAuth de usuario) |
| Email | SMTP genérico vía nodemailer (Brevo en prod) |
| Hosting | DigitalOcean Droplet 1 GB (Ubuntu) |
| Dominio | `silvanalopez.com` (registrador Wix) |

## Dominios

| URL | Propósito |
|---|---|
| `silvanalopez.com` | Landing pública + flujo de reserva |
| `admin.silvanalopez.com` | Panel de administración (autenticado) |

## Ramas — gitflow

Este proyecto usa gitflow estricto, solo 4 prefijos de rama aceptados:

- **`main`** — producción (coincide con lo desplegado en el Droplet)
- **`dev`** — rama de integración; todos los PRs van a esta rama
- **`feat/<nombre>`** — features nuevas, ramifica de `dev` y mergea de vuelta a `dev`
- **`fix/<nombre>`** — bugfixes, mismo flujo que `feat/*`

Cualquier otro prefijo (`docs/`, `chore/`, `refactor/`) no está permitido — usar `feat/docs-*` o englobar dentro de una `feat/*` mayor.

## Inicio rápido

```bash
npm install
cp .env.local.example .env.local   # rellenar valores
npm run dev                         # http://localhost:3000
```

Ver [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) para la guía completa de desarrollo local.

## Documentación

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — instalar deps, variables de entorno, correr en local, acceder al admin, flujo de ramas
- [docs/DEPLOY.md](docs/DEPLOY.md) — deploy al Droplet (Ubuntu, 1 GB RAM)
- [docs/HANDOVER.md](docs/HANDOVER.md) — guía de entrega al cliente final: swap de credenciales dev→cliente (Brevo, Google Cloud, DNS)
