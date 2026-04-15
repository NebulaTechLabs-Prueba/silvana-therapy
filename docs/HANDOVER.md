# Guía de Entrega — Silvana Therapy

Esta guía cubre todo lo que debe cambiarse al entregar el proyecto a Silvana López, para desvincular las credenciales de desarrollo y dejar el sistema funcionando con las cuentas de ella.

> **Importante:** durante el desarrollo se usaron cuentas provisionales (Brevo, Google Cloud, Google Calendar). Si no se cambian, Silvana dependerá del correo del dev para siempre y el dev recibirá eventos/emails de sus pacientes reales.

---

## Contexto de infraestructura (antes de empezar)

- **Hosting**: DigitalOcean Droplet 1GB (~$6/mes). IP `138.197.7.16`.
- **Dominio**: `silvanalopez.com` registrado en **Wix** (solo como registrador — el sitio Wix no está activo).
- **DNS**: gestionados desde el panel de Wix. Los registros A ya apuntan al Droplet.
- **Bloqueo ICANN 60 días**: el dominio fue registrado recientemente en Wix, lo cual activa un candado automático de transferencia impuesto por ICANN hasta el **5 de junio de 2026**. Durante ese período:
  - ❌ NO se puede mover el dominio a otro registrador (GoDaddy, Namecheap, etc.).
  - ❌ NO se pueden cambiar los nameservers a un proveedor externo (Cloudflare, etc.).
  - ✅ SÍ se pueden editar los registros DNS (A, CNAME, TXT, MX) dentro del panel de Wix.
- **Por qué no Cloudflare**: se evaluó inicialmente delegar DNS a Cloudflare, pero Wix tampoco permite cambiar nameservers sin transferencia, bloqueada por el mismo candado ICANN. Por eso se abandonó esa vía.
- **Por qué no Resend**: Resend exige verificar el dominio vía registros MX en un subdominio (`send.silvanalopez.com`), cosa que Wix DNS no permite. Por eso se usa Brevo, que funciona con TXT y CNAME estándar (que Wix sí soporta).

---

## Orden recomendado

1. **Preparar cuentas de Silvana** (Brevo, Google Cloud) — parte 1 y 2
2. **Cambiar credenciales en el deploy** — parte 3
3. **Desconectar credenciales del dev en el panel** — parte 4
4. **Verificación final** — parte 5

**Tiempo estimado total:** 45–90 minutos si todo va bien. Si los DNS tardan en propagarse, hasta 24 h para completar todo (pero puede hacerse por partes).

---

## Parte 1 — Brevo (emails transaccionales vía SMTP)

**Por qué Brevo**: plan gratuito de 300 emails/día, SMTP estándar compatible con cualquier cliente (nodemailer), y verificación de dominio usando solo TXT + CNAME — sin exigir registros MX en subdominios (incompatibles con Wix DNS).

> **Nota**: el código soporta cualquier proveedor SMTP (Mailgun, SES, Postmark, Zoho, etc.). Si Silvana prefiere otro, los pasos son análogos: crear cuenta, verificar dominio, obtener credenciales SMTP, pegarlas en el panel. Brevo es la opción sugerida por su generosidad en plan gratuito y simplicidad.

### 1.1 Crear cuenta en Brevo

