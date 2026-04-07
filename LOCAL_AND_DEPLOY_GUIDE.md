# Guía de operación local + checklist DigitalOcean

## Parte 1 — Arrancar el proyecto en local

### 1.1 Descomprimir y abrir en VS Code

```bash
cd ~/proyectos
tar -xzf silvana-therapy-v2.tar.gz
cd silvana-therapy
code .
```

### 1.2 Instalar dependencias

Abre la terminal integrada de VS Code (`Ctrl + ñ`) y ejecuta:

```bash
npm install
```

Esto baja: Next.js 14, Supabase SSR, Stripe, PayPal, Google APIs, Resend, Zod, date-fns, Tailwind y TypeScript. Tarda ~2 minutos.

### 1.3 Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Abre `.env.local` y **solo llena estas cuatro variables** (por ahora dejamos el resto vacío, que son las integraciones externas):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3000
```

> Las tres primeras las sacas de **Supabase Dashboard → Settings → API**. La última déjala apuntando a localhost:3000, sin el `/admin` que tenía antes.

### 1.4 Levantar el servidor de desarrollo

```bash
npm run dev
```

Deberías ver algo como:

```
▲ Next.js 14.2.0
- Local:        http://localhost:3000
✓ Ready in 1.8s
```

Si aparece algún error de tipos en la consola, avísame — puede ser algo menor del dashboard que no tipé.

---

## Parte 2 — Acceder al admin en local

### Mapa de rutas disponibles

| URL | Qué es | Estado |
|---|---|---|
| `http://localhost:3000/` | Home pública | Placeholder con link al diseño |
| `http://localhost:3000/services` | Listado de servicios | Placeholder con link al diseño |
| `http://localhost:3000/services/consulta-gratis` | Detalle de servicio | Placeholder con link al diseño |
| `http://localhost:3000/booking` | Formulario de reserva | Placeholder con link al diseño |
| `http://localhost:3000/booking/confirmation` | Pantalla de éxito | Placeholder con link al diseño |
| `http://localhost:3000/booking/error` | Pantalla de error | Placeholder con link al diseño |
| `http://localhost:3000/login` | Login del admin | **✅ Funcional** |
| `http://localhost:3000/admin` | Redirige a dashboard | **✅ Funcional** |
| `http://localhost:3000/admin/dashboard` | Panel de administración | **✅ Funcional** |
| `http://localhost:3000/design-reference/home.html` | Diseño aprobado estático | Referencia |
| `http://localhost:3000/design-reference/booking.html` | Diseño aprobado estático | Referencia |
| (etc para cada HTML) | | |

### Flujo para acceder al dashboard

1. **Abre** `http://localhost:3000/login` en el navegador
2. **Ingresa** con el usuario admin que creaste en Supabase (Fase 2.4 de la guía anterior): email y password que definiste
3. Al hacer click en "Iniciar sesión":
   - Server Action valida con Zod
   - Llama a `supabase.auth.signInWithPassword()`
   - Si es correcto, setea la cookie de sesión
   - Redirige a `/admin/dashboard`
4. **En el dashboard** vas a ver el panel completo de Silvana con 6 secciones (Inicio, Mi Cuenta, Facturas, Calendario, Métodos de Pago, Configuración)
5. **Para cerrar sesión**: Configuración → Sesión → "Cerrar sesión" → confirmar. Esto llama al `logoutAction`, destruye la cookie y te manda a `/login`

### Comportamientos a validar

| Acción | Comportamiento esperado |
|---|---|
| Entrar a `/admin/dashboard` sin login | Redirige a `/login?redirect=/admin/dashboard` |
| Entrar a `/login` estando logueado | Redirige a `/admin/dashboard` |
| Login con credenciales incorrectas | Muestra "Email o contraseña incorrectos" |
| Login con email inválido | Muestra validación del campo email (Zod) |
| Click en "¿Olvidaste tu contraseña?" | Cambia a vista de reset dentro del mismo card |
| Click en mostrar/ocultar contraseña | Toggle del input type |
| Cerrar sesión desde el dashboard | Vuelve a `/login` con la cookie destruida |

### Nota importante sobre el dashboard

