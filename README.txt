SISTEMA DE FACTURAS POR COBRAR SIN LOGIN (PHP + MySQL + React)

PUBLICAR EN INFINITYFREE
1) Sube y descomprime Facturas-SIN-LOGIN-InfinityFree.zip en public_html.
2) En el panel de InfinityFree crea una base MySQL y usuario.
3) Si vas a crear la base desde cero, selecciona esa base en phpMyAdmin e
   importa backend\database.sql. Este archivo reemplaza las tablas y los datos.
   Si ya tienes datos, respáldalos y ejecuta backend\vistas_facturas.sql en la
   base existente; no importes database.sql porque borra y vuelve a cargar las
   tablas. Si la base existente aún no tiene la columna codigo_sap, ejecuta
   backend\migracion_v2.sql desde phpMyAdmin para poder registrar y buscar el
   código SAP de cada cliente.
4) En backend\config\database.php reemplaza CAMBIAR_HOST_MYSQL,
   CAMBIAR_NOMBRE_BASE, CAMBIAR_USUARIO_MYSQL y CAMBIAR_CLAVE_MYSQL por los
   valores del panel de InfinityFree. También puedes definir las variables
   FACTURAS_DB_HOST, FACTURAS_DB_NAME, FACTURAS_DB_USER y
   FACTURAS_DB_PASSWORD en el entorno PHP.
5) Abre https://tu-dominio/facturas.php. index.php redirige al mismo sistema.

IMPORTANTE: no hay login ni control de acceso. Cualquier persona que conozca
el enlace puede ver, crear, editar, anular y cobrar facturas, cambiar la
configuración y descargar respaldos. Compartir un enlace no limita el acceso.
No publiques información sensible sin proteger el sitio con controles del
servidor o una capa de acceso privada.

Requisitos:
- XAMPP con Apache y MySQL
- Node.js 18 o superior

INICIO EN DESARROLLO
1) Coloca esta carpeta dentro de C:\xampp\htdocs\ (por ejemplo:
   C:\xampp\htdocs\sistema-facturass).
2) Inicia Apache y MySQL desde el panel de XAMPP.
3) Abre phpMyAdmin e importa backend\database.sql. Este script borra y crea
   de nuevo las tablas; respalda la base antes si ya tienes datos.
4) Si MySQL tiene una clave, actualiza backend\config\database.php.
5) En una terminal ejecuta:

   cd C:\xampp\htdocs\sistema-facturass\frontend
   npm install
   npm run dev

6) Abre http://localhost/sistema-facturass/facturas.php. Para desarrollo con
   Vite, abre la dirección que indique (normalmente http://localhost:5173).

BASE DE DATOS ADAPTADA Y CONCILIACION
backend\database.sql prepara la base desde cero con los datos importados del
Excel: 39 clientes, 129 productos distintos por nombre/marca/unidad, 120 facturas, 265 lineas originales de
detalle y 86 cobros con importe informado. Tambien agrega lineas identificadas
como "AJUSTE DE CONCILIACION - NO ES PRODUCTO" para que el detalle sume el
subtotal oficial de cada factura, incluyendo diferencias de centavos. Esas
lineas no aparecen como productos vendidos ni en el catalogo o reportes de
productos. La base contiene nueve tablas y las vistas v_facturas y
v_facturas_completo; la tabla usuarios queda vacia y no se usa para login.
El catalogo incluye 129 productos comerciales y una fila tecnica de ajuste.

Para adaptar la base activa SIN borrarla ni volver a cargar los datos,
respalda primero la base y ejecuta una sola vez
backend\conciliacion_cliente.sql desde phpMyAdmin. La migracion agrega la marca
de ajuste, concilia los detalles que ya existen, deja vencimientos/costos/
utilidades desconocidos como NULL y actualiza la vista. Es compatible con
MariaDB 10.4 y puede ejecutarse nuevamente sin duplicar ajustes. No importes
backend\database.sql sobre una base que quieras conservar: ese script elimina
y crea las tablas.

En una base nueva, database.sql incluye la fila pendiente E001-121. Desde la
alerta del panel se puede completar en el mismo dashboard con los datos reales;
al guardar, se registra en la base de datos y desaparece de los pendientes. El
borrador no se suma a facturas ni reportes mientras no se confirme, y el numero
queda reservado para que una factura nueva no lo ocupe.

Para una base existente, crea un respaldo y ejecuta estas migraciones antes de
actualizar la aplicacion:
1) backend\catalogo_excel.sql amplia la columna del nombre y corrige tres
   descripciones/unidades comparadas con Excel.
2) backend\catalogo_precios_ultimo_detalle.sql actualiza productos.precio
   desde el precio de la ultima factura no anulada, con IGV. Solo cambia el
   precio del catalogo, no los detalles ni los importes historicos.
3) backend\detalle_anuladas_excel.sql recupera las dos lineas del Excel que
   faltaban en las facturas anuladas E001-52 y E001-57. No reactiva esas
   facturas ni cambia sus totales; se puede ejecutar nuevamente sin duplicar.
4) backend\pendientes_importacion.sql guarda E001-121 con los unicos importes
   disponibles en Excel. No inventa fecha, cliente ni detalle.
