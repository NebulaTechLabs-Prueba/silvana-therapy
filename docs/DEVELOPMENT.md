# Guía de Desarrollo — Silvana Therapy

Guía para devs que trabajan en el proyecto. Cubre instalación local, variables de entorno, flujo de ramas y cómo acceder al panel admin.

Para deploy al servidor ver [DEPLOY.md](DEPLOY.md). Para entrega al cliente final ver [HANDOVER.md](HANDOVER.md).

---

## 1. Requisitos

- **Node.js** 20+ (idealmente 22 LTS)
- **npm** 10+
- Acceso al proyecto Supabase del dev (URL + keys)
- **Git** configurado con una cuenta con permisos al repo

---

## 2. Setup inicial

```bash
git clone https://github.com/NebulaTechLabs-Prueba/silvana-therapy.git
cd silvana-therapy
npm install
cp .env.local.example .env.local
```

Editar `.env.local` y rellenar los valores. Ver sección 3.

```bash
npm run dev
```

El servidor escucha en `http://localhost:3000`. Debe cargar la home pública sin errores.

---

## 3. Variables de entorno

El archivo `.env.local.example` documenta todas las variables. Para arrancar, las mínimas obligatorias son las de **Supabase** — sin ellas el middleware de auth hace bucle infinito.

### 3.1 Supabase (obligatorio)

Sacar de Supabase Dashboard → Settings → API:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> ⚠️ El `SUPABASE_SERVICE_ROLE_KEY` bypasea RLS. Nunca exponerlo al cliente — solo se usa en server actions y adapters del servidor.

### 3.2 URLs de la app

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3000/admin
```

En producción:
```
NEXT_PUBLIC_APP_URL=https://silvanalopez.com
NEXT_PUBLIC_ADMIN_URL=https://admin.silvanalopez.com
```

### 3.3 Email (SMTP)

Para probar el flujo de emails en local, rellenar con credenciales Brevo (o cualquier SMTP):

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<login Brevo>
SMTP_PASSWORD=<SMTP key Brevo>
EMAIL_FROM=Silvana López <noreply@silvanalopez.com>
```

> Si `SMTP_HOST` queda vacío, el código no crashea — simplemente logea un warning y no envía el correo. Útil para desarrollo sin SMTP.

### 3.4 Google Calendar + Meet (OAuth)

Para probar creación de eventos y Meet links en local:

```
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google/callback
```

Pasos para obtener las credenciales: ver [HANDOVER.md § Parte 2](HANDOVER.md) (el flujo es idéntico para dev, solo cambia el redirect URI a localhost).

Tras configurar, entrar al panel admin → Integraciones → **Conectar con Google** para autorizar la cuenta y persistir los tokens en la tabla `google_integrations`.

### 3.5 Cron (recordatorios 24h)

El endpoint `/api/cron/reminders` envía recordatorios por correo 24h antes de la cita (ver [DEPLOY.md § 6-bis](DEPLOY.md)). En desarrollo no hace falta configurar el crontab, pero sí es necesario el secreto si quieres probar el endpoint manualmente:

```
CRON_SECRET=cualquier-string-aleatorio
```

Para disparar el endpoint en local:
```bash
curl -H "Authorization: Bearer cualquier-string-aleatorio" http://localhost:3000/api/cron/reminders
```

Si `CRON_SECRET` no está, el endpoint responde 500 (no se desactiva silenciosamente para evitar que un despliegue sin el secreto deje de enviar recordatorios sin aviso).

### 3.6 Stripe / PayPal

Opcionales para arrancar. El app carga sin ellos; solo falla al intentar generar enlaces de pago. Usar keys de test durante desarrollo:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
PAYPAL_CLIENT_ID=AX...
PAYPAL_CLIENT_SECRET=EL...
PAYPAL_WEBHOOK_ID=WH-...
PAYPAL_MODE=sandbox
```

### 3.6 Seguridad

```
TWO_FACTOR_ENCRYPTION_KEY=<string aleatorio de 32 chars>
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<hex de 64 chars>
```

- **`TWO_FACTOR_ENCRYPTION_KEY`**: cifra los secretos TOTP del 2FA. Generar con `openssl rand -hex 16`.
- **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`**: fija la key con la que Next.js 14 cifra los IDs de Server Actions. Sin ella Next genera una aleatoria por build, lo que invalida las pestañas abiertas del panel tras cualquier deploy (error `Failed to find Server Action`). Generar UNA SOLA VEZ con `openssl rand -hex 32` y no rotarla. En dev puede ser un valor fijo cualquiera; en producción debe existir antes del primer build que entregue al cliente.

---

## 4. Flujo de ramas (gitflow estricto)

Solo 4 prefijos aceptados:

```
main  ← producción (lo que corre en el Droplet)
  │
  └── dev  ← integración; target de todos los PRs
       │
       ├── feat/<scope>  ← nuevas features, ramifican de dev
       └── fix/<scope>   ← bugfixes, ramifican de dev
```

**Reglas:**

- Cualquier cambio pasa por un **PR contra `dev`**, incluso en proyecto solo — queda bitácora en GitHub.
- Para promover a producción: abrir PR `dev` → `main`, mergear, deploy en el Droplet.
- **Nunca** commitear directo a `main`.
- Prefijos como `docs/`, `chore/`, `refactor/` **no están permitidos**. Documentación va en `feat/docs-*` o dentro de una `feat/*` de mayor scope.

Ejemplo de flujo:

```bash
git checkout dev && git pull
git checkout -b feat/mi-cambio
# ... trabajar, commitear ...
git push -u origin feat/mi-cambio
# Abrir PR en GitHub contra dev; mergear; borrar la rama
```