El dashboard que cargamos es tu JSX original adaptado. Los datos que ves (facturas, reservas, pacientes) son **datos mock hardcodeados** en el componente. **Todavía no están conectados a Supabase**.

Lo único que es real es:
- El **email del usuario logueado** se pasa como prop y se ve en la sección "Mi Cuenta"
- El **botón de cerrar sesión** sí funciona contra Supabase

El próximo paso (después de validar que el login funciona) es empezar a reemplazar los mocks por queries reales a la base de datos, sección por sección. Mi recomendación: empezar por **Reservas** ya que es la tabla con más tráfico esperado.

---

## Parte 3 — Checklist de DigitalOcean

Me dijiste que ya tenés el espacio dado de alta pero falta configurarlo. Revisá estos puntos en orden. Marcá cada uno en la consola de DigitalOcean:

### 3.1 Repositorio conectado

- [ ] Apps → Tu app → Settings → **App-level**
- [ ] Sección **Source**: debe mostrar tu repo de GitHub
- [ ] Branch: **`main`** (no `dev` ni `fix`)
- [ ] **Autodeploy on push**: habilitado

> Si todavía no conectaste GitHub, Settings → Source → Edit → autorizar DigitalOcean en GitHub → seleccionar repo `silvana-therapy` → branch `main`.

### 3.2 Build configuration

- [ ] Apps → Tu app → Settings → Components → **web** (el servicio principal)
- [ ] **Resource Type**: Web Service
- [ ] **Build Command**: *(déjalo vacío, el Dockerfile maneja todo)*
- [ ] **Run Command**: *(déjalo vacío, el Dockerfile maneja todo)*
- [ ] **Dockerfile Path**: `Dockerfile`
- [ ] **Source Directory**: `/` (raíz del repo)
- [ ] **HTTP Port**: `8080`

> El error más común acá es que DigitalOcean detecte Next.js como buildpack en vez de usar el Dockerfile. Si ves "Buildpack: Node.js" arriba, cambialo explícitamente a "Dockerfile".

### 3.3 Plan e instancia

- [ ] **Plan**: Basic
- [ ] **Instance Size**: `basic-xxs` ($5/mes) — suficiente para MVP
- [ ] **Instance Count**: 1
- [ ] **Region**: NYC (cercana a tu Supabase si también está en East US)

> Subir a `basic-xs` ($12/mes) solo si ves que el build falla por falta de memoria. El xxs tiene 512MB RAM y a veces Next.js build necesita más.

### 3.4 Variables de entorno

Apps → Tu app → Settings → Components → web → **Environment Variables**

**Variables obligatorias para que arranque (las 5 de Supabase + URLs):**

| Key | Scope | Type | Value |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | BUILD_TIME | Plain | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | BUILD_TIME | Plain | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | RUN_TIME | **Secret** | `eyJ...` |
| `NEXT_PUBLIC_APP_URL` | BUILD_TIME | Plain | `https://terapiasilvanalopez.com` |
| `NEXT_PUBLIC_ADMIN_URL` | BUILD_TIME | Plain | `https://admin.terapiasilvanalopez.com` |

> **Detalle crítico**: las variables `NEXT_PUBLIC_*` tienen que ser `BUILD_TIME` porque Next.js las inyecta en el bundle del cliente durante el `next build`. Si las dejás como `RUN_TIME`, van a aparecer como `undefined` en el navegador.
>
> El `SUPABASE_SERVICE_ROLE_KEY` tiene que ser `RUN_TIME` **y Secret** porque bypasea RLS. Jamás debe llegar al cliente.

**Variables opcionales (dejar vacías por ahora):**

Stripe, PayPal, Google Calendar, Resend — las llenamos cuando integremos cada servicio. El app arranca sin ellas porque no tocamos esos adapters todavía.

### 3.5 Dominio

- [ ] Apps → Tu app → Settings → **Domains**
- [ ] Si todavía no agregaste dominio: vas a tener una URL temporal tipo `silvana-therapy-xxxxx.ondigitalocean.app`
- [ ] **Para producción** (cuando estés listo):
  - Add Domain → `terapiasilvanalopez.com` → Primary
  - Add Domain → `admin.terapiasilvanalopez.com` → Alias
  - DigitalOcean te da los registros DNS a configurar en tu proveedor de dominio

