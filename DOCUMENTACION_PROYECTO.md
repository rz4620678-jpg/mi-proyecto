# Documentación del sistema de facturas por cobrar

## 1. Resumen ejecutivo

El proyecto es una aplicación web para administrar facturas por cobrar, clientes,
productos y cobros. Los datos iniciales se tomaron de un archivo Excel y se
importaron a una base de datos MySQL/MariaDB. **El cliente trabaja desde el
sistema y los cambios se guardan en MySQL; Excel no es la base de datos de
operación diaria.**

La aplicación permite consultar y administrar la información importada, registrar
nuevas facturas y cobros, revisar saldos y generar reportes. No debe confundirse
con un sistema de emisión electrónica de comprobantes: en el código revisado no
se encontró integración con SUNAT, generación de XML tributario ni envío de
comprobantes electrónicos.

Este documento describe el código y las notas de conciliación disponibles en el
proyecto. Las cifras históricas aquí citadas deben compararse con una copia
actualizada de la base que se entregue al cliente antes de firmar la aceptación.

## 2. Componentes y tecnología

| Componente | Tecnología / función |
|---|---|
| Interfaz web | React 18 y Vite 5 |
| API | PHP; atiende rutas mediante `backend/api.php` |
| Base de datos | MySQL/MariaDB, conexión PDO |
| Servidor local documentado | XAMPP con Apache y MySQL |
| Exportación desde pantallas | Archivos CSV que se pueden abrir con Excel |
| Respaldo desde la aplicación | Descarga de datos en formato SQL |

La interfaz y la API se comunican mediante solicitudes HTTP sin iniciar sesión.
Las consultas a la base de datos usan consultas preparadas mediante PDO. Todas
las rutas, incluidas las operaciones de escritura, son públicas.

## 3. Funciones existentes

### Panel principal

- Indicadores de facturación, cobros, saldos pendientes, vencimientos y clientes.
- Selector de año y mes que aplica el período al dashboard; las facturas anuladas
  no se incluyen en cálculos de ventas, saldo ni cobros.
- Filtro anual y listado de facturas visible desde `facturas.php`.
- Gráficos de estado de cobranza y cobros mensuales.
- Lista de clientes con mayor deuda y accesos rápidos a operaciones.
- Alerta de registros incompletos importados desde Excel; permite completar la
  factura en el mismo panel y guardarla en la base de datos. El borrador no se
  suma a los totales mientras falten datos.
- Los números reservados por registros pendientes se omiten al generar nuevas
  facturas, para que no se reutilice accidentalmente su numeración.

### Facturas y detalle

- Consulta, búsqueda por datos de factura/cliente, filtrado por año y estado.
- Registro y edición de facturas con cliente, productos, cantidades y descuentos.
- Ingreso de varias guías por factura; los números heredados se conservan y la
  migración v2 los separa en filas independientes.
- Búsqueda rápida de productos por código SAP/interno, con códigos ligados al
  cliente cuando corresponde.
- En el historial de precios, escribir un código SAP/interno registrado
  selecciona el producto y filtra su historial automáticamente; el SAP del
  cliente es un dato distinto y no se interpreta como código de producto.
- En el detalle por factura se puede filtrar por año, mes, factura y nombre o
  código de producto, y también por cliente, RUC o SAP. El historial de precios
  permite buscar por código de producto y filtrar por año, mes y cliente. En el
  registro de cobros se puede buscar la factura por
  número, cliente, RUC o código SAP del cliente; también se pueden consultar
  los cobros históricos que aún no tienen banco asignado.
- Los códigos SAP de clientes y los códigos SAP/internos de productos no se
  inventan ni se deducen del Excel: se ingresan una vez desde los datos que
  proporciona la empresa/cliente y quedan guardados para las búsquedas futuras.
  En la factura, el SAP del cliente se puede escribir: si ya existe, selecciona
  al cliente; si es nuevo y ya se eligió un cliente, se guarda al salir del campo.
  El SAP general del cliente se busca de forma exacta y está separado del código
  SAP de producto. El código de producto se escribe en su fila; la primera vez
  se elige el producto correspondiente y se guarda el código global. Después
  identifica el producto en facturas, detalle e historial de precios. El Excel
  entregado no incluye esos códigos SAP.
- Precios de venta mostrados e ingresados con IGV, conservando importes netos en
  la base para no reescribir los cálculos históricos.
