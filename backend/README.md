# Backend comercial de MargenPro — preparación de despliegue

**Estado: no desplegado.** La beta de GitHub Pages sigue siendo pública y local. Este backend todavía no cobra, no emite licencias y no protege las funciones de la beta. No activar pagos ni anunciar protección comercial antes de completar y verificar todos los puntos.

## Componentes implementados
- `worker.js`: `GET /api/health`, `GET /api/me`, `POST /api/register`, `GET /api/entitlement`. Checkout y webhooks devuelven 503.
- `auth.js`: valida firma RS256, emisor, audiencia, vencimiento y sujeto del JWT con claves JWKS.
- `entitlements.js`: consulta de licencias activas, órdenes aprobadas y vencimientos.
- `migrations/0001_initial.sql`: esquema SQLite/D1 con controles de integridad.

## Preparación (sin desplegar)
1. Elegir un proveedor OIDC compatible que emita **access tokens RS256 para la audiencia de la API**, con URL JWKS HTTPS controlada por el proveedor. No usar ID tokens como sustituto de access tokens.
2. Crear la base Cloudflare D1 bajo una cuenta propia y anotar su ID. Revisar precios y límites antes de activar servicios.
3. Copiar `wrangler.toml.example` a `wrangler.toml` y sustituir **todos** los valores REPLACE. No incluir credenciales en GitHub. El archivo de ejemplo es solo plantilla.
4. Aplicar la migración en un entorno de pruebas, verificar el esquema y crear el registro de producto `margenpro` con un ID estable. No registrar pagos ficticios en producción.
5. Ejecutar las pruebas con Node 22 y Python 3:
   ```sh
   node tests/smoke.cjs
   node tests/backend.cjs
   node tests/order-state.cjs
   node tests/entitlements.cjs
   node tests/auth.cjs
   node tests/integration.cjs
   python3 tests/database.py
   ```
6. Configurar dominio HTTPS y `FRONTEND_ORIGIN` con el origen exacto del frontend (por ejemplo, `https://martinbulla05-star.github.io` sin ruta). El Worker admite solicitudes preflight únicamente desde ese origen; CORS no sustituye la autenticación. No usar `Access-Control-Allow-Origin: *` para endpoints autenticados.
7. Probar en un entorno aislado usuarios nuevos, existentes, tokens inválidos, licencia ausente, licencia vencida, reembolso y fallos de base de datos.
8. **Antes de cobrar**: implementar checkout, validación de firma de webhooks, consulta al API de Mercado Pago, idempotencia y reembolsos; aprobar precio y modalidad; revisar términos, privacidad y soporte.
9. **Antes de vender**: mover funciones comerciales protegidas al backend o a un mecanismo que realmente exija autorización. Un frontend estático público no puede ocultar código ni impedir su uso mediante un simple indicador local.

## Advertencias de seguridad
- El endpoint `POST /api/register` registra únicamente una identidad cuyo JWT haya sido validado. `GET /api/me` no escribe.
- El `GET /api/entitlement` no crea usuarios. Un usuario sin registro recibe `active: false`.
- El backend no expone claves privadas de pago.
- Los parámetros OIDC deben configurarse desde la cuenta del propietario. El código no ofrece aún gestión de contraseñas, recuperación ni verificación de correo: esas tareas corresponden al proveedor elegido.
- Las pruebas con dobles de base de datos **no equivalen** a una prueba de despliegue real.

## Commercial launch gate

The public beta is not a protected paid application. Before enabling payments, deploy D1 and the Worker, configure an OIDC provider with Authorization Code + PKCE and API access tokens, connect cuenta.html to commercial-client.mjs, enforce paid features server-side, implement refund reconciliation, and verify end-to-end sandbox purchase and duplicate notifications. Keep PAYMENTS_ENABLED=false until all gates pass. Never commit credentials.