### 3.6 Health checks

- [ ] Apps → Tu app → Settings → Components → web → **Health Checks**
- [ ] **HTTP Path**: `/` (la home responde 200 siempre, aunque sea placeholder)
- [ ] **Initial Delay**: 10 segundos
- [ ] **Period**: 10 segundos
- [ ] **Failure Threshold**: 3

### 3.7 Primer deploy de prueba

Antes de configurar el dominio, probá que el deploy funcione:

1. Push a `main` (o Force Rebuild & Deploy desde el dashboard)
2. Observá los logs en tiempo real: Apps → tu app → **Runtime Logs** o **Build Logs**
3. Build debería tardar 3-5 minutos
4. Cuando termine, clickeá la URL temporal `xxxxx.ondigitalocean.app`
5. Deberías ver el placeholder "Inicio" con el badge "Pendiente de portar"
6. Probá ir a `/login` directamente — debería cargar el formulario de login

Si el build falla, los errores más comunes son:
- **Missing environment variable en build time**: faltó marcar una `NEXT_PUBLIC_*` como `BUILD_TIME`
- **Out of memory**: subir a `basic-xs`
- **Dockerfile not found**: verificar que esté en la raíz del repo y que Source Directory sea `/`

### 3.8 Lo que NO hace falta configurar todavía

- ❌ Webhooks de Stripe/PayPal (los llenamos cuando integremos pagos)
- ❌ Service Account de Google Calendar
- ❌ Resend API key para emails

El app **no va a crashear** si estas variables están vacías, porque los adapters solo se instancian cuando se llaman sus funciones. Las rutas `/api/webhooks/stripe` y `/api/webhooks/paypal` van a fallar si alguien les hace POST, pero eso está bien — nadie las está llamando todavía.

---

## Parte 4 — Troubleshooting esperado

### "Module not found: Can't resolve '@/...'"

Tu `tsconfig.json` tiene el alias `@/*` apuntando a `./src/*`. Si falla, reinstalá dependencias:
```bash
rm -rf node_modules .next
npm install
npm run dev
```

### "Invalid login credentials" con credenciales correctas

1. Verificá en Supabase Dashboard → Authentication → Users que el usuario existe
2. Verificá que **Auto Confirm User** esté activado (el email confirmado aparece como un tick verde)
3. Si no, hacé click en el usuario → "Confirm email"

### El botón de logout no hace nada

Abrí el DevTools → Console y mirá si hay un error de Server Action. Si dice "Failed to fetch", es que el archivo `src/lib/actions/auth.ts` no está siendo detectado como Server Action. Verificá que el primer renglón sea exactamente `'use server';` (con comillas simples y punto y coma).

### "Cannot read properties of undefined" en el dashboard

El dashboard tiene `@ts-nocheck` así que no debería dar errores de tipos, pero si hay un error de runtime, mirá la consola del navegador. El más probable es que alguna sección dependa de datos mock que modificaste sin querer.

### El middleware redirige en bucle infinito

Esto pasa si el middleware no reconoce tu cookie de sesión. Verificá que las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` estén en `.env.local` y que hayas reiniciado el servidor de dev después de crearlas (`Ctrl+C` y `npm run dev` de nuevo).

---

## Próximos pasos (en orden de prioridad)

1. **Validar el login en local** — seguir los pasos de la Parte 2
2. **Hacer el primer deploy de prueba en DigitalOcean** — validar que la URL temporal carga
3. **Portar el formulario de `/booking`** a React real — es la ruta crítica del flujo público
4. **Conectar la sección "Calendario" del dashboard** a la tabla `bookings` real de Supabase
5. **Conectar la sección "Facturas" del dashboard** a las tablas `payments` y `payment_links`
6. **Agregar 2FA al login** — Supabase soporta TOTP nativamente
7. **Portar el resto de páginas públicas** (home, services, service-page, confirmation, error)
8. **Integrar Stripe** (cuando Silvana tenga la cuenta activa)
9. **Integrar PayPal** (idem)
10. **Integrar Google Calendar** (service account)
11. **Integrar Resend para emails transaccionales**

Con este orden, desde el punto 3 en adelante ya tenés un sistema que Silvana puede usar internamente, aunque las integraciones externas estén pendientes.