- Cálculo de subtotal, IGV, retención y total neto con los parámetros configurados.
- Penalidad porcentual opcional sobre el total, descontada del neto por cobrar.
- Adjuntos PDF de factura y de guía, enlazados desde el listado; las cargas se
  limitan a 10 MB y el servidor valida tipo MIME y extensión.
- Fecha de vencimiento calculada según los días de crédito indicados.
- Anulación con motivo; la factura se conserva en el historial.
- Consulta del detalle de productos y exportación de resultados a CSV.

Los números nuevos se generan en la serie `E001-`. Esa numeración del sistema no
implica por sí misma autorización tributaria ni emisión electrónica.

### Cobros y cuentas por cobrar

- Registro, edición, consulta y eliminación de cobros.
- Asociación del cobro a una factura, con fecha, monto, banco, forma de pago y
  observaciones.
- Restricción para que un nuevo cobro no exceda el saldo disponible calculado por
  el sistema.
- Filtros por año, mes y banco; desglose de subtotal e IGV y exportación del
  conjunto filtrado.
- Cálculo de saldo y estado de cobranza a partir del total neto, pagos y
  vencimiento.
- Exportación a CSV.

Los cobros históricos que ya exceden el total neto se conservan como fueron
importados. El sistema presenta el excedente por separado y no lo reasigna a
otras facturas.

### Clientes, productos y catálogos

- Alta, edición, búsqueda y consulta de clientes.
- Datos de cliente: razón social, RUC, código SAP, contacto, teléfono, correo y
  dirección; la fila se expande para mostrar su ficha y facturas pendientes.
- El código SAP es opcional: se puede ingresar al crear o editar al cliente, se
  guarda en la base y se puede buscar desde el filtro de clientes. En bases
  creadas antes de ese campo, se debe ejecutar `backend/migracion_v2.sql`; sin
  esa migración, la API no puede cargar el catálogo de clientes.
- Detección manual de posibles duplicados por RUC; unirlos requiere confirmación
  y no se hace automáticamente porque distintas sedes de EsSalud pueden compartirlo.
- Catálogo de productos con marca, presentación, unidad, precio y costo.
- Historial de precios por producto y cliente.
- Catálogos editables para bancos, formas de pago y motivos de anulación.

### Reportes

El código incluye reportes generales, ventas por año, cobranza por período,
deuda por cliente, facturas vencidas, cobros por banco, utilidad, productos más
vendidos e historial/resumen de precios. Los resultados se pueden exportar a
CSV.

### Configuración

- Datos de empresa y parámetros como IGV, retención y días de crédito.
- Personalización del color principal.
- Descarga de respaldo de datos en SQL y aviso dentro del sistema cuando no hay
  respaldo registrado o han pasado siete días desde la última descarga
  generada. El usuario debe guardar el archivo fuera del equipo; el aviso
  registra que se generó la descarga, pero no puede verificar dónde se guardó.
- El logo KB Clean se muestra en el menú lateral.

## 4. Base de datos

El SQL inicial crea nueve tablas en la base MySQL seleccionada. La tabla
`usuarios` queda vacía y no participa en el acceso a la aplicación:

| Tabla | Propósito |
|---|---|
| `clientes` | Datos de clientes |
| `productos` | Catálogo de productos y costos |
| `listas` | Bancos, formas de pago y motivos |
| `configuracion` | Parámetros generales y datos de empresa |
| `pendientes_importacion` | Filas incompletas del Excel fuera de facturas e informes |
| `facturas` | Cabecera, importes, fechas y estado de anulación |
| `factura_detalle` | Productos, cantidades, precios e importes por factura |
| `cobros` | Pagos asociados a las facturas |
| `factura_guias` | Varias guías y sus rutas de documentos por factura (migración v2) |
| `factura_documentos` | PDF original/sellado de cada factura (migración v2) |
| `producto_codigos` | Códigos SAP/internos de productos globales o por cliente (migración v2) |

La vista `v_facturas` expone las columnas de `facturas` y `anio`, calculado desde
`emision`. La vista `v_facturas_completo` conserva los cálculos de cobros, saldo,
excedentes, días y estado usados por el resto de las pantallas.

### Inicialización y migración

- `backend/database.sql` crea las tablas e importa el conjunto de datos preparado
  desde Excel en la base previamente seleccionada. **El script elimina y vuelve
  a crear las tablas**: no se debe
  importar sobre una base existente que se quiera conservar.
