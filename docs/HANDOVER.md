# Guía de Entrega — Silvana Therapy

Esta guía cubre todo lo que debe cambiarse al entregar el proyecto a Silvana López, para desvincular las credenciales de desarrollo y dejar el sistema funcionando con las cuentas de ella.

> **Importante:** durante el desarrollo se usaron cuentas provisionales (Resend, Google Cloud, Google Calendar). Si no se cambian, Silvana dependerá del correo del dev para siempre y el dev recibirá eventos/emails de sus pacientes reales.

---

## Orden recomendado

1. **Preparar cuentas de Silvana** (Cloudflare, Resend, Google Cloud) — parte 1 a 3
2. **Cambiar credenciales en el deploy** — parte 4
3. **Desconectar credenciales del dev en el panel** — parte 5
4. **Verificación final** — parte 6

**Tiempo estimado total:** 45–90 minutos si todo va bien. Si los DNS tardan en propagarse, hasta 24 h para completar todo (pero puede hacerse por partes).

---

## Parte 1 — Cloudflare (gestión de DNS)

**Por qué**: el dominio `silvanalopez.com` está registrado en Wix, pero Wix no permite los registros MX en subdominios que Resend necesita para verificar dominios. Solución: delegar la gestión de DNS a Cloudflare (gratis), sin mover el dominio de Wix. El dominio sigue siendo propiedad de Silvana en Wix; solo cambia quién administra los registros.

### Pasos

1. Abrir [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) y crear una cuenta con el correo de Silvana.
2. Click en **Add a Site** → escribir `silvanalopez.com` → Continue.
3. Elegir plan **Free** → Continue.
4. Cloudflare escanea los DNS actuales de Wix. **Revisar** que los registros importantes aparezcan:
   - `A` o `CNAME` de `@` (raíz) y `www` apuntando a Wix (mantienen la web funcionando).
   - Cualquier otro registro que Silvana tenga en Wix (subdominios, etc.).
5. Continue → Cloudflare muestra **2 nameservers** como:
   ```
   xxxxx.ns.cloudflare.com
   yyyyy.ns.cloudflare.com
   ```
   Copiar ambos.

### Cambiar nameservers en Wix

1. Login en Wix con la cuenta de Silvana → **Domains**.
2. Click en `silvanalopez.com` → **Advanced** → **Name Servers** (o "Change nameservers").
3. Seleccionar **"Use different name servers"** / **"Custom"**.
4. Reemplazar los nameservers de Wix con los 2 de Cloudflare → **Save**.
5. Wix confirma el cambio. Propagación: de 5 min a 24 h, normalmente < 1 h.
6. Cloudflare envía un email **"Your site is now active"** cuando detecta el cambio.

> **Advertencia**: si la web de Silvana estaba en Wix, sigue funcionando porque los registros A/CNAME se copiaron. No se pierde nada.

---

## Parte 2 — Resend (emails transaccionales)

### 2.1 Crear cuenta

