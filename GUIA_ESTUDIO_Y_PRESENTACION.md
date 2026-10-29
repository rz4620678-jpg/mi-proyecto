# Guía de estudio y presentación

## 1. ¿Qué resuelve el sistema?

Es una aplicación web para que KB Clean controle clientes, productos, facturas
por cobrar y los pagos que recibe. Permite consultar saldos y vencimientos,
revisar el historial de precios y generar reportes.

La aplicación guarda su información operativa en MySQL/MariaDB. Excel puede
servir como fuente de carga o para abrir archivos exportados, pero no es la base
de trabajo diaria. El sistema es de control administrativo: no emite comprobantes
electrónicos ni se conecta con SUNAT.

## 2. Cómo está construido

```text
Navegador
  └── Interfaz React + Vite (frontend/src)
        └── Solicitudes HTTP/JSON
              └── API PHP (backend/api.php)
                    └── Controladores PHP
                          └── MySQL/MariaDB por PDO
```

- **React** muestra las pantallas, formularios, filtros y tablas.
- **Vite** compila la interfaz para ejecutarla o publicarla.
- **PHP** valida las entradas, ejecuta las reglas del negocio y responde a la
  interfaz.
- **PDO** conecta PHP con MySQL/MariaDB usando consultas preparadas.
- **`facturas.php`** sirve la interfaz compilada cuando no se usa el servidor
  de desarrollo de Vite.

Las rutas de consulta y escritura están declaradas en
[`backend/api.php`](./backend/api.php). La conexión se configura en
[`backend/config/database.php`](./backend/config/database.php).

## 3. Módulos de la aplicación

### Dashboard

Presenta indicadores de ventas, pagos, saldos pendientes, facturas vencidas,
clientes y productos. Los filtros de año y mes cambian el período mostrado.
También aparecen los borradores incompletos provenientes de la importación,
separados de las facturas confirmadas.

### Facturas

Cada factura tiene una cabecera y una o varias líneas de detalle:

- La cabecera indica cliente, fecha de emisión, vencimiento, guías, orden de
  compra, retención y penalidad opcional.
- Cada línea indica producto, código de producto, cantidad, precio y descuento.
- La factura conserva el detalle y los importes cuando se anula; la anulación
  queda marcada y excluida de los cálculos normales.
- Se pueden adjuntar archivos PDF de la factura y de sus guías.

La numeración interna nueva continúa la serie `E001-`. Esto por sí solo no
significa que el sistema emita una factura electrónica autorizada.

### Detalle de facturas

Muestra las líneas de producto con su factura, cliente y fecha. Permite filtrar
por factura, cliente, SAP general del cliente, producto/código de producto,
año y mes. El código de producto se compara con el código registrado para ese
producto; no se mezcla con el SAP general del cliente.

### Registro de cobros

Un cobro se vincula a una factura e incluye fecha, monto, banco, forma de pago y
observaciones. Se puede registrar un pago parcial o total. El servidor valida
que el nuevo monto no supere el saldo disponible. La pantalla permite filtrar
los pagos registrados por año, mes y banco, y buscarlos por factura, cliente,
RUC o SAP general.

Si una factura aparece en “Facturas” pero no en “Registro de cobros”, no
necesariamente hay un error: puede que todavía no se haya registrado ningún
pago asociado. Las facturas pendientes se pueden elegir desde **Nuevo cobro**.

### Clientes y productos

La ficha de cliente contiene razón social, RUC, SAP del cliente y datos de
contacto. El catálogo contiene los productos y sus unidades. El botón **Revisar
RUC compartidos** presenta clientes que comparten RUC; es una revisión opcional
y no combina registros automáticamente. Un mismo RUC puede corresponder a
sedes diferentes.

### Historial de precios

Se selecciona un producto y se consultan sus ventas anteriores, con filtros
opcionales de cliente, año y mes. Al escribir un código SAP/interno de producto
que ya esté registrado, el sistema busca el producto y filtra su historial
automáticamente. Un resultado vacío significa que no hay ventas coincidentes
con ese producto y esos filtros.

