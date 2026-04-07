# Silvana López — Guía de Setup Completa

## Estructura del Proyecto

```
silvana-therapy/
├── .do/
│   └── app.yaml                    # DigitalOcean App Platform spec
├── .gitignore
├── Dockerfile
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.local.example
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Schema completo con RLS
│
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout
│   │   ├── globals.css
│   │   ├── (public)/               # Landing + formulario
│   │   │   ├── page.tsx
│   │   │   └── reservar/
│   │   ├── (admin)/                # Panel admin (protegido)
│   │   │   ├── login/
│   │   │   └── admin/
│   │   │       ├── dashboard/
│   │   │       ├── bookings/
│   │   │       ├── settings/
│   │   │       └── calendar/
│   │   └── api/
│   │       ├── bookings/route.ts
│   │       ├── payments/
│   │       │   ├── stripe/
│   │       │   └── paypal/
│   │       ├── calendar/
│   │       └── webhooks/
│   │           ├── stripe/route.ts
│   │           └── paypal/route.ts
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser client
│   │   │   ├── server.ts           # Server client (RLS)
│   │   │   └── admin.ts            # Service role (bypasses RLS)
│   │   ├── adapters/
│   │   │   ├── stripe.ts
│   │   │   ├── paypal.ts
│   │   │   ├── google-calendar.ts
│   │   │   └── email.ts
│   │   ├── services/
│   │   │   └── booking.service.ts
│   │   └── validators/
│   │       └── schemas.ts          # Zod schemas
│   │
│   ├── components/
│   │   ├── public/
│   │   ├── admin/
│   │   └── ui/
│   │
│   ├── types/
│   │   └── database.ts
│   │
│   └── middleware.ts               # Domain routing + auth guard
│
└── public/                          # Static assets (logo, images)
```

---

## FASE 1 — GitHub

### 1.1 Crear repositorio

1. Ve a **github.com/new**
2. Nombre: `silvana-therapy`
3. Privado: **Sí**
4. NO inicialices con README (lo haremos desde local)
5. Click **Create repository**

### 1.2 Inicializar desde VS Code

Abre terminal integrada (`Ctrl + ñ` o `Ctrl + Backtick`):

```bash
# Navega a donde quieras el proyecto
cd ~/proyectos

# Clona la estructura que te entrego (o copia la carpeta)
# Si copias los archivos manualmente, luego:
cd silvana-therapy

# Inicializar Git
git init

# Crear ramas
git checkout -b main
git add .
git commit -m "feat: initial project structure — schema, adapters, services"

# Conectar con GitHub
git remote add origin https://github.com/TU_USUARIO/silvana-therapy.git
git push -u origin main

# Crear rama dev desde main
git checkout -b dev
git push -u origin dev

# Crear rama fix desde dev
git checkout -b fix
git push -u origin fix

# Volver a dev para trabajar
git checkout dev
```

### 1.3 Flujo de ramas

```
main  ← Solo merges de dev (producción, DigitalOcean auto-deploy)
  │
  └── dev  ← Rama de trabajo principal
       │
       └── fix  ← Hotfixes puntuales, se mergea a dev
```

**Reglas:**
- **dev**: Todo desarrollo va aquí. Commits frecuentes.
- **fix**: Se crea desde `dev` para bugs urgentes. Se mergea de vuelta a `dev`.
- **main**: Solo recibe merges de `dev` cuando algo está listo para producción.

### 1.4 Instalar dependencias

```bash
# Asegúrate de estar en la raíz del proyecto
npm install

# Verificar que todo compila
npm run type-check
```

---

## FASE 2 — Supabase

### 2.1 Crear proyecto

1. Ve a **supabase.com** → Dashboard → **New Project**
2. Nombre: `silvana-therapy`
3. Contraseña de DB: genera una fuerte y **guárdala**
4. Región: **East US (Virginia)** — cercano a DigitalOcean NYC
5. Plan: **Free** (suficiente para MVP)
6. Click **Create new project** — espera ~2 min