1. Abrir [https://resend.com/signup](https://resend.com/signup) y registrarse con el correo de Silvana.
2. Verificar el email de confirmación.

### 2.2 Verificar el dominio

1. Ir a [https://resend.com/domains](https://resend.com/domains) → **Add Domain**.
2. Ingresar `silvanalopez.com` → región recomendada **US East (N. Virginia)** por proximidad a Miami → **Add**.
3. Resend muestra una lista de **registros DNS** (normalmente: 1 TXT SPF + 3 CNAME DKIM + opcional 1 TXT DMARC). Dejar esta pantalla abierta.

### 2.3 Añadir los DNS en Cloudflare

1. En otra pestaña, ir a [Cloudflare dashboard](https://dash.cloudflare.com) → click en `silvanalopez.com` → **DNS** → **Records**.
2. Por cada registro que muestra Resend, click **Add record** y copiarlo exactamente:
   - **Type**: TXT o CNAME según indique Resend.
   - **Name**: el valor que da Resend (ej. `resend._domainkey` — Cloudflare completa el resto del dominio solo).
   - **Content / Target**: el valor largo que da Resend (pegar tal cual, sin espacios extras).
   - **Proxy status**: **DNS only** (nube **gris**, nunca naranja) para todos los registros de email.
   - **TTL**: Auto.
   - Save.
3. Repetir hasta añadir los 3-4 registros de Resend.

### 2.4 Verificar en Resend

1. Volver a Resend → Domains → `silvanalopez.com` → **Verify DNS Records**.
2. Esperar 1–10 min. Si da error, esperar otros 10 min y reintentar (DNS pueden tardar en propagarse).
3. Cuando quede en verde ✅ **Verified**, el dominio está listo.

### 2.5 Generar API Key

1. Ir a [https://resend.com/api-keys](https://resend.com/api-keys) → **Create API Key**.
2. **Name**: `Silvana Therapy Production`.
3. **Permission**: **Sending access**.
4. **Domain**: `silvanalopez.com`.
5. Create → **COPIAR LA CLAVE INMEDIATAMENTE**, solo se muestra una vez.
6. Guardarla en un sitio seguro (gestor de contraseñas).

### 2.6 Cargar la API Key en el panel

Opción A — desde el panel admin (recomendado):
1. Login en el panel admin de Silvana Therapy.
2. Dashboard → **Integraciones** → **Correo (Resend)**.
3. Pegar la API Key en el campo correspondiente.
4. **Remitente (email)**: `noreply@silvanalopez.com` (o el que prefiera).
5. **Nombre remitente**: `Silvana López`.
6. Guardar.

Opción B — vía variables de entorno del deploy:
```
RESEND_API_KEY=re_xxx
EMAIL_FROM=Silvana López <noreply@silvanalopez.com>
```
(El panel lee de la base de datos primero; si está vacío, cae a las env vars.)

---

## Parte 3 — Google Cloud (OAuth para Calendar + Meet)

### 3.1 Crear proyecto

1. Abrir [https://console.cloud.google.com](https://console.cloud.google.com) con la cuenta Google de Silvana (la misma del calendario que quiere usar).
2. Barra superior → selector de proyecto → **New Project**.
3. **Project name**: `Silvana Calendar` → Create.
4. Esperar a que se cree y seleccionarlo en la barra superior.

### 3.2 Habilitar Calendar API

1. Menú hamburguesa ☰ → **APIs & Services** → **Library**.
2. Buscar `Google Calendar API` → click → **Enable**.

### 3.3 Configurar Google Auth Platform

1. Menú ☰ → **APIs & Services** → **OAuth consent screen** (o "Google Auth Platform" → Overview → **Get Started**).
2. **User Type**: **External** → Create.
3. **App Information**:
   - App name: `Silvana Therapy`
   - User support email: correo de Silvana
   - Developer contact: correo de Silvana
   - Next
4. **Audience** → External → Next.
5. **Scopes**:
   - Menú lateral → **Data Access** (o "Acceso a los datos") → **Add or remove scopes**.
   - Añadir estos 3 manualmente (pegar en "Manually add scopes" si no los encuentra en la tabla):
     ```
     https://www.googleapis.com/auth/userinfo.email
     https://www.googleapis.com/auth/calendar
     https://www.googleapis.com/auth/calendar.events
     ```
   - Update → Save.
6. **Test users** (solo mientras la app esté en Testing):
   - Menú lateral → **Audience** → **+ Add users** → añadir el correo Google de Silvana.
   - Como ella es la **owner** del proyecto, puede autorizarse a sí misma sin problema.
7. Los campos de "Branding" (privacy policy, terms, homepage) pueden quedar **vacíos** mientras esté en modo Testing.

### 3.4 Crear OAuth Client

1. Menú ☰ → **APIs & Services** → **Credentials** (o "Google Auth Platform" → **Clients**).
2. **+ Create Credentials** → **OAuth client ID**.
3. **Application type**: **Web application**.
4. **Name**: `Silvana Therapy Production`.
5. **Authorized redirect URIs** → **+ Add URI**:
   ```
   https://admin.silvanalopez.com/api/google/callback
   ```
   (Ajustar al dominio real del panel admin. Si también quiere usarlo en local para pruebas, añadir también `http://localhost:3000/api/google/callback`.)
6. Create.
7. **COPIAR** el **Client ID** y el **Client Secret** del modal. El secret solo se muestra una vez.

### 3.5 Cargar credenciales en el deploy

En las variables de entorno del hosting (Vercel, Netlify, Render, etc.):
```
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu-secret
GOOGLE_REDIRECT_URI=https://admin.silvanalopez.com/api/google/callback
```

Redeploy para que los valores nuevos tomen efecto.

---

## Parte 4 — Desvincular credenciales del dev

### 4.1 Desconectar Google del dev desde el panel

1. Login al panel admin con la cuenta de Silvana.
2. Dashboard → **Integraciones** → **Google Calendar + Meet**.
3. Click en **Desconectar**. Esto borra la fila de `google_integrations` (tokens del dev) y revoca el acceso.
4. El badge cambia a "No conectado".

### 4.2 Conectar la cuenta de Silvana

1. En la misma sección → **Conectar con Google**.
2. Login con la cuenta Google de **Silvana** (la misma configurada en el Google Cloud project del paso 3).
3. Aceptar los permisos (verá los 3 scopes solicitados).
4. Vuelve al dashboard con toast "Google conectado" y el badge en verde mostrando su email.

### 4.3 Borrar API Key del dev en Resend

Si durante el desarrollo quedó la API Key del dev guardada en `admin_settings.resend_api_key`:

1. Dashboard → Integraciones → Correo (Resend).
2. Reemplazar el valor por la API Key nueva de Silvana (de la parte 2.5).
3. Guardar.

El dev también debería **revocar su propia API Key de Resend** en [resend.com/api-keys](https://resend.com/api-keys) para que no quede flotando.

---

## Parte 5 — Resumen de variables de entorno a cambiar

Estas son las vars que deben actualizarse en el hosting de producción al entregar. Las demás (Supabase, Stripe, PayPal, etc.) dependen de si Silvana también quiere sus propias cuentas — ver sección "Otras integraciones" abajo.

| Variable | Antes (dev) | Después (Silvana) |
|----------|-------------|-------------------|
| `GOOGLE_CLIENT_ID` | Cuenta Google Cloud del dev | Cuenta Google Cloud de Silvana |
| `GOOGLE_CLIENT_SECRET` | idem | idem |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/...` | `https://admin.silvanalopez.com/api/google/callback` |
| `RESEND_API_KEY` | API key de dev | API key de Silvana (o dejar vacía y usar la del panel) |
| `EMAIL_FROM` | `onboarding@resend.dev` | `Silvana López <noreply@silvanalopez.com>` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://silvanalopez.com` |
| `NEXT_PUBLIC_ADMIN_URL` | `http://localhost:3000/admin` | `https://admin.silvanalopez.com/admin` |

**Env vars que ya NO se usan** (limpiar si aparecen en deploys antiguos):
- `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` — obsoleta, reemplazada por OAuth flow.
- `GOOGLE_CALENDAR_ID` — obsoleta, ahora se lee de `google_integrations.calendar_id` en DB.

---

## Parte 6 — Verificación final

Pruebas que deben pasar antes de dar el proyecto por entregado:

### 6.1 Email
- [ ] Crear una reserva de prueba desde la web pública con el correo de Silvana como cliente.
- [ ] Silvana recibe "Hemos recibido tu solicitud" en su bandeja.
- [ ] Revisar en [resend.com/logs](https://resend.com/logs) que el email salió desde `noreply@silvanalopez.com`.
- [ ] Confirmar la reserva desde el admin.
- [ ] Silvana recibe "Tu cita ha sido confirmada" con botón "Unirse a la videollamada".
- [ ] Click en el botón abre Google Meet correctamente.

### 6.2 Google Calendar / Meet
- [ ] El evento confirmado aparece en el calendario personal de Silvana.
- [ ] El horario está en hora Miami (America/New_York).
- [ ] El enlace Meet del evento coincide con el del email.
- [ ] Rechazar una reserva de prueba: el evento no se crea, llega email de rechazo.

### 6.3 Desvinculación del dev
- [ ] En el panel → Integraciones → Google muestra el email de **Silvana**, no el del dev.
- [ ] Ningún email de prueba llegó al correo del dev.
- [ ] El dev revocó su API Key de Resend y (opcionalmente) eliminó el proyecto Google Cloud temporal.

---

## Otras integraciones (opcionales en la entrega)

### Stripe / PayPal
Si Silvana quiere recibir pagos en sus propias cuentas:

1. **Stripe**: [dashboard.stripe.com](https://dashboard.stripe.com) → crear cuenta → obtener `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → actualizar env vars.
2. **PayPal**: [developer.paypal.com](https://developer.paypal.com) → crear app → obtener credenciales → actualizar env vars → cambiar `PAYPAL_MODE` de `sandbox` a `live` cuando esté lista.

Estas integraciones son opcionales — el sistema funciona sin ellas y solo bloquea la generación de enlaces de pago hasta que estén configuradas.

### Supabase
La base de datos está en un proyecto Supabase creado por el dev. Si Silvana quiere tener el backend en su propia cuenta Supabase (recomendable a largo plazo por facturación y propiedad de datos):

1. Crear proyecto en [supabase.com](https://supabase.com) con el correo de ella.
2. Ejecutar todas las migraciones (`supabase/migrations/*.sql`) en orden.
3. Exportar datos del proyecto viejo e importarlos.
4. Actualizar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` en el deploy.

Esta migración puede posponerse — el proyecto puede seguir funcionando en el Supabase del dev indefinidamente si no se quiere hacer el traspaso ahora.

---

## Notas para Silvana (guía simplificada)

Cuando acompañes a Silvana en vivo (por videollamada) para hacer este traspaso, estos son los momentos en los que **ella debe actuar**:

1. **Cloudflare** → crear cuenta (con su correo + contraseña nueva).
2. **Wix** → cambiar nameservers (ella pone su usuario/contraseña de Wix; tú indicas dónde pegar).
3. **Resend** → crear cuenta, verificar email, añadir dominio, generar API Key.
4. **Google Cloud** → login con su cuenta Google, seguir el wizard paso a paso.
5. **Panel admin** → "Conectar con Google" y autorizarse a sí misma.

Todo lo demás (pegar env vars, redeploy, verificar logs) lo haces tú.

**Tiempo estimado en sesión en vivo con Silvana**: 60–90 min, asumiendo que los DNS propaguen rápido.