### Reportes

Incluye resúmenes de ventas, cobranza, clientes, vencimientos, bancos,
utilidad, productos e historial de precios. Las tablas de las pantallas se
pueden exportar a CSV para abrirlas con una hoja de cálculo.

### Configuración

Permite revisar los datos de la empresa y configurar IGV, retención, días de
crédito y color principal. La opción de respaldo genera un archivo SQL. El
aviso de seguridad aparece cuando aún no se registró un respaldo o pasaron
siete días. La aplicación registra la fecha en que se generó la descarga, pero
no puede comprobar que el archivo se haya guardado en un lugar seguro. Guarda
la copia fuera del equipo o servidor donde se ejecuta la aplicación. El archivo
SQL contiene los datos de la base; los archivos PDF adjuntos se guardan aparte
y deben incluirse en una copia separada del directorio de documentos.

## 4. Dos códigos diferentes: cliente y producto

No son intercambiables:

| Dato | Qué identifica | Dónde se usa |
|---|---|---|
| SAP general del cliente | La empresa o entidad cliente | Ficha del cliente, búsqueda de facturas y cobros |
| Código SAP/interno del producto | Un producto específico | Línea de factura, detalle e historial de precios |

El Excel disponible no incluye estos códigos de producto. Por eso se ingresan
según la información que proporcione la empresa; no se deben inventar.

### Registrar el código de un producto por primera vez

1. Abrir una factura nueva o editar una existente.
2. Escribir el código en la columna **Código SAP predeterminado del producto**.
3. Si no está registrado, seleccionar manualmente el producto correcto en la
   lista de productos.
4. Pulsar **Guardar como predeterminado**. El código queda asociado a ese
   producto para las búsquedas posteriores.
5. Si se está editando una factura, guardar también la factura para conservar
   cualquier otro cambio realizado.

En adelante, escribir ese código en otra factura o en el historial permite
encontrar el producto sin volver a elegirlo. Si el mismo producto tiene
códigos distintos según el cliente, esos códigos deben asociarse al cliente
correspondiente en lugar de tratarse como un código universal.

## 5. Cómo se calculan los importes y estados

- Los precios unitarios de la interfaz se muestran con IGV. Según la
  configuración de la base histórica, PHP convierte el valor a neto al guardar
  sin reescribir los importes de las facturas anteriores.
- El subtotal suma las líneas después del descuento.
- El IGV se calcula usando la tasa configurada (18 % en la configuración
  habitual del proyecto).
- La retención, si se activa, se calcula sobre el total con IGV.
- La penalidad opcional se calcula sobre el total y se descuenta del monto neto
  por cobrar.
- Los cobros se suman por factura. El saldo es el neto por cobrar menos los
  pagos, con mínimo cero; si los pagos superan el neto, la diferencia se
  presenta como excedente.
- El estado de la factura se deriva de la anulación, pagos y vencimiento:
  anulada, cobrada, parcial, vencida o pendiente.

La vista SQL `v_facturas_completo` concentra cálculos de saldo, excedente, días
y estado para reutilizarlos en las pantallas y reportes.

## 6. Modelo de datos en palabras simples

- **`clientes`**: ficha del cliente, RUC y SAP general.
- **`productos`**: catálogo de productos.
- **`producto_codigos`**: códigos SAP/internos asociados a productos, de forma
  global o para un cliente concreto.
- **`facturas`**: cabecera, fechas, cliente e importes.
- **`factura_detalle`**: productos, cantidades, precios y descuentos de cada
  factura.
- **`cobros`**: pagos asociados a una factura.
- **`factura_guias`** y **`factura_documentos`**: guías y referencias a los PDF.
- **`listas`**: bancos, formas de pago y motivos de anulación.
- **`configuracion`**: datos de empresa y parámetros; también registra la fecha
  de la última descarga de respaldo.
