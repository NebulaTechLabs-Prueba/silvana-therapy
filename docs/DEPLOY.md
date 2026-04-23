# Guía de Deploy — Silvana Therapy

Deploy al Droplet de DigitalOcean (Ubuntu 24.04, 1 GB RAM). Para desarrollo local ver [DEVELOPMENT.md](DEVELOPMENT.md). Para la entrega de credenciales al cliente ver [HANDOVER.md](HANDOVER.md).

---

## 1. Infraestructura

| Recurso | Valor |
|---|---|
| Hosting | DigitalOcean Droplet `SilvanaLopez` |
| IP pública | `138.197.7.16` |
| SO | Ubuntu 24.04.3 LTS |
| RAM | 1 GB nominal, ~458 MiB útiles (+ 2 GB swap) |
| Acceso | Consola web DigitalOcean como `root` |
| Path del proyecto | `/opt/silvana-therapy` |
| Process manager | `pm2` (proceso `silvana`, fork mode, puerto 3000) |
| Runtime Next.js | **standalone output** (`.next/standalone/server.js`) |
| Env vars | `/opt/silvana-therapy/.env.local` |

> ⚠️ **Memoria**: el droplet tiene ~458 MiB de RAM útil (no 1 GB pleno). El build de Next se queda sin RAM si no hay swap suficiente y si V8 no está limitado. Reglas:
> - Mantener al menos **2 GB de swap** activos (`free -h` debe mostrarlo).
> - Compilar siempre con `NODE_OPTIONS="--max-old-space-size=1536"`.
> - **Parar pm2 antes de buildear** (`pm2 stop silvana`) para que los ~150 MiB del proceso Node no compitan con el build. Arrancarlo de vuelta después con `pm2 restart silvana`.
> - Si el build muere igual, reiniciar el droplet antes de reintentar — la memoria suele estar fragmentada tras intentos fallidos.

---

## 2. Acceso al Droplet

1. DigitalOcean → Droplets → **SilvanaLopez** → botón **Console**.
2. Se abre una terminal web como `root@SilvanaLopez`.
3. Entrar al proyecto:

```bash
cd /opt/silvana-therapy
```

> El repo **no** está en `/root/silvana-therapy`. Si dudas, `find / -name "silvana-therapy" -type d -maxdepth 4 2>/dev/null`.

---

## 3. Deploy estándar (actualización)

Flujo normal cuando hay merge a `main` y toca desplegar:

```bash
cd /opt/silvana-therapy
git status                                    # árbol limpio
git pull origin main
NODE_OPTIONS="--max-old-space-size=1536" npm run build
cp -r public .next/standalone/ 2>/dev/null
cp -r .next/static .next/standalone/.next/
pm2 restart silvana
pm2 logs silvana --lines 50                   # verificar arranque
```

### Qué hace cada paso

| Paso | Por qué |
|---|---|
| `git pull origin main` | Trae los últimos cambios de producción |
| `NODE_OPTIONS=... npm run build` | Compila Next con límite de heap V8 a 1024 MB — sin esto, el build muere por OOM |
| `cp -r public .next/standalone/` | Standalone mode **no** copia `public/` automáticamente; hay que hacerlo a mano cada build |
| `cp -r .next/static .next/standalone/.next/` | Standalone mode tampoco copia los assets estáticos (`_next/static/...`); mismo deal |
| `pm2 restart silvana` | Reinicia el proceso Node con el nuevo build |
| `pm2 logs silvana` | Confirma que Next arrancó sin errores (`✓ Ready in Xms`) |

---

## 4. Setup inicial de pm2 (solo primera vez)

Si el proceso `silvana` aún no existe en pm2, o hay que recrearlo desde cero:

```bash
cd /opt/silvana-therapy
pm2 delete silvana 2>/dev/null
pm2 start .next/standalone/server.js --name silvana -- -p 3000
pm2 save
pm2 startup                                   # genera comando systemd para autoarranque
```

Ejecutar la línea que imprime `pm2 startup` (algo como `sudo env PATH=... pm2 startup systemd -u root --hp /root`) para que pm2 levante `silvana` tras un reboot del Droplet.

Verificar:

```bash
pm2 list
pm2 logs silvana --lines 50
curl -I http://localhost:3000
```

---

## 5. Env vars en el servidor

El archivo vive en `/opt/silvana-therapy/.env.local`. Para editarlo:

```bash
nano /opt/silvana-therapy/.env.local
```

Ver [DEVELOPMENT.md § 3](DEVELOPMENT.md) para la referencia completa de variables. Diferencias con el `.env.local` de desarrollo:

```
NEXT_PUBLIC_APP_URL=https://silvanalopez.com
NEXT_PUBLIC_ADMIN_URL=https://admin.silvanalopez.com
GOOGLE_REDIRECT_URI=https://admin.silvanalopez.com/api/google/callback
PAYPAL_MODE=live                              # solo cuando el cliente vaya a producción real
```

> Tras editar `.env.local` hay que **rebuildear** — las `NEXT_PUBLIC_*` se inlinean en compile time. `pm2 restart` sin rebuild no las recoge.

### Ritual correcto para recargar env vars (no-públicas)

Next.js standalone no relee `.env.local` en runtime, y pm2 hereda el entorno **solo al arrancar**. Un `pm2 restart silvana` a secas NO recoge cambios. Flujo:

```bash
cd /opt/silvana-therapy
nano .env.local
set -a && source .env.local && set +a      # carga el archivo al shell actual
pm2 restart silvana --update-env            # pm2 re-lee del shell
pm2 logs silvana --lines 30
```

- `set -a` exporta automáticamente cada asignación; `--update-env` obliga a pm2 a re-leer.
- Si `source` falla con error de sintaxis, **detente y corrige antes de restartear**: el source se aborta a mitad del archivo y las vars posteriores quedan sin cargar.
- Caso observado: `EMAIL_FROM=Silvana López <noreply@silvanalopez.com>` sin comillas rompe el source (`<` es redirección en bash). Solución: siempre envolver con `"..."` → `EMAIL_FROM="Silvana López <noreply@silvanalopez.com>"`.

### NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

Next.js 14 cifra los IDs de Server Actions con una key que **se regenera en cada build** si no está fijada. Consecuencia: cualquier pestaña del panel abierta ANTES del deploy envía IDs viejos y el servidor responde `Failed to find Server Action "x"` — el action no ejecuta, silenciosamente.

Fix: fijar la variable en `.env.local` del droplet, UNA SOLA VEZ, y no rotarla.

```bash
openssl rand -hex 32
# Pegar salida como:
#   NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<hex>
```

Rebuildear + restartear con el ritual estándar. A partir de ahí los deploys no rompen sesiones abiertas.

Síntomas si se olvida: errores `Failed to find Server Action` en `pm2 logs silvana --err`, typicamente cada vez que Silvana (u otro admin) interactúa con el panel tras un deploy sin haber recargado.

### Precedencia DB > env para SMTP

El código del panel lee la config SMTP de `admin_settings` primero y solo cae a las env vars si la tabla está vacía. Consecuencia: si la fila en DB tiene credenciales, editar `SMTP_*` en `.env.local` **no tiene efecto visible** hasta que se vacíe la fila. Al hacer el swap a Silvana, decidir una sola fuente de verdad (normalmente el panel) y no mezclar.

---

## 6. Migraciones de base de datos

No se aplican desde el Droplet. Flujo:

1. Abrir Supabase Dashboard → SQL Editor.
2. Ejecutar la migración nueva (`supabase/migrations/0XX_*.sql`) a mano.
3. Luego hacer el deploy del código que la usa.

Se hace en este orden (DB primero, código después) para evitar errores 500 por columnas que el código espera y la DB todavía no tiene.

### Migraciones existentes

| Archivo | Propósito |
|---|---|
| `001_baseline.sql` | Schema base consolidado (enums, tablas, RLS, triggers, seed de `admin_settings`) |
| `002_imported_service.sql` | Añade columna `services.is_internal` y seed del servicio "Importado de Google Calendar" (placeholder para eventos importados desde Google Calendar cuyo servicio original se desconoce; oculto en `/services` y `/booking`) |
| `003_admin_timezone.sql` | Añade columna `admin_settings.admin_timezone` + CHECK con lista de TZs IANA permitidas. Permite que Silvana opere el panel en su zona (ej. Argentina/Mendoza) mientras el negocio sigue siendo Miami. Default `America/New_York` preserva comportamiento previo |
| `004_display_timezones.sql` | Añade `admin_settings.email_display_tz` y `form_display_tz` (mismo set de TZs permitidas). Una controla la zona mostrada en correos al paciente, la otra en el formulario público. Extiende `get_public_contact()` RPC para exponer `form_display_tz` al form público. Default de ambas `America/New_York` |
| `005_optional_client_email.sql` | `clients.email` pasa a NULL permitido + UNIQUE parcial cuando no es null. Nuevo CHECK `chk_clients_contact_present` exige que cada cliente tenga al menos email o teléfono. Habilita importar eventos de Google Calendar sin attendee y registrar pacientes que solo coordinan por WhatsApp |