---

## 5. Mapa de rutas

| URL | Qué es |
|---|---|
| `/` | Home pública |
| `/services` | Listado de servicios |
| `/services/[slug]` | Detalle de servicio |
| `/booking` | Formulario de reserva público |
| `/booking/confirmation` | Pantalla de éxito |
| `/booking/error` | Pantalla de error |
| `/login` | Login del admin |
| `/admin` | Redirige a `/admin/dashboard` si hay sesión |
| `/admin/dashboard` | Panel de administración (6 secciones) |
| `/api/google/{connect,callback,disconnect}` | OAuth flow con Google |
| `/api/webhooks/{stripe,paypal}` | Webhooks de pagos |

### Flujo para entrar al admin

1. Abrir `http://localhost:3000/login`.
2. Ingresar con el usuario admin creado en Supabase (Authentication → Users → Add user con "Auto Confirm" activo).
3. Al autenticar se redirige a `/admin/dashboard`.
4. Para cerrar sesión: Configuración → Sesión → "Cerrar sesión".

Comportamientos:

| Acción | Esperado |
|---|---|
| Entrar a `/admin/dashboard` sin sesión | Redirige a `/login?redirect=/admin/dashboard` |
| Entrar a `/login` con sesión activa | Redirige a `/admin/dashboard` |
| Credenciales incorrectas | Mensaje "Email o contraseña incorrectos" |

---

## 6. Base de datos

El schema vive en un **único baseline**: [`supabase/migrations/001_baseline.sql`](../supabase/migrations/001_baseline.sql). Consolida las 15 migraciones históricas en un solo archivo para simplificar la entrega y evitar el drift entre migraciones viejas y el schema real.

### Setup desde cero en una instancia Supabase nueva

1. Crear proyecto Supabase (región US East para cercanía con Miami/NYC).
2. SQL Editor → abrir `001_baseline.sql` → **Run**. Crea enums, tablas, índices, funciones, triggers, RLS policies y el singleton de `admin_settings`.
3. SQL Editor → ejecutar cada migración incremental en orden numérico (`002_*.sql`, `003_*.sql`, …). Ver [tabla de migraciones abajo](#migraciones-incrementales).
4. Authentication → Users → crear usuario admin con **Auto Confirm** activo.
5. Authentication → URL Configuration → añadir `http://localhost:3000/**` y `https://admin.silvanalopez.com/**` a los redirect URLs.
6. Poblar `services` y `payment_methods` desde el dashboard (el baseline **no** seedea estas tablas — se asume que el catálogo real lo llena el admin).

### Migraciones incrementales

| Archivo | Propósito |
|---|---|
| `002_imported_service.sql` | Añade `services.is_internal` (bool) para marcar servicios que no deben aparecer en páginas públicas, y semilla el servicio "Importado de Google Calendar" usado como placeholder por el import de eventos desde Google Calendar cuando el servicio original se desconoce. |
| `003_admin_timezone.sql` | Añade `admin_settings.admin_timezone` (TEXT, default `America/New_York`) con CHECK constraint sobre lista de IANA TZs permitidas. El admin elige la zona en Mi Cuenta; el panel lee/escribe fechas de booking en esa zona. |
| `004_display_timezones.sql` | Añade `admin_settings.email_display_tz` y `form_display_tz` (mismo set de TZs permitidas). `email_display_tz` controla la zona mostrada como referencia en los correos automáticos al paciente (default `America/New_York`, editable en Mi Cuenta). `form_display_tz` controla la zona visible en el formulario público de reserva (slots y labels). Los slots siguen generados en `BASE_TZ` (Miami) internamente, solo cambia el display. Extiende `get_public_contact()` RPC para incluir `form_display_tz`. |
| `005_optional_client_email.sql` | `clients.email` ahora puede ser NULL. La UNIQUE constraint se sustituye por un índice único parcial `clients_email_unique_when_set` que solo aplica cuando email no es null. Nuevo CHECK `chk_clients_contact_present` exige que cada cliente tenga al menos email o teléfono (paridad con validación server y UI). Desbloquea: importar eventos de Google Calendar sin attendee, registrar pacientes que solo coordinan por WhatsApp, flujo público donde el visitante provee teléfono en lugar de correo. |

### Futuros cambios de schema

Cualquier modificación posterior al baseline se añade como una migración nueva numerada a partir de `003_*.sql`. Nunca editar `001_baseline.sql` ni migraciones ya aplicadas en instancias desplegadas — crear una migración incremental en su lugar y documentarla en la tabla de arriba.

### Seed data de demo

Para cargar datos de ejemplo (pacientes, reservas, facturas) de cara a una presentación: `supabase/seed_demo_data.sql`. Es idempotente — borra cualquier dato demo previo antes de insertar.

---

## 7. Troubleshooting

**"Module not found: Can't resolve '@/...'"**
Reinstalar deps: `rm -rf node_modules .next && npm install`.

**Middleware redirige en bucle a `/login`**
Falta `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local`, o no reiniciaste el servidor tras crearlas.

**"Invalid login credentials" con credenciales correctas**
Verificar en Supabase Dashboard → Authentication → Users que el usuario tenga el email confirmado (tick verde). Si no, click en el usuario → "Confirm email".

**Emails no llegan**
Revisar los logs del servidor — si no hay SMTP configurado, sale un warning `[email] SMTP not configured, skipping send`. Verificar que `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` estén rellenos en `.env.local`.

**Google OAuth falla con "redirect_uri_mismatch"**
El `GOOGLE_REDIRECT_URI` en `.env.local` debe coincidir exactamente con uno de los "Authorized redirect URIs" configurados en Google Cloud Console → Credentials → OAuth Client.
