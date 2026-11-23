# MargenPro — plan de lanzamiento comercial

Estado: **beta pública gratuita**, sin acceso de pago implementado.

## Arquitectura actual
- Sitio estático en GitHub Pages.
- Catálogo y copias de trabajo en localStorage del navegador.
- Importación CSV/XLSX, exportación CSV y respaldo/restauración JSON.
- Sin cuentas, servidor, sincronización, base de datos ni licencias.
- El código del repositorio público es visible: ocultar botones con JavaScript **no** constituye control de acceso.

## Requisitos para una venta digital responsable
1. **Identidad y acceso**: autenticar al comprador mediante un proveedor de identidad y sesión de servidor.
2. **Entitlements**: asociar cada compra aprobada a una cuenta; verificar el permiso de uso del lado del servidor.
3. **Cobros**: crear preferencias/órdenes de Mercado Pago desde un backend; nunca incluir access tokens en HTML/JS públicos.
4. **Confirmación de pago**: recibir y validar webhooks de Mercado Pago en el backend; consultar el pago a la API antes de habilitar el acceso. No confiar solo en la URL de retorno.
5. **Entrega**: definir si se vende acceso alojado, software descargable o licencia; para acceso alojado, restringir funciones comerciales mediante servidor.
6. **Seguridad**: política de privacidad, condiciones de servicio, respaldo/recuperación, límites de uso y pruebas de fallos.
7. **Pruebas de punta a punta**: pagos aprobados, rechazados, pendientes, reembolsos, duplicados y expiración de sesiones.
8. **Validación comercial**: confirmar demanda, precio y soporte esperado con compradores potenciales.

## Decisiones pendientes del propietario
- Modelo de venta (pago único o suscripción).
- Cuenta de Mercado Pago habilitada para cobrar y titularidad del negocio.
- Plataforma backend y política de costos; GitHub Pages por sí solo no ejecuta backend seguro.

## No hacer
- No publicar credenciales o tokens en el repositorio.
- No prometer sincronización entre dispositivos que no existe.
- No cobrar por acceso restringido mientras el producto siga abierto en GitHub Pages.
- No afirmar que se han verificado pagos reales antes de hacer las pruebas correspondientes.