---

## 6-bis. Cron: recordatorios 24h

El endpoint [`/api/cron/reminders`](../src/app/api/cron/reminders/route.ts) envía recordatorios por correo a las reservas confirmadas cuya `confirmed_date` cae en `[now+23h, now+25h]` y que aún no tienen `reminder_sent_at`. Marca cada envío como procesado para evitar duplicados.

**Protección:** requiere header `Authorization: Bearer $CRON_SECRET`. Si la env var no está, el endpoint responde 500.

**Setup inicial:**

1. Generar un secreto aleatorio:
   ```bash
   openssl rand -base64 32
   ```
2. Añadirlo a `/opt/silvana-therapy/.env.local`:
   ```
   CRON_SECRET=<secreto-generado>
   ```
3. `pm2 restart silvana` para que Next.js lo recoja.
4. Configurar crontab del droplet:
   ```bash
   crontab -e
   ```
   Añadir (reemplazar `<SECRETO>` por el valor real):
   ```
   */30 * * * * curl -sS -H "Authorization: Bearer <SECRETO>" https://admin.silvanalopez.com/api/cron/reminders > /var/log/silvana-reminders.log 2>&1
   ```
   Cada 30 min es suficiente para la ventana de 2h del endpoint (no corre el riesgo de saltar un recordatorio).
5. Verificar el primer disparo en `/var/log/silvana-reminders.log` y en `pm2 logs silvana`.

**Apagar temporalmente:** comentar la línea del crontab (`#` al principio). No hace falta tocar la app.

---

## 7. Troubleshooting

### `git pull` rechaza por cambios locales

```
error: Your local changes to the following files would be overwritten by merge:
    next.config.js
```

Alguien (o un build previo) tocó un archivo tracked en el servidor. Revisar antes de descartar:

```bash
git diff next.config.js                        # ver qué cambió
git stash                                      # guardar por si acaso
git pull origin main
git stash drop                                  # si no hacía falta
```

### Build muere con "JavaScript heap out of memory"

Olvido del `NODE_OPTIONS`. Repetir con el prefijo exacto:

```bash
NODE_OPTIONS="--max-old-space-size=1536" npm run build
```

Si aun así falla, revisar swap: `free -h` — debería haber 1–2 GB de swap. Si no hay, crear uno de 2 GB:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### pm2 logs: "Next.js doesn't work with 'output: standalone' configuration"

El `next.config.js` no tiene `output: 'standalone'` o el build no regeneró `.next/standalone/`. Verificar:

```bash
grep output next.config.js                      # debe decir output: 'standalone'
ls .next/standalone/server.js                   # debe existir
```

Si falta, rehacer el build (paso 3).

### 404 en assets `/` (logo, fuentes, `_next/static/...`)

Olvido de los dos `cp -r` post-build. Volver a copiarlos y `pm2 restart silvana`.

### pm2 muestra el proceso como `errored` o `stopped`

```bash
pm2 logs silvana --err --lines 100              # ver stack trace
pm2 describe silvana                            # path, env, restarts
```

Causas comunes: env var faltante, puerto 3000 ocupado (`lsof -i :3000`), permisos de `.next/standalone/`.

---

## 8. Rollback rápido

Si un deploy rompe producción y hay que volver al commit anterior:

```bash
cd /opt/silvana-therapy
git log --oneline -5                            # identificar el commit bueno
git checkout <sha-anterior>
NODE_OPTIONS="--max-old-space-size=1536" npm run build
cp -r public .next/standalone/ 2>/dev/null
cp -r .next/static .next/standalone/.next/
pm2 restart silvana
```

Luego, en local, abrir un `fix/*` que revierta el cambio problemático y seguir el gitflow normal (ver [DEVELOPMENT.md § 4](DEVELOPMENT.md)) para dejar `main` limpio.

---

## 9. Pendientes de infraestructura (TODO)

Cosas que aún no están documentadas aquí porque no se han tocado en esta sesión — añadir cuando se verifiquen en el Droplet:

- Config de **Nginx** (reverse proxy hacia `localhost:3000`, rutas para `silvanalopez.com` y `admin.silvanalopez.com`).
- Renovación automática de certificados **Let's Encrypt** (`certbot renew` vía cron/systemd timer).
- Backups automáticos del Droplet (snapshot semanal en DigitalOcean).
- Logs rotados de pm2 (`pm2 install pm2-logrotate`).