- `backend/conciliacion_cliente.sql` está destinado a adaptar una base ya activa
  sin volver a cargar todo el histórico. La documentación del proyecto indica
  que agrega los ajustes de conciliación sin duplicarlos al repetir la
  migración.
- `backend/pendientes_importacion.sql` agrega de forma idempotente la tabla de
  importaciones pendientes y deja `E001-121` en espera con sus importes fuente.
  En instalaciones existentes, respaldar primero y ejecutar esta migración una
  vez desde phpMyAdmin. No sustituye ni borra la base activa.
- `backend/migracion_v2.sql` agrega de manera idempotente los campos de código SAP,
  contacto y penalidad, además de las tablas de guías, documentos y códigos de
  productos. Migra las guías existentes separadas por `/`, deja los valores
  originales en `facturas.nro_guia`, completa únicamente vencimientos `NULL` y
  precarga el banco Continental si falta. Ejecutar después de sacar un respaldo;
  no ejecutar `database.sql` para actualizar una base existente.
- `backend/precios_con_igv.sql` es ahora una consulta informativa. La aplicación
  presenta los precios unitarios con IGV tanto si la base histórica los guarda
  netos como si ya los guarda con IGV; no es necesario convertir ni reescribir
  líneas históricas.
- El catálogo muestra dos columnas derivadas del detalle de la factura no
  anulada más reciente: precio con IGV y equivalente sin IGV calculado con la
-  tasa configurada. `backend/catalogo_precios_ultimo_detalle.sql` sincroniza
  además `productos.precio` con ese valor con IGV, sin modificar detalles ni
  totales históricos. Un producto sin ventas conserva el precio existente en
  la base y aparece sin historial; requiere ingresar el precio al facturarlo.
- `backend/catalogo_excel.sql` amplía el campo del nombre y corrige tres
  combinaciones de unidad/nombre que no coincidían con el Excel.
- `backend/detalle_anuladas_excel.sql` recupera idempotentemente las dos líneas
  del Excel ausentes en las facturas anuladas `E001-52` y `E001-57`. No reactiva
  las facturas ni cambia sus totales.
- Antes de importar o migrar, se debe sacar una copia completa y confirmar que
  se está usando el archivo/base correctos.

El SQL de inicialización contiene 39 clientes, 129 productos comerciales
(además de una fila técnica de ajuste), 120 facturas completas, la fila
`E001-121` fuera de facturas como pendiente, 265 líneas originales de detalle
(además de los ajustes de conciliación) y 86 cobros. Se contrastó ese archivo
SQL con el Excel adjunto en esta sesión; estas cifras no constituyen una
consulta en vivo a la base de datos que el cliente tenga abierta.

## 5. Diferencias de la importación que deben validarse

### Resultados comprobados contra el Excel adjunto

La comparación del SQL inicial con el Excel se hizo sobre los archivos fuente.
Además, el 19 de octubre de 2026 se hizo una consulta de solo lectura a la base
local de XAMPP; sus resultados se distinguen abajo de los del SQL inicial.

| Caso | Resultado de la comparación | Qué falta confirmar |
|---|---|---|
| 120 facturas | El SQL contiene `E001-1` a `E001-120`, coincidentes con las 120 facturas completas de la hoja `FACT`. | Contrastar de forma independiente con la base activa del cliente. |
| `E001-121` | La hoja `FACT` contiene subtotal S/ 20,917.7966, IGV S/ 3,765.203388 y total S/ 24,682.999988, pero no fecha, cliente, guía, orden de compra, estado, pago ni detalle. El SQL inicial lo conserva como pendiente. La base local consultada aún no tenía esa tabla, así que allí no estaba guardado. | Respaldar y ejecutar la migración de pendientes; luego confirmar sus datos con el cliente y completarlos desde la alerta del panel. |
| `E001-122` a `E001-131` | Son filas plantilla numeradas sin datos de factura. | No contarlas como facturas faltantes sin confirmación. |
| Detalle `VENTA` | Hay 265 líneas con cantidad numérica; el SQL tiene 265 líneas. La comparación por factura, cantidad e importe neto no encontró líneas `VENTA` ausentes en el SQL. | Esto solo verifica el SQL de inicialización, no la base activa. |
| Hoja `Hoja5` | Las 13 líneas con cantidad numérica coinciden con líneas ya existentes en `VENTA`. | No insertarlas de nuevo; duplicaría ventas. |
| Diferencia de precios | Excel expresa precios unitarios con IGV. La interfaz presenta el precio de detalle con IGV; en bases antiguas calcula la presentación al leer, sin modificar la línea. El catálogo muestra el precio con IGV de la factura no anulada más reciente y su equivalente sin IGV. Los importes de línea y subtotal permanecen sin cambios. | Confirmar la tasa de IGV configurada en la base activa. |
| `VASELINA LIQUIDA` | En `E001-1`, Excel muestra S/ 23.00; la última venta no anulada del detalle es `E001-12`, con S/ 27.00 con IGV (S/ 22.88 sin IGV). | El catálogo muestra ambas columnas de `E001-12`. El precio de `E001-1` sigue visible en su detalle histórico; no se reescriben líneas. |
| Costos | El Excel no incluye costo de compra; el SQL deja costo y utilidad histórica como `NULL`. | Aportar costos confiables antes de calcular utilidad histórica. |
| Estado textual | El sistema no conserva textualmente el estado de Excel (por ejemplo, `CANCELADO`); calcula sus propios estados según pagos y vencimientos. | Si se necesita trazabilidad, conservar por separado el estado original importado. |

