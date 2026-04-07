# Silvana López — Terapia Online

Landing page y sistema de gestión de citas para la Lda. Silvana López, psicóloga online.

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js Route Handlers (monolito modular)
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Pagos**: Stripe + PayPal
- **Calendario**: Google Calendar API
- **Email**: Resend
- **Hosting**: DigitalOcean App Platform

## Dominios

| Dominio | Propósito |
|---------|-----------|
| `terapiasilvanalopez.com` | Landing page + formulario de reserva (público) |
| `admin.terapiasilvanalopez.com` | Panel de administración (autenticado) |

## Setup

Ver `SETUP_GUIDE.md` para instrucciones completas.

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.local.example .env.local

# Desarrollo local
npm run dev
```

## Ramas

- `main` — Producción (auto-deploy a DigitalOcean)
- `dev` — Desarrollo activo
- `fix` — Hotfixes (se mergea a dev)
