# MargenPro — contrato de acceso comercial (implementación parcial, no desplegada)

**Estado:** backend de autenticación y consulta de licencias implementado parcialmente, pero sin proveedor de identidad ni base de datos configurados. La beta pública actual no exige autenticación ni licencias. Ningún endpoint comercial está desplegado.

## Componentes
- **Frontend**: interfaz de MargenPro (actualmente estática). No debe guardar secretos de pago.
- **Proveedor de identidad**: gestiona registro, inicio de sesión y verificación de correo.
- **Backend seguro**: valida sesión y permisos de compra, crea órdenes de pago, recibe webhooks.
- **Base de datos**: usuarios, órdenes, pagos, permisos de acceso y auditoría mínima.
- **Mercado Pago**: procesa pagos; el backend confirma su estado mediante API y notificaciones verificadas.

## Endpoints de la arquitectura (todos bajo HTTPS; algunos aún no implementados)

| Método | Ruta | Autenticación | Función |
| --- | --- | --- | --- |
| GET | /api/me | Obligatoria | Consultar si la cuenta autenticada está registrada (sin escribir en la base) |
| POST | /api/register | Obligatoria | Registrar de forma idempotente una identidad verificada |
| GET | /api/entitlement | Obligatoria | Estado de licencia vigente, verificado en servidor |
| POST | /api/checkout | Obligatoria | Crear orden y preferencia de pago con clave privada del servidor |
| POST | /api/webhooks/mercadopago | Verificación de firma | Recibir notificación; consultar estado real del pago y actualizar licencia |
| GET | /api/orders/:id | Obligatoria, propietario | Consultar orden sin confiar en parámetros del cliente |

## Reglas de seguridad
1. La clave privada de Mercado Pago se configura como secreto del backend, nunca en GitHub Pages.
2. El backend verifica autenticación y titularidad de cada orden.
3. Los webhooks requieren autenticación de origen/firma conforme a la documentación vigente de Mercado Pago, y confirmación del pago consultando la API oficial.
4. El estado de pago debe ser idempotente: recibir el mismo webhook dos veces no concede licencias duplicadas.
5. La URL de retorno del checkout es informativa y **no** activa licencias.
6. Una licencia debe tener usuario, producto, estado, fecha de concesión y política de revocación/reembolso.
7. La aplicación comercial debe verificar autorización del lado del servidor. Una bandera en localStorage o JavaScript público no es protección.
8. No migrar automáticamente catálogos locales a servidores sin informar y obtener consentimiento.

## Estados de una orden
- created: creada en nuestro backend
- pending: pendiente de confirmación
- approved: aprobada por verificación en servidor
- rejected: rechazada
- refunded: reembolsada/revocada según política
- cancelled: cancelada

## Pruebas necesarias
- Sesión ausente/expirada; acceso cruzado entre usuarios.
- Checkout duplicado; webhook duplicado y fuera de orden.
- Pago aprobado, pendiente, rechazado y reembolsado.
- Fallos temporales de API, reintentos, errores de firma.
- Acceso después de revocar licencia; usuario con licencia válida.
- Revisión de costos, protección de datos y soporte.

## Decisiones antes de activar cobros reales
1. Elegir infraestructura para backend y autenticación.
2. Elegir pago único o suscripción, y precio final.
3. Configurar una cuenta de Mercado Pago bajo control del propietario.
4. Acordar términos de venta, política de reembolsos y tratamiento de datos.

No se han configurado cobros, contratado servicios ni publicado credenciales.