Los precios históricos pueden variar entre facturas. La interfaz muestra para
cada producto el precio unitario con IGV de la factura no anulada más reciente
y calcula su equivalente sin IGV. El valor heredado `productos.precio` no se
usa como fuente. Al calcular una factura, el sistema convierte ese precio a
neto y conserva el subtotal y los totales históricos de línea y factura.

La comparación por nombre, marca y unidad encontró tres combinaciones de
catálogo distintas en la base local: una unidad que debe ser `60/40`, otra que
debe ser `GALLON` y un nombre de producto largo truncado. `catalogo_excel.sql`
corrige estas diferencias manteniendo los IDs de producto.

### Verificación de la base local de XAMPP

La consulta de solo lectura del 19 de octubre de 2026 encontró 131 filas en
`productos` (130 comerciales, con 129 combinaciones distintas de nombre/marca/
unidad, y una técnica de ajuste) y 290 filas en
`factura_detalle` (263 productos y 27 ajustes). En la base, las facturas
anuladas `E001-52` y `E001-57` tienen cero líneas, aunque el Excel contiene una
línea de producto para cada una. El Excel tiene 129 combinaciones
de producto, marca y unidad y 265 líneas numéricas en `VENTA`; 13 filas de
`Hoja5` repiten información de `VENTA`. Esos recuentos no significan que
phpMyAdmin solo tenga 25 filas: 25 es el tamaño de página que muestra por
defecto.

En esa base local no existía `pendientes_importacion`; por tanto, `E001-121` no
estaba guardada como pendiente en MySQL. La tabla y ese registro solo se crean
al ejecutar `backend/pendientes_importacion.sql`. No se modificó la base durante
esta verificación.

En una verificación posterior de esta actualización se encontraron las 120
facturas `E001-1` a `E001-120` (92 no anuladas). Antes de instalar la migración
de pendientes, `E001-121` no estaba ni en `facturas` ni en la tabla de borradores.
Se instaló la migración aditiva y quedó aparte del listado contable. El saldo
de las 120 facturas no anuladas consultado en esa base fue S/ 98,749.53; difiere
del S/ 72,888.40 indicado por el cliente y requiere conciliar facturas/cobros
con una copia de la base. No se alteraron sus importes ni sus detalles.

### Notas anteriores aún no verificadas contra la base activa

El README existente menciona una comparación de una base activa con 263 líneas,
ajustes y excedentes en ciertas facturas. Esa lista es antecedente, no resultado
de esta comparación del Excel adjunto con `database.sql`. Se debe revalidar con
un respaldo de la base activa antes de tratar esos casos como diferencias
confirmadas.

Los siguientes valores se conservan aquí únicamente para rastrear lo escrito
antes en el README; no están confirmados por la revisión del Excel adjunto:

| Caso | Diferencia documentada | Qué significa / qué confirmar |
|---|---|---|
| Líneas de detalle | La base activa tenía 263 líneas frente a 265 en el SQL preparado desde Excel. Las dos ausentes son de `E001-52` y `E001-57`, ambas anuladas. | Confirmar si se mantienen así por estar anuladas o si el cliente requiere recuperar el detalle. No fueron restauradas por la migración. |
| `E001-63`, `E001-65`, `E001-69` | No tenían líneas de producto; el ajuste agregado equivale al subtotal completo de cada factura. | El importe cuadra, pero el ajuste no reconstruye los productos vendidos. Solicitar o validar el detalle real. |
| `E001-84` | Las líneas activas se reportan en S/ 3,203.50; las líneas de producto del Excel suman S/ 2,714.83. | La diferencia entre los conjuntos es S/ 488.67. Las notas identifican un ajuste de conciliación por ese importe para cuadrar el detalle con el subtotal; confirmar con el cliente si el contenido del Excel o el de la base activa refleja los productos realmente vendidos. |
| `E001-88` | Las líneas activas se reportan en S/ 10,640.00; las líneas de producto del Excel suman S/ 9,016.94. | La diferencia entre los conjuntos es S/ 1,623.06. Las notas indican que el detalle activo excede en S/ 606.10 el subtotal oficial, mientras que el detalle del Excel requiere un ajuste de S/ 1,016.96 para alcanzarlo. Confirmar qué detalle e importe son correctos; no es una diferencia que pueda resolverse solo copiando una cifra. |
| `E001-108` | El detalle queda S/ 9.14 por debajo del subtotal oficial. | Confirmar si corresponde a un dato faltante o a una diferencia del origen. |
| `E001-117` | El detalle queda S/ 1.70 por encima del subtotal oficial. | Confirmar el importe correcto antes de cambiar el detalle. |
| Diferencias de centavos | 21 de los 27 ajustes de conciliación documentados son de S/ 0.01. | Revisar si el cliente acepta mantenerlos como ajustes aritméticos visibles. |
| Cobros superiores al total neto | 19 facturas tienen excedentes por un total documentado de S/ 1,033.93. | Los pagos originales se mantienen y el excedente se muestra por separado. Confirmar si son pagos aplicados a otra factura, anticipos, errores o saldos a favor. No reasignarlos sin autorización. |
| Datos que el Excel no contiene | No se informaban vencimientos históricos ni costos. Algunos cobros no tenían fecha. | Se dejan sin dato (NULL), no se inventan. Las utilidades históricas tampoco se pueden determinar sin costos confiables. |

### Qué hace y qué no hace la conciliación

El ajuste especial, marcado como **“AJUSTE DE CONCILIACION - NO ES PRODUCTO”**,
permite que la suma del detalle disponible coincida aritméticamente con el
subtotal oficial en las facturas correspondientes. Se excluye del catálogo y de
los reportes de productos vendidos. El SQL de inicialización crea esos ajustes
para las diferencias que detectó en sus propios datos preparados.

Ese ajuste no demuestra qué productos se vendieron, no corrige cantidades o
precios de origen y no decide a qué factura pertenece un pago excedente. No
añadir ajustes ni cambiar datos de la base activa sin revalidar el respaldo,
Excel y autorización del cliente.

## 6. Puesta en marcha según la configuración actual

### Desarrollo local

1. Instalar XAMPP y Node.js 18 o superior.
2. Colocar el proyecto dentro de `C:\xampp\htdocs\`.
3. Iniciar Apache y MySQL.
4. Seleccionar la base en phpMyAdmin e importar `backend\database.sql` solo si
   se va a crear la base desde cero.
5. Revisar las credenciales de conexión en `backend\config\database.php`.
6. En `frontend`, ejecutar `npm install` y `npm run dev`.
7. Abrir `http://localhost/sistema-facturass/facturas.php`.

### Publicación del frontend

El ZIP de InfinityFree incluye la interfaz compilada, la API PHP y el archivo
`facturas.php`. Apache y MySQL siguen siendo necesarios para que la aplicación
funcione.

La conexión local de base de datos actualmente está configurada con el usuario
`root` y contraseña vacía, un valor típico de un XAMPP local pero inadecuado
para un servidor público. Para la entrega, configurar un usuario MySQL exclusivo
con permisos mínimos y una contraseña robusta.

## 7. Mejoras recomendadas

Las siguientes son propuestas; no deben presentarse como funciones ya
implementadas.

### Prioridad antes de entregar

1. **Acceso público.** Entender y aprobar que no hay login ni restricción por
   enlace, o proteger la aplicación con una capa externa antes de compartirla.
2. **Acta de conciliación de datos.** Revisar con el cliente los casos de la
   tabla anterior y dejar por escrito si se aceptan, corrigen o quedan
   pendientes. Guardar una copia del Excel fuente y del respaldo final
   autorizado.
3. **Servidor de entrega seguro.** Configurar HTTPS, usuario MySQL no-root y
   secretos fuera de archivos públicos o del repositorio. Probar desde el equipo
   y red reales del cliente.