### 2.2 Obtener credenciales

Una vez creado, ve a **Settings → API**:

1. **Project URL**: copia → será `NEXT_PUBLIC_SUPABASE_URL`
2. **anon public key**: copia → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **service_role key**: copia → será `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ El service_role key NUNCA se expone al cliente. Solo se usa en API routes del servidor.

### 2.3 Ejecutar migration

1. En el Dashboard, ve a **SQL Editor**
2. Click **New query**
3. Copia y pega TODO el contenido de `supabase/migrations/001_initial_schema.sql`
4. Click **Run**
5. Deberías ver "Success. No rows returned" para cada statement

**Verifica** yendo a **Table Editor** — deberías ver:
- `clients` (vacía)
- `services` (2 filas: "Primera consulta gratuita" + "Sesión de terapia")
- `bookings` (vacía)
- `payments` (vacía)
- `payment_links` (vacía)
- `admin_settings` (1 fila con valores default)

### 2.4 Crear usuario admin (Silvana)

1. Ve a **Authentication → Users**
2. Click **Add user → Create new user**
3. Email: `info@terapiasilvanalopez.com` (o el email de Silvana)
4. Password: genera una fuerte
5. Marca **Auto Confirm User**
6. Click **Create user**

### 2.5 Configurar 2FA (después del login)

El 2FA se configura desde el admin panel una vez deployado.
Supabase Auth soporta TOTP nativamente. Lo implementaremos en el panel.

### 2.6 Configurar email templates (opcional)

1. Ve a **Authentication → Email Templates**
2. Personaliza las plantillas de:
   - **Confirm signup** (no necesario, solo admin)
   - **Reset password** ← importante
   - **Magic link** (no usamos)

Para **Reset password**, cambia el redirect URL a:
```
https://admin.terapiasilvanalopez.com/auth/reset-password
```

### 2.7 Configurar URL de redirect

1. Ve a **Authentication → URL Configuration**
2. **Site URL**: `https://terapiasilvanalopez.com`
3. **Redirect URLs** (agregar todos):
   ```
   https://admin.terapiasilvanalopez.com/**
   http://localhost:3000/**
   ```

---

## FASE 3 — Variables de entorno local

### 3.1 Crear .env.local

```bash
# Desde la raíz del proyecto
cp .env.local.example .env.local
```

Abre `.env.local` en VS Code y llena:

```env
# Los que ya tienes de Supabase:
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Para desarrollo local:
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3000/admin
```

> Los demás (Stripe, PayPal, Google, Resend) los configuramos cuando lleguemos a cada integración. El proyecto arranca sin ellos.

### 3.2 Verificar desarrollo local

```bash
npm run dev
```

Abre `http://localhost:3000` — debería cargar sin errores.

---

## FASE 4 — DigitalOcean

### 4.1 Crear cuenta y proyecto

1. Ve a **cloud.digitalocean.com**
2. Crea cuenta si no tienes
3. Ve a **Apps** en el sidebar

### 4.2 Conectar GitHub

1. Click **Create App**
2. Source: **GitHub**
3. Te pedirá autorizar DigitalOcean en tu GitHub
4. Selecciona el repo `silvana-therapy`
5. Branch: **main**
6. Autodeploy: **Sí**

### 4.3 Configurar el servicio

1. **Type**: Web Service
2. **Plan**: Basic ($5/mo) — suficiente para MVP
3. **Region**: New York (NYC) — cercano a Supabase
4. **Dockerfile path**: `/Dockerfile` (lo detecta automáticamente)
5. **HTTP Port**: `8080`

### 4.4 Variables de entorno

En la sección **Environment Variables**, agrega las mismas de `.env.local` pero con valores de **producción**:

```
# BUILD_TIME (se pasan al build de Next.js)
NEXT_PUBLIC_SUPABASE_URL        = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...
NEXT_PUBLIC_APP_URL             = https://terapiasilvanalopez.com
NEXT_PUBLIC_ADMIN_URL           = https://admin.terapiasilvanalopez.com

# RUN_TIME + ENCRYPTED (secretos, marcalos como Secret)
SUPABASE_SERVICE_ROLE_KEY       = eyJ...     [Secret]
STRIPE_SECRET_KEY               = sk_live_... [Secret]
STRIPE_WEBHOOK_SECRET           = whsec_...  [Secret]
PAYPAL_CLIENT_ID                = ...        [Secret]
PAYPAL_CLIENT_SECRET            = ...        [Secret]
PAYPAL_WEBHOOK_ID               = ...        [Secret]
PAYPAL_MODE                     = live
GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 = ...      [Secret]
GOOGLE_CALENDAR_ID              = ...
RESEND_API_KEY                  = re_...     [Secret]
EMAIL_FROM                      = "Silvana López <noreply@terapiasilvanalopez.com>"
```

> No necesitas llenar Stripe/PayPal/Google ahora. El app arranca sin ellos. Los agregas cuando configures cada servicio.

### 4.5 Configurar dominio

1. Después del primer deploy, ve a **Settings → Domains**
2. Agrega: `terapiasilvanalopez.com`
3. Agrega: `admin.terapiasilvanalopez.com`
4. DigitalOcean te dará registros DNS (CNAME o A record)
5. En tu proveedor de dominio, configura los DNS que te indica

**Ejemplo DNS:**
```
Tipo     Nombre     Valor
A        @          <IP de DigitalOcean>
CNAME    admin      <app-slug>.ondigitalocean.app.
CNAME    www        <app-slug>.ondigitalocean.app.
```

### 4.6 SSL/HTTPS

DigitalOcean App Platform genera certificados SSL automáticamente via Let's Encrypt. No necesitas configurar nada.

---

## FASE 5 — Flujo de deploy

### Deploy automático

Cada push a `main` dispara un deploy automático en DigitalOcean:

```bash
# Trabajar en dev
git checkout dev
# ... hacer cambios ...
git add .
git commit -m "feat: booking form UI"
git push origin dev

# Cuando esté listo para producción
git checkout main
git merge dev
git push origin main
# → DigitalOcean auto-deploy se activa
```

### Deploy manual (si necesitas)

```bash
# Desde DigitalOcean Dashboard
# Apps → silvana-therapy → Deploy → Force Rebuild & Deploy
```

---

## FASE 6 — Extensiones VS Code recomendadas

Instala estas extensiones para productividad:

```
# En VS Code, Ctrl+Shift+X y buscar:
- ESLint
- Tailwind CSS IntelliSense
- Prettier
- ES7+ React/Redux/React-Native snippets
- Auto Rename Tag
- GitLens
```

---

## Checklist de progreso

```
[ ] GitHub: Repo creado + ramas main/dev/fix
[ ] GitHub: Código inicial pusheado a main
[ ] Supabase: Proyecto creado
[ ] Supabase: Migration ejecutada (6 tablas)
[ ] Supabase: Usuario admin creado
[ ] Supabase: URL de redirect configuradas
[ ] Local: .env.local configurado
[ ] Local: npm install + npm run dev funciona
[ ] DigitalOcean: App creada + GitHub conectado
[ ] DigitalOcean: Variables de entorno configuradas
[ ] DigitalOcean: Primer deploy exitoso
[ ] DNS: Dominio + subdominio configurados
[ ] DNS: SSL activo (automático)
```

---

## Próximos pasos (después del setup)

1. **Landing page** — Replicar el diseño aprobado de Wix
2. **Formulario de reserva** — Form público + API
3. **Admin login** — Auth + 2FA
4. **Admin dashboard** — Lista de bookings + acciones
5. **Google Calendar** — Service account + integración
6. **Stripe** — Payment links
7. **PayPal** — Payment links con surcharge
8. **Emails transaccionales** — Resend + templates