1. Abrir [https://www.brevo.com/](https://www.brevo.com/) → **Sign up free** con el correo de Silvana.
2. Verificar el email de confirmación.
3. Completar el perfil inicial (nombre, empresa = "Silvana López Psicóloga", tipo de uso = "Transactional emails").

### 1.2 Autenticar el dominio `silvanalopez.com`

1. En Brevo, click en el ⚙️ (arriba derecha, junto a "Uso y plan") → **Senders, Domains & Dedicated IPs**.
2. Pestaña **Domains** → **Add a domain** → escribir `silvanalopez.com` → Save.
3. Brevo muestra un modal con dos opciones: elegir **"Autentica tú mismo el dominio"** (la automática no soporta Wix).
4. Brevo lista **4 registros DNS** que hay que añadir en Wix:
   - 1× **TXT** (código Brevo, host vacío — raíz del dominio): valor tipo `brevo-code:xxxx...`
   - 2× **CNAME** (DKIM): hosts `brevo1._domainkey` y `brevo2._domainkey`, apuntando a `b1.silvanalopez-com.dkim.brevo.com` y `b2.silvanalopez-com.dkim.brevo.com` respectivamente
   - 1× **TXT** (DMARC): host `_dmarc`, valor `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` — ⚠️ **debe empezar con `v=DMARC1`, con la `v` al principio**; sin la `v` el registro es inválido.
5. Dejar esta pestaña de Brevo abierta.

### 1.3 Añadir los 4 registros DNS en Wix

1. En otra pestaña, login en Wix → **Dominios** → `silvanalopez.com` → **Administrar DNS**.
2. Desplazarse hasta encontrar las secciones **CNAME (alias)** y **TXT (texto)**.
3. **CNAME DKIM 1**: **+ Agregar registro** en la sección CNAME:
   - Host: `brevo1._domainkey`
   - Valor: `b1.silvanalopez-com.dkim.brevo.com`
   - Guardar.
4. **CNAME DKIM 2**: **+ Agregar registro** en la sección CNAME:
   - Host: `brevo2._domainkey`
   - Valor: `b2.silvanalopez-com.dkim.brevo.com`
   - Guardar.
5. **TXT código Brevo**: **+ Agregar registro** en la sección TXT:
   - Host: **vacío** (o `@` si Wix no acepta vacío — ambos significan la raíz)
   - Valor: el `brevo-code:xxxx...` tal cual
   - Guardar.
6. **TXT DMARC**: **+ Agregar registro** en la sección TXT:
   - Host: `_dmarc`
   - Valor: `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` (verificar que empieza con `v=`)
   - Guardar.

> ⚠️ **NO tocar** los registros A existentes (`silvanalopez.com`, `admin.silvanalopez.com`, `www.silvanalopez.com` → `138.197.7.16`). Esos son los que hacen que la web funcione.

### 1.4 Verificar en Brevo

1. Volver a la pestaña de Brevo → final de la pantalla → click **"Autenticar este dominio de email"**.
2. La propagación de DNS desde Wix tarda entre 5 y 30 min. Si falla al primer intento, esperar y reintentar — **no recrear los registros**.
3. Verificar propagación en paralelo desde [https://dnschecker.org](https://dnschecker.org) buscando `brevo1._domainkey.silvanalopez.com` con tipo CNAME.
4. Cuando el estado del dominio en Brevo pase a **Autenticado** ✅, continuar.

### 1.5 Generar la SMTP Key

1. En Brevo, click en el avatar/nombre arriba a la derecha → **SMTP & API**. Atajo: [https://app.brevo.com/settings/keys/smtp](https://app.brevo.com/settings/keys/smtp)
2. Pestaña **SMTP**. Anotar de esta pantalla:
   - **SMTP Server**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **Login**: `xxxxxxx@smtp-brevo.com` ← será el **Usuario SMTP**
3. Click en **"Generate a new SMTP key"**:
   - Name: `silvana-therapy-prod`
   - Generate → Brevo muestra la clave completa (tipo `xsmtpsib-...`) en un modal.
   - ⚠️ **COPIAR LA CLAVE INMEDIATAMENTE** — solo se muestra una vez. Guardarla en el gestor de contraseñas.

### 1.6 Cargar las credenciales SMTP en el panel admin

Opción A — desde el panel admin (recomendado):
1. Login en el panel admin de Silvana Therapy.
2. Dashboard → **Integraciones** → **Correo (SMTP)**.
3. Rellenar:
   - **Host**: `smtp-relay.brevo.com`
   - **Puerto**: `587`
   - **TLS directo (465)**: **No (STARTTLS)**
   - **Usuario**: el login copiado del paso 1.5 (`xxxxxxx@smtp-brevo.com`)
   - **Contraseña / API Key**: la SMTP key (`xsmtpsib-...`)
   - **Remitente (email)**: `noreply@silvanalopez.com`
   - **Remitente (nombre)**: `Silvana López`
4. Guardar. El badge debe cambiar a "Conectado" (verde).

Opción B — vía variables de entorno del deploy:
```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=xxxxxxx@smtp-brevo.com
SMTP_PASSWORD=xsmtpsib-...
EMAIL_FROM="Silvana López <noreply@silvanalopez.com>"
```

> **Precedencia DB > env**: el panel lee de `admin_settings` primero y solo cae a las env vars si la tabla está vacía. Lo que Silvana guarde en el panel **gana** sobre `.env.local`. Consecuencia: tras usar la Opción A, editar env vars SMTP en el droplet no tiene efecto visible hasta que se vacíe la fila en DB. Si vas por Opción B, asegúrate de que el panel esté sin credenciales guardadas.

> ⚠️ **Comillas obligatorias en `EMAIL_FROM`**: el valor contiene `<` y `>`, que bash interpreta como redirecciones al hacer `source .env.local`. Sin comillas, el source aborta a mitad del archivo y las variables posteriores (`GOOGLE_*`, `CRON_SECRET`, …) quedan sin cargar. Siempre envolver con `"..."`.

---

## Parte 2 — Google Cloud (OAuth para Calendar + Meet)

### 2.1 Crear proyecto

1. Abrir [https://console.cloud.google.com](https://console.cloud.google.com) con la cuenta Google de Silvana (la misma del calendario que quiere usar).
2. Barra superior → selector de proyecto → **New Project**.
3. **Project name**: `Silvana Calendar` → Create.
4. Esperar a que se cree y seleccionarlo en la barra superior.

### 2.2 Habilitar Calendar API

1. Menú hamburguesa ☰ → **APIs & Services** → **Library**.
2. Buscar `Google Calendar API` → click → **Enable**.

### 2.3 Configurar Google Auth Platform

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

### 2.4 Crear OAuth Client

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

### 2.5 Cargar credenciales en el deploy

En las variables de entorno del hosting (Vercel, Netlify, Render, etc.):
```
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu-secret
GOOGLE_REDIRECT_URI=https://admin.silvanalopez.com/api/google/callback
```

Redeploy para que los valores nuevos tomen efecto.

---

## Parte 3 — Desvincular credenciales del dev

### 3.1 Desconectar Google del dev desde el panel

1. Login al panel admin con la cuenta de Silvana.
2. Dashboard → **Integraciones** → **Google Calendar + Meet**.
3. Click en **Desconectar**. Esto borra la fila de `google_integrations` (tokens del dev) y revoca el acceso.
4. El badge cambia a "No conectado".

### 3.2 Conectar la cuenta de Silvana

1. En la misma sección → **Conectar con Google**.
2. Login con la cuenta Google de **Silvana** (la misma configurada en el Google Cloud project del paso 2).
3. Aceptar los permisos (verá los 3 scopes solicitados).
4. Vuelve al dashboard con toast "Google conectado" y el badge en verde mostrando su email.

### 3.3 Reemplazar SMTP key del dev por la de Silvana

Durante el desarrollo se usó una cuenta Brevo del dev con su propia SMTP key. Al entregar:

1. Dashboard → **Integraciones** → **Correo (SMTP)**.
2. Reemplazar los campos **Usuario** y **Contraseña / API Key** por los generados con la cuenta Brevo de Silvana (parte 1.5).
3. Host, puerto, remitente permanecen iguales si Silvana también usa Brevo.
4. Guardar.

El dev también debería **revocar su propia SMTP key de Brevo** entrando a [https://app.brevo.com/settings/keys/smtp](https://app.brevo.com/settings/keys/smtp) → seleccionar la key del dev → eliminar. Así no queda flotando ninguna credencial viva asociada al proyecto.

---

## Parte 4 — Resumen de variables de entorno a cambiar

Estas son las vars que deben actualizarse en el `.env` del Droplet al entregar. Las demás (Supabase, Stripe, PayPal) dependen de si Silvana también quiere sus propias cuentas — ver sección "Otras integraciones" abajo.

| Variable | Antes (dev) | Después (Silvana) |
|----------|-------------|-------------------|
| `GOOGLE_CLIENT_ID` | Cuenta Google Cloud del dev | Cuenta Google Cloud de Silvana |
| `GOOGLE_CLIENT_SECRET` | idem | idem |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3000/...` | `https://admin.silvanalopez.com/api/google/callback` |
| `SMTP_HOST` | `smtp-relay.brevo.com` (dev) | `smtp-relay.brevo.com` (Silvana) |
| `SMTP_USER` | Login Brevo del dev | Login Brevo de Silvana |
| `SMTP_PASSWORD` | SMTP key del dev | SMTP key de Silvana |
| `EMAIL_FROM` | correo provisional del dev | `"Silvana López <noreply@silvanalopez.com>"` (con comillas) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://silvanalopez.com` |
| `NEXT_PUBLIC_ADMIN_URL` | `http://localhost:3000/admin` | `https://admin.silvanalopez.com/admin` |

### Ritual para aplicar cambios de env en el Droplet

Next.js standalone **no** relee `.env.local` en runtime, y pm2 hereda el entorno **solo al arrancar el proceso**. Un `pm2 restart silvana` a secas NO recoge cambios en `.env.local`. Flujo correcto tras editar el archivo:

```bash
cd /opt/silvana-therapy
nano .env.local                       # editar lo que haga falta
set -a && source .env.local && set +a # cargar al shell actual
pm2 restart silvana --update-env      # pm2 re-lee del shell
pm2 logs silvana --lines 30           # verificar arranque
```

- `set -a` marca cada var asignada como exportada automáticamente.
- `--update-env` fuerza a pm2 a tomar el entorno actual en lugar del cacheado.
- Si `source` se queja con un error de sintaxis en alguna línea, **detente y corrige** — el source se aborta y las vars posteriores no se cargan (esto fue la causa raíz de CRON_SECRET vacío tras una edición reciente — ver nota sobre `EMAIL_FROM` en parte 1.6).
- Para cambios en `NEXT_PUBLIC_*` hay que **rebuildear** además, porque esas vars se inlinean en compile time.

**Env vars que ya NO se usan** (limpiar si aparecen en deploys antiguos):
- `RESEND_API_KEY` — obsoleta, reemplazada por `SMTP_*`.
- `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` — obsoleta, reemplazada por OAuth flow.
- `GOOGLE_CALENDAR_ID` — obsoleta, ahora se lee de `google_integrations.calendar_id` en DB.

---

## Parte 5 — Verificación final

Pruebas que deben pasar antes de dar el proyecto por entregado:

### 5.1 Email
- [ ] Crear una reserva de prueba desde la web pública con el correo de Silvana como cliente.
- [ ] Silvana recibe "Hemos recibido tu solicitud" en su bandeja.
- [ ] Revisar en el dashboard de Brevo ([app.brevo.com/statistics](https://app.brevo.com/statistics)) que el email salió desde `noreply@silvanalopez.com`.
- [ ] Confirmar la reserva desde el admin.
- [ ] Silvana recibe "Tu cita ha sido confirmada" con botón "Unirse a la videollamada".
- [ ] Click en el botón abre Google Meet correctamente.

### 5.2 Google Calendar / Meet
- [ ] El evento confirmado aparece en el calendario personal de Silvana.
- [ ] El horario está en hora Miami (America/New_York).
- [ ] El enlace Meet del evento coincide con el del email.
- [ ] Rechazar una reserva de prueba: el evento no se crea, llega email de rechazo.

### 5.3 Desvinculación del dev
- [ ] En el panel → Integraciones → Google muestra el email de **Silvana**, no el del dev.
- [ ] En el panel → Integraciones → Correo (SMTP) muestra las credenciales de Silvana.
- [ ] Ningún email de prueba llegó al correo del dev.
- [ ] El dev revocó su SMTP key de Brevo y (opcionalmente) eliminó el proyecto Google Cloud temporal.

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

1. **Brevo** → crear cuenta (con su correo + contraseña nueva), verificar email, autenticar dominio y generar SMTP key.
2. **Wix** → entrar al panel de DNS para pegar los 4 registros que pide Brevo (2 CNAME + 2 TXT). Ella pone su usuario/contraseña de Wix; tú indicas dónde pegar.
3. **Google Cloud** → login con su cuenta Google, seguir el wizard paso a paso para crear proyecto, habilitar Calendar API, configurar consent screen y generar OAuth Client.
4. **Panel admin** → pegar credenciales SMTP en "Integraciones → Correo (SMTP)", luego click en "Conectar con Google" y autorizarse a sí misma.

Todo lo demás (pegar env vars en el Droplet, redeploy, verificar logs) lo haces tú.

**Tiempo estimado en sesión en vivo con Silvana**: 60–90 min, asumiendo que los DNS propaguen rápido.

> **Recordatorio**: el bloqueo ICANN del dominio en Wix expira el **5 de junio de 2026**. A partir de esa fecha Silvana (o un dev futuro) podría transferir el dominio a un registrador con mejor panel DNS (Cloudflare, Namecheap, Porkbun) si se quiere más flexibilidad. Mientras tanto el setup actual con Brevo + Wix DNS es plenamente funcional.