4. **Respaldo y recuperación.** Programar copias automáticas de la base,
   guardarlas fuera del servidor y hacer una prueba de restauración. El botón de
   respaldo actual descarga datos en SQL, pero no reemplaza una política de
   respaldos ni una prueba de recuperación.
5. **Pruebas de aceptación.** Probar acceso, creación/edición/anulación de una
   factura, cobro parcial y total, excedente, reportes, exportación y
   restauración en una copia de prueba.
6. **Alcance contractual claro.** Especificar si el producto es para control
   interno de cuentas por cobrar o si también se espera facturación electrónica,
   integración tributaria o emisión de comprobantes.

### Seguridad y control

- El sistema se entrega intencionalmente sin autenticación. Cualquier persona
  que conozca el dominio puede ver, alterar o borrar datos mediante las
  operaciones públicas; el enlace no restringe el acceso.
- Añadir autenticación y autorización antes de usar datos sensibles o dejar
  disponible la URL públicamente.
- Registrar auditoría de cambios importantes: quién creó, editó o anuló
  facturas, cambió cobros o modificó configuración, junto con fecha y valores
  anteriores/nuevos.

### Operación y funciones de negocio

- Añadir filtros de fechas, paginación y ordenamiento para tablas y reportes
  cuando aumente el volumen de información.
- Añadir importación de Excel con vista previa, validación de columnas,
  detección de duplicados, reporte de errores y confirmación antes de escribir
  en MySQL.
- Incorporar generación de PDF, impresión de documentos internos y recibos de
  pago, si el cliente los necesita.
- Añadir recordatorios de vencimiento y reportes de antigüedad de deuda
  (por ejemplo, 1–30, 31–60 y más de 60 días).
- Considerar conciliación bancaria, manejo explícito de anticipos/saldos a favor
  y asignación de pagos a varias facturas, con trazabilidad.
- Definir un mecanismo de numeración transaccional que evite duplicados si
  varias personas crean facturas al mismo tiempo.
- Si se requiere emisión fiscal real, definirla como un módulo separado que
  incluya requisitos tributarios, integración con el proveedor/SUNAT, pruebas y
  mantenimiento normativo.

### Calidad del producto

- Crear pruebas automatizadas para cálculos de IGV, retenciones, saldos,
  estados, anulación y conciliación.
- Preparar una base de pruebas con casos límite y ejecutar pruebas de regresión
  antes de cada actualización.
- Documentar responsable técnico, soporte, actualizaciones, disponibilidad,
  retención de datos y proceso de recuperación.
- Revisar rendimiento e índices con el volumen real de datos del cliente.

## 8. Lista de verificación para la entrega

- [ ] Cliente aprobó las diferencias de importación y los casos pendientes.
- [ ] Respaldo completo creado y restauración comprobada en ambiente de prueba.
- [ ] Acceso público entendido y aprobado o protegido por una capa externa.
- [ ] Usuario MySQL de producción separado de `root`, con permisos mínimos.
- [ ] HTTPS, dominio y acceso desde los equipos del cliente verificados.
- [ ] Pruebas de facturas, cobros, saldos, anulaciones y reportes aprobadas.
- [ ] Alcance definido: control de cobranza versus emisión electrónica.
- [ ] Manual breve de uso, contacto de soporte y procedimiento de respaldo
  entregados al cliente.

## 9. Archivos de referencia del proyecto

- `README.txt`: instrucciones de instalación, carga inicial y notas de
  conciliación existentes.
- `backend\database.sql`: creación inicial de base y datos importados; es
  destructivo para las tablas que crea.
- `backend\vistas_facturas.sql`: actualización no destructiva de las dos vistas
  requerida para una base existente.
- `backend\conciliacion_cliente.sql`: migración para conciliación de la base
  activa.
- `backend\pendientes_importacion.sql`: migración no destructiva para incorporar
  el registro incompleto E001-121 a una base existente.
- `backend\catalogo_excel.sql`: migración del catálogo. `precios_con_igv.sql`
  solo informa el estado de los precios; no modifica líneas históricas.
- `backend\detalle_anuladas_excel.sql`: recuperación idempotente de las dos
  líneas de productos ausentes en las facturas anuladas.
- `backend\config\database.php`: configuración de conexión MySQL.
- `backend\api.php`: punto de entrada y rutas de la API.
- `frontend\src\views`: pantallas principales de la aplicación.