5) backend\migracion_v2.sql agrega los codigos SAP/contacto de clientes,
   penalidad, multiples guias, documentos PDF y codigos de productos. Separa
   las guias existentes por "/" sin borrar nro_guia, agrega CONTINENTAL solo si
   no existe y completa vencimientos faltantes. Es idempotente y no elimina
   tablas ni filas. Respalda la base y ejecutala una vez desde phpMyAdmin antes
   de usar la nueva version. En particular, esta migracion agrega codigo_sap y
   contacto_nombre a clientes: sin ella la aplicacion no puede cargar ni
   guardar clientes en una base antigua. El codigo SAP se puede ingresar al
   crear o editar un cliente y luego usar para filtrar la lista.
Las migraciones conservan los IDs existentes y no borran tablas ni filas.

El numero 25 que se ve en phpMyAdmin es la cantidad de filas por pagina, no el
total del catalogo. En el Excel VENTA hay 265 lineas numericas y 129
combinaciones de producto/marca/unidad; 13 lineas de Hoja5 repiten datos de
VENTA. En la base local consultada habia 130 filas comerciales de catalogo y
290 detalles contando 27 ajustes; tras las migraciones se recuperan las dos
lineas que faltaban de facturas anuladas.

El listado de facturas pagina de 25 en 25; revisa el indicador de paginacion
al pie de la tabla para avanzar y ver el total de resultados. E001-121 se
mantiene fuera de facturas hasta confirmar sus datos y no se incluye en los
saldos mientras siga como borrador.

Los precios unitarios se presentan con IGV incluido, como en Excel. En bases
antiguas que guardan el detalle sin IGV, la aplicación calcula el precio de
presentación al leerlo; no reescribe el detalle ni los importes históricos.
El catálogo muestra el precio con IGV de la factura no anulada más reciente y
su equivalente sin IGV, calculado con la tasa configurada. Si no hay historial,
no muestra un precio. El valor con IGV se obtiene del detalle facturado, no de
un valor manual del catálogo. Para calcular facturas el sistema obtiene el neto
y mantiene subtotal y total de detalle netos.

El Excel no informa vencimientos ni costos. No se inventan fechas ni costos;
los vencimientos historicos, costo de productos, costo de lineas y utilidad
quedan sin dato. El precio unitario guarda IGV incluido y los importes de
detalle y subtotal se conservan netos para el calculo tributario. Los cobros se conservan exactamente como fueron importados. Si el
cobro supera el total neto, la vista muestra el excedente por separado y el
saldo nunca queda negativo. Los cobros sin fecha siguen sin fecha.

Los ajustes hacen visible la diferencia aritmetica entre el subtotal y los
detalles disponibles, pero no reconstruyen productos faltantes ni prueban que
el importe excedente haya sido aplicado a otra factura. Las facturas con
detalles faltantes, diferencias de origen o pagos que no cuadran deben ser
confirmadas por el cliente; no se alteran silenciosamente los cobros.

Resultado de la conciliacion de la base activa: se agregan 27 ajustes. E001-63,
E001-65 y E001-69 no tenian lineas de producto; su ajuste equivale al subtotal
completo y requiere que el cliente entregue/valide el detalle real. E001-88
tenia S/ 606.10 de detalle por encima del subtotal; E001-108 tenia S/ 9.14 por
debajo y E001-117 S/ 1.70 por encima. Los otros 21 ajustes son diferencias de
un centimo. El SQL muestra el detalle conciliado y el ajuste de cada factura
al terminar la migracion.

Hay 19 facturas con cobros que exceden el total neto, por un total de
S/ 1,033.93. El sistema mantiene esos cobros originales y muestra el excedente
por factura; no lo reasigna ni lo descuenta de otra factura.

La comparacion de lineas encontro 263 detalles en la base activa frente a 265
en el SQL del Excel. Las dos lineas que faltan corresponden a E001-52 y
E001-57, ambas anuladas. No se restauraron ni se cambiaron lineas de producto
en la migracion. Para entregar con trazabilidad, el cliente debe revisar dos
diferencias de contenido: en E001-84 las lineas activas suman S/ 3,203.50,
mientras las lineas del Excel suman S/ 2,714.83; en E001-88 las activas suman
S/ 10,640.00 y las del Excel S/ 9,016.94. Los ajustes aplicados cuadran las
lineas activas con sus subtotales, pero no cambian esos precios/cantidades para
hacerlos parecer iguales al Excel. Si se confirma que el Excel es la fuente
correcta para esas lineas, deben corregirse con una autorizacion expresa y
manteniendo visibles los respectivos ajustes de S/ 488.67 y S/ 1,016.96.

El proxy de Vite apunta al Apache local y detecta automáticamente el nombre de
la carpeta del proyecto. Si Apache usa un puerto distinto al 80, añade el
puerto a `target` en frontend\vite.config.js.

PUBLICAR SIN NODE.JS
Desde frontend ejecuta:

   npm run build

Luego abre http://localhost/sistema-facturass/frontend/dist/ si mantuviste el
nombre de carpeta indicado arriba. Si cambiaste ese nombre, reemplázalo en la
dirección. Apache y MySQL deben seguir activos.