- **`pendientes_importacion`**: importes incompletos que necesitan confirmación
  antes de convertirse en factura.
- **`usuarios`**: existe en el esquema, pero actualmente no se utiliza para
  iniciar sesión.

Las relaciones principales son: cliente → facturas; factura → líneas de
detalle; producto → líneas de detalle; factura → cobros. El borrado de clientes
con facturas está bloqueado para preservar el historial.

## 7. Guion corto para presentar al cliente

> “Este sistema centraliza el seguimiento de clientes, productos, facturas y
> pagos. Desde el panel vemos ventas, saldos y vencimientos por período.
> Registramos cada factura con su detalle y cada pago queda asociado a la
> factura correspondiente, lo que permite consultar cuánto falta cobrar. Los
> códigos SAP del cliente y del producto se manejan por separado: uno encuentra
> la entidad y el otro el artículo. También se puede revisar el historial de
> precios y exportar reportes. El sistema incluye descarga de respaldos; antes
> de usarlo con datos reales en un servidor público hay que configurar acceso
> seguro, HTTPS y una política de copias y restauración.”

No se debe afirmar que el sistema factura electrónicamente, se conecta con
SUNAT, tiene inicio de sesión o realiza respaldos automáticos: esas funciones
no están implementadas en el alcance revisado.

## 8. Preparación y límites antes de producción

El proyecto está preparado para desarrollo local con XAMPP, Apache,
MySQL/MariaDB, PHP y Node.js. Para compilar la interfaz:

```powershell
cd frontend
npm install
npm run build
```

`backend/database.sql` crea una base nueva y elimina las tablas existentes; no
se debe ejecutar sobre datos que se quieran conservar. Para una base existente,
se deben revisar y aplicar las migraciones específicas después de generar un
respaldo.

Antes de alojar información real de clientes, hay que implementar
autenticación/autorización, configurar HTTPS y credenciales MySQL seguras,
proteger los archivos PDF y probar una restauración de respaldo. El aviso
semanal es un recordatorio dentro de la aplicación, no una copia automática ni
una garantía de recuperación. Como el sistema no tiene inicio de sesión, no se
debe publicar con información real hasta implementar control de acceso.

## 9. Archivos útiles para estudiar el código

- [`frontend/src/App.jsx`](./frontend/src/App.jsx): arranque, navegación y
  datos compartidos por las pantallas.
- [`frontend/src/api.js`](./frontend/src/api.js): comunicación con PHP y hook
  para cargar datos.
- [`frontend/src/views/Dashboard.jsx`](./frontend/src/views/Dashboard.jsx):
  indicadores y gráficos.
- [`frontend/src/views/Facturas.jsx`](./frontend/src/views/Facturas.jsx) y
  [`frontend/src/components/FacturaForm.jsx`](./frontend/src/components/FacturaForm.jsx):
  listado y formulario de facturas.
- [`frontend/src/views/Cobros.jsx`](./frontend/src/views/Cobros.jsx):
  registro y consulta de pagos.
- [`frontend/src/views/Precios.jsx`](./frontend/src/views/Precios.jsx):
  buscador e historial de precios.
- [`backend/api.php`](./backend/api.php): mapa de rutas.
- [`backend/controllers/FacturaController.php`](./backend/controllers/FacturaController.php):
  validación y guardado de facturas y líneas.
- [`backend/controllers/CobroController.php`](./backend/controllers/CobroController.php):
  registro y filtros de cobros.
- [`backend/controllers/CatalogoController.php`](./backend/controllers/CatalogoController.php):
  productos, códigos y precios históricos.
- [`backend/controllers/DashboardController.php`](./backend/controllers/DashboardController.php):
  indicadores del panel.
- [`backend/controllers/ConfigController.php`](./backend/controllers/ConfigController.php):
  parámetros y descarga de respaldo.
- [`backend/database.sql`](./backend/database.sql) y
  [`backend/migracion_v2.sql`](./backend/migracion_v2.sql): estructura y
  evolución de la base de datos.
