# Reglas y fuentes oficiales

Este documento explica cada regla que aplica `facturas-cfdi`, con su fuente oficial, la cita textual
relevante y la fecha de consulta. El código que las aplica está en
[`src/lib/rules.ts`](../src/lib/rules.ts), [`src/lib/classifier.ts`](../src/lib/classifier.ts) y
[`src/lib/caps.ts`](../src/lib/caps.ts).

> **Advertencia.** Este documento y la aplicación no constituyen opinión legal ni asesoría fiscal.
> La app organiza tus facturas y señala lo que *podría* ser deducible con lo que se puede revisar sin
> conexión. Lo que aquí se dice debe validarse con el SAT o con tu contador.

**Fecha de consulta de todas las fuentes:** 17 de noviembre de 2026.

Semáforo de verificación: **VERDE** verificado contra la fuente oficial; **AMARILLO** inferencia
nuestra o criterio informativo del SAT (no ley); **ROJO** no verificado.

## Tabla de contenido

| # | Sección | Semáforo |
|---|---|---|
| 1 | [Método y alcance](#1-método-y-alcance) | VERDE |
| 2 | [Estructura del CFDI que se lee](#2-estructura-del-cfdi-que-se-lee) | VERDE |
| 3 | [Catálogos del SAT](#3-catálogos-del-sat) | VERDE |
| 4 | [Requisitos generales que se revisan](#4-requisitos-generales-que-se-revisan) | VERDE / AMARILLO |
| 5 | [Medio de pago](#5-medio-de-pago) | VERDE |
| 6 | [Reglas por clave D01 a D10](#6-reglas-por-clave-d01-a-d10) | VERDE / AMARILLO |
| 7 | [Topes](#7-topes) | VERDE |
| 8 | [Valor de la UMA](#8-valor-de-la-uma) | VERDE / AMARILLO |
| 9 | [UsoCFDI incorrecto](#9-usocfdi-incorrecto) | VERDE / AMARILLO |
| 10 | [Lo que no se puede verificar sin conexión](#10-lo-que-no-se-puede-verificar-sin-conexión) | VERDE |
| 11 | [Categorías de gasto](#11-categorías-de-gasto) | AMARILLO |
| 12 | [Pendientes no verificados](#12-pendientes-no-verificados) | ROJO |
| 13 | [Fuentes](#13-fuentes) | VERDE |

## 1. Método y alcance

- Cada factura recibe uno de cuatro estatus: **posiblemente deducible**, **requiere revisión (razón)**,
  **no deducible (razón)** o **no aplica** (pagos, nómina, traslados, facturas que emitiste). La app
  nunca afirma que una factura *es* deducible.
- Sólo se revisa lo que está en el XML. Todo lo que exige consultar al SAT o documentos externos se
  señala como pendiente (sección 10).
- Texto vigente de la LISR: el PDF consolidado de la Cámara de Diputados indica "Última Reforma DOF
  01-04-2024". La Cámara registra además una reforma publicada en el DOF el 13-11-2026 que entra en
  vigor el 1-1-2027 y **no modifica** los arts. 151, 152 ni 185
  ([reforma](https://www.diputados.gob.mx/LeyesBiblio/ref/lisr/LISR_ref09_13nov26.pdf)).
- Las referencias de la ley al "salario mínimo general ... elevado al año" se leen como UMA anual por
  el Transitorio Tercero del decreto de desindexación (DOF 27-01-2016): "todas las menciones al
  salario mínimo como unidad de cuenta, índice, base, medida o referencia ... se entenderán referidas
  a la Unidad de Medida y Actualización"
  ([DOF](https://dof.gob.mx/nota_detalle.php?codigo=5423663&fecha=27/01/2016)). El SAT lo confirma en
  sus preguntas frecuentes de la Declaración Anual 2025, sección C.1, pregunta 11.

## 2. Estructura del CFDI que se lee

Fuente: [Anexo 20, SAT](http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20.htm) y los XSD
publicados. VERDE.

| Esquema | Namespace |
|---|---|
| CFDI 4.0 | `http://www.sat.gob.mx/cfd/4` |
| CFDI 3.3 | `http://www.sat.gob.mx/cfd/3` |
| Timbre Fiscal Digital 1.1 | `http://www.sat.gob.mx/TimbreFiscalDigital` |
| Pagos 2.0 | `http://www.sat.gob.mx/Pagos20` |
| Pagos 1.0 | `http://www.sat.gob.mx/Pagos` |
| Nómina 1.2 | `http://www.sat.gob.mx/nomina12` |
| Impuestos locales | `http://www.sat.gob.mx/implocal` |
| Leyendas fiscales | `http://www.sat.gob.mx/leyendasFiscales` |
| Instituciones educativas privadas (iedu) | `http://www.sat.gob.mx/iedu` |
| Donatarias | `http://www.sat.gob.mx/donat` |

- El SAT indica: "A partir del 1 de enero de 2022, se actualizó la versión del CFDI pasando a la
  versión 4.0 y desde el 1 de abril de 2023 es la única válida." La app lee 4.0 y 3.3 (facturas de
  años anteriores) y rechaza 3.2 con un mensaje claro.
- El parser busca los nodos por nombre local, no por prefijo, para tolerar prefijos distintos o un
  namespace por omisión. Los CFDI de retenciones se reconocen y se omiten.
- Tipos de comprobante: I (ingreso), E (egreso o nota de crédito), P (pago), N (nómina), T (traslado).
  El gasto suma los tipo I recibidos y resta los tipo E recibidos; la nómina se muestra aparte como
  ingreso; los pagos no se suman como gasto (comprueban pagos de facturas PPD); los traslados sólo se
  cuentan.
- Complemento iedu: atributos `nombreAlumno`, `CURP`, `nivelEducativo` (Preescolar, Primaria,
  Secundaria, Profesional técnico, Bachillerato o su equivalente), `autRVOE` y `rfcPago`
  ("RFC de quien realiza el pago cuando sea diferente a quien recibe el servicio").
- Duplicados: dos archivos con el mismo UUID del timbre cuentan una sola vez.

## 3. Catálogos del SAT

Fuente: catálogo `catCFDI_V_4_20261106.xls` (hoja c_UsoCFDI con fecha 22/04/2023) enlazado desde el
[Anexo 20](http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20.htm); para 3.3,
`catCFDI_V_33_31032023.xls`. VERDE. Los extractos están en
[`src/lib/catalogs.ts`](../src/lib/catalogs.ts).

- **c_UsoCFDI**, claves de deducción personal: D01 Honorarios médicos, dentales y gastos
  hospitalarios; D02 Gastos médicos por incapacidad o discapacidad; D03 Gastos funerales; D04
  Donativos; D05 Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación);
  D06 Aportaciones voluntarias al SAR; D07 Primas por seguros de gastos médicos; D08 Gastos de
  transportación escolar obligatoria; D09 Depósitos en cuentas para el ahorro, primas que tengan como
  base planes de pensiones; D10 Pagos por servicios educativos (colegiaturas).
- Columna "Régimen Fiscal Receptor" para D01 a D10: 605, 606, 608, 611, 612, 614, 607, 615 y 625. Si
  un CFDI 4.0 trae otro régimen del receptor (por ejemplo 626 RESICO), la app pide revisión.
- CFDI 3.3 tenía además P01 "Por definir" (vigencia 31/03/2017 a 30/06/2023); la app la marca para
  revisión.
- **c_FormaPago**: 01 Efectivo, 02 Cheque nominativo, 03 Transferencia electrónica de fondos, 04
  Tarjeta de crédito, 05 Monedero electrónico, 06 Dinero electrónico, 08 Vales de despensa, 12 a 27
  (formas de extinción de obligaciones), 28 Tarjeta de débito, 29 Tarjeta de servicios, 30 Aplicación
  de anticipos, 31 Intermediario pagos, 99 Por definir.
- **c_MetodoPago**: PUE "Pago en una sola exhibición"; PPD "Pago en parcialidades o diferido". La Guía
  de llenado 4.0 indica que con PPD la forma de pago debe ser "99" (Por definir).
- **RFC genéricos** (Anexo 20): XAXX010101000 para "PUBLICO EN GENERAL" y XEXX010101000 para
  residentes en el extranjero.

## 4. Requisitos generales que se revisan

| Requisito | Qué hace la app | Fuente | Semáforo |
|---|---|---|---|
| La factura está a tu nombre | Si el RFC receptor no es el tuyo: **no deducible**. Si es XAXX010101000 o XEXX010101000: **no deducible**. | LISR art. 151 (la deducción es de quien paga); Anexo 20 (RFC genéricos) | VERDE / AMARILLO (la lectura "a tu nombre" es nuestra) |
| Pagada en el ejercicio | PUE: se toma la fecha de emisión. Si es de otro año: **no deducible** en el año elegido. | LISR art. 151, párrafo posterior a la fr. VIII: "efectivamente pagadas en el año de calendario de que se trate a instituciones o personas residentes en el país" | VERDE (el texto aplica literalmente a fr. I y II) |
| Pago diferido (PPD) | Se busca el complemento de pago con ese UUID. Sin complemento: **requiere revisión**. Con pagos: se toma el monto y la forma de pago de los pagos cuyo `FechaPago` cae en el ejercicio; si se pagó en otro año: **no deducible** en el año elegido. | Guía de llenado del complemento de pagos: `FechaPago` es "la fecha y hora en la que el beneficiario recibe el pago" | AMARILLO: usar FechaPago para el año de la deducción es inferencia nuestra |
| Notas de crédito | Un CFDI tipo E relacionado (TipoRelacion 01 o 03) reduce el monto de la factura original. | Anexo 20, c_TipoRelacion | VERDE |
| Moneda extranjera | Se convierte con el `TipoCambio` del propio CFDI. | Anexo 20 | VERDE |

## 5. Medio de pago

La LISR **no** tiene una regla general de "no efectivo" para todas las deducciones personales. El
art. 151 dice expresamente: "Los requisitos de las deducciones establecidas en el Capítulo X de este
Título no son aplicables a las deducciones personales a que se refiere este artículo." (el Capítulo X
contiene el art. 147 fr. IV, que exige medios bancarizados para pagos mayores a $2,000). VERDE.

El medio bancarizado sólo se exige en:

| Clave | Fuente | Cita |
|---|---|---|
| D01 | LISR art. 151, fr. I, primer párrafo | "y se efectúen mediante cheque nominativo del contribuyente, transferencias electrónicas de fondos, desde cuentas abiertas a nombre del contribuyente ... o mediante tarjeta de crédito, de débito, o de servicios." |
| D08 | LISR art. 151, fr. VII | "se deberá separar en el comprobante el monto que corresponda por concepto de transportación escolar y se efectúen mediante cheque nominativo ..." |
| D10 | Decreto DOF 26-12-2013, art. 1.9 | "deberán realizarse mediante cheque nominativo del contribuyente, transferencias electrónicas de fondos desde cuentas abiertas a nombre del contribuyente ... o mediante tarjeta de crédito, de débito o de servicios." |

Lo que hace la app:

- D01, D08 o D10 con FormaPago 01 (efectivo): **no deducible**.
- D01, D08 o D10 con 05, 06, 08, 12 a 31: **requiere revisión** (no son los medios que enumera la ley).
- D02 en efectivo: **requiere revisión** (el requisito está en el primer párrafo de la fr. I; la fr. I
  párrafos tercero a quinto regula la incapacidad; la aplicación del requisito a D02 es dudosa).
- D03, D04, D05, D06, D07 o D09 en efectivo: **requiere revisión**. La ley no lo exige para esas
  fracciones, pero el minisitio de Deducciones personales del SAT pide pagos bancarizados en todas
  las categorías. Eso es criterio informativo del SAT, no ley. AMARILLO.
- PUE con FormaPago 99: **requiere revisión** (combinación que la Guía de llenado reserva a PPD).
- Las autoridades pueden liberar de la obligación de pago bancarizado "cuando las mismas se efectúen
  en poblaciones o en zonas rurales sin servicios financieros" (LISR art. 151, fr. I). La app no puede
  saberlo; por eso el efectivo en D01 se explica en la razón.

## 6. Reglas por clave D01 a D10

| Clave | Fundamento | Qué revisa la app | Estatus típico |
|---|---|---|---|
| D01 | LISR art. 151 fr. I; RLISR art. 264 | Medio de pago; medicinas (ClaveProdServ 51) sin servicios médicos u hospitalarios en la misma factura: **revisión** ("medicinas que se incluyan en los documentos que expidan las instituciones hospitalarias", RLISR 264); lentes: **revisión** por el tope de $2,500 por persona ("hasta por un monto de $2,500.00, en el ejercicio, por cada una de las personas", RLISR 264); recordatorio de beneficiarios y su límite de ingresos de 1 UMA anual. | Posible |
| D02 | LISR art. 151 fr. I, párrafos 3 a 5 | Si ni conceptos ni leyendas mencionan incapacidad o discapacidad: **revisión** ("el comprobante fiscal digital correspondiente deberá contener la especificación de que los gastos amparados con el mismo están relacionados directamente con la atención de la incapacidad o discapacidad"). Recordatorio: "sólo será procedente cuando dicha incapacidad o discapacidad, sea igual o mayor a un 50%". Fuera del tope global: "Lo dispuesto en este párrafo no estará sujeto al límite establecido en el último párrafo de este artículo." | Posible o revisión |
| D03 | LISR art. 151 fr. II; RLISR art. 266 | Tope propio de 1 UMA anual ("en la parte en que no excedan del salario mínimo general ... elevado al año"). | Posible |
| D04 | LISR art. 151 fr. III | Con complemento de donatarias: posible; sin él: **revisión** (verifica el directorio de donatarias autorizadas). Tope propio de 7% de los ingresos acumulables del año anterior ("hasta por una cantidad que no exceda del 7% ... en el ejercicio inmediato anterior"); 4% si el donativo es a la Federación, entidades o municipios (no distinguible en el XML). Sujeto al tope global desde 2022. | Posible o revisión |
| D05 | LISR art. 151 fr. IV; RLISR arts. 250 a 257 | Siempre **revisión**: sólo se deducen intereses *reales* y el monto se toma de la constancia anual; además, el crédito no debe exceder 750,000 UDIS. | Revisión |
| D06 | LISR art. 151 fr. V | Tope propio: "hasta el 10% de los ingresos acumulables del contribuyente en el ejercicio, sin que dichas aportaciones excedan del equivalente a cinco salarios mínimos ... elevados al año". Fuera del tope global: "Lo dispuesto en este párrafo no será aplicable tratándose de la fracción V de este artículo." | Posible |
| D07 | LISR art. 151 fr. VI; RLISR art. 268 | Recordatorio de beneficiarios. La ley no pone condición de ingresos al beneficiario ni medio de pago en esta fracción (el minisitio del SAT sí menciona una). | Posible |
| D08 | LISR art. 151 fr. VII; RLISR art. 269 | Siempre **revisión**: sólo procede "cuando ésta sea obligatoria en los términos de las disposiciones jurídicas del área donde la escuela se encuentre ubicada o cuando para todos los alumnos se incluya dicho gasto en la colegiatura", con monto separado. | Revisión |
| D09 | LISR art. 185 fr. I | Tope "del equivalente a $152,000.00, considerando todos los conceptos". Fuera del tope global (estímulo del Título VII, fuera del art. 151; el SAT lo confirma en la FAQ Anual 2025). | Posible |
| D10 | Decreto DOF 26-12-2013, arts. 1.8 a 1.10; minisitio SAT colegiaturas | Sin complemento iedu: **revisión** (el SAT pide que "el complemento de datos contenga el nombre y la CURP de la persona que estudia, su nivel escolar y clave de Reconocimiento de validez oficial (RVOE)"). Excluye conceptos de inscripción o reinscripción ("Correspondientes a cuotas de inscripción o reinscripción"). Nivel fuera de preescolar a bachillerato: **revisión**. `rfcPago` distinto de tu RFC: **revisión**. Tope por alumno (CURP) y nivel; si en el año hay dos niveles aplica el mayor. Fuera del tope global: "La limitante establecida en el último párrafo del artículo 151 ... no le será aplicable". | Posible o revisión |

Topes de colegiaturas por alumno (Decreto art. 1.10). VERDE.

| Nivel | Tope anual |
|---|---|
| Preescolar | $14,200.00 |
| Primaria | $12,900.00 |
| Secundaria | $19,900.00 |
| Profesional técnico | $17,100.00 |
| Bachillerato o su equivalente | $24,500.00 |

La LISR art. 151 fr. VIII (impuesto local sobre salarios) no tiene clave de UsoCFDI y no se analiza.

## 7. Topes

**Tope global** (LISR art. 151, último párrafo, reformado DOF 18-11-2015 y 12-11-2021). VERDE:

> "no podrá exceder de la cantidad que resulte menor entre cinco veces el valor anual de la Unidad
> de Medida y Actualización, o del 15% del total de los ingresos del contribuyente, incluyendo
> aquéllos por los que no se pague el impuesto."

- Sujetas al tope en la app: D01, D03, D04, D05, D07 y D08.
- Fuera del tope: D02 (por su propio párrafo), D06 (excepción expresa de la fr. V), D09 (art. 185) y
  D10 (Decreto art. 1.10). La FAQ Anual 2025 del SAT lo resume así: "Esta limitante no aplica para
  gastos médicos por incapacidad y discapacidad, aportaciones voluntarias y aportaciones
  complementarias de retiro, depósitos en cuentas especiales para el ahorro y colegiaturas." y
  "desde el ejercicio 2022, dicha limitante le resulta aplicable a los donativos."
- Inconsistencia detectada: la página de gastos funerarios del minisitio del SAT todavía menciona los
  donativos entre las excepciones. La app sigue la ley y la FAQ 2025.
- El 15% requiere tus ingresos totales del año (opcional). Sin ese dato la app aplica sólo 5 UMA y lo
  dice. Puedes usar las percepciones de nómina como estimado con un botón.
- Las deducciones personales se restan de la base del impuesto anual (LISR art. 152: "al resultado
  obtenido se le disminuirá, en su caso, las deducciones a que se refiere el artículo 151 de esta Ley").
  La app no calcula el impuesto.

## 8. Valor de la UMA

Publicados por el INEGI en el DOF; vigentes "a partir del 1º de febrero" de cada año. VERDE.

| Año | Diario | Mensual | Anual | 5 UMA anuales | DOF |
|---|---|---|---|---|---|
| 2023 | $103.74 | $3,153.70 | $37,844.40 | $189,222.00 | [10-01-2023](https://dof.gob.mx/nota_detalle.php?codigo=5676670&fecha=10/01/2023) |
| 2024 | $108.57 | $3,300.53 | $39,606.36 | $198,031.80 | [10-01-2024](https://dof.gob.mx/nota_detalle.php?codigo=5714085&fecha=10/01/2024) |
| 2025 | $113.14 | $3,439.46 | $41,273.52 | $206,367.60 | [10-01-2025](https://dof.gob.mx/nota_detalle.php?codigo=5746930&fecha=10/01/2025) |
| 2026 | $117.31 | $3,566.22 | $42,794.64 | $213,973.20 | [09-01-2026](https://dof.gob.mx/nota_detalle.php?codigo=5778072&fecha=09/01/2026) |

- **Qué UMA usa la app para un ejercicio:** la del mismo año (para el ejercicio 2025, la UMA 2025).
  Coincide con la FAQ Anual 2025 del SAT, sección D, pregunta 3: "la cantidad que resulte menor entre
  el valor de cinco unidades de medida y actualización (UMAS) en su valor anual ($206,367.36), o de 15%
  del total de tus ingresos". El SAT no enuncia la regla en palabras; es inferencia nuestra. AMARILLO.
- [ESTIMADO] La cifra del SAT ($206,367.36) es 5 × 113.14 × 30.4 × 12 sin redondear; con el valor
  anual publicado se obtiene $206,367.60. La diferencia es de 24 centavos. La app usa el valor anual
  publicado.
- Puedes cambiar el valor en la app. Para años sin valor oficial en la tabla, la app te pide
  capturarlo.
- La página del INEGI (https://www.inegi.org.mx/temas/uma/) no se pudo leer (se genera con
  JavaScript); los valores se verificaron directamente en el DOF.

## 9. UsoCFDI incorrecto

- **CFDI 4.0**: la Guía de llenado (Apéndice 7, pregunta 1) y las
  [Preguntas frecuentes CFDI 4.0](http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/PregFrecCFDIVer4_0.pdf)
  responden que, si el uso es incorrecto, "Sí, se debe cancelar y sustituir por el CFDI que contenga
  la clave del UsoCFDI correcta." (con base en CFF art. 29-A fr. IV y la regla 2.7.1.29 de la RMF). VERDE.
- **CFDI 3.3** (histórico): "no será motivo de cancelación o sustitución, y no afectará para su
  deducción o acreditamiento de impuestos"
  ([FAQ 3.3](http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/pregfreccfdiver3_3_07092017.pdf)). VERDE.
- No encontramos una declaración oficial de que un uso equivocado, por sí solo, anule la deducción en
  4.0. AMARILLO.
- Lo que hace la app: si el uso no es D01 a D10 pero los conceptos parecen de salud (segmento 85) o
  educación (segmento 86 o complemento iedu), **requiere revisión** con la cita correspondiente a la
  versión; si no, **no deducible como deducción personal**.

## 10. Lo que no se puede verificar sin conexión

La app lo dice en pantalla y no intenta consultarlo:

- **Si la factura fue cancelada.** Sólo el SAT lo sabe. Verifícalo en el
  [servicio de verificación de CFDI](https://verificacfdi.facturaelectronica.sat.gob.mx/) (descrito
  en [esta página del SAT](https://wwwmat.sat.gob.mx/aplicacion/80523/verifica-tus-facturas-electronicas)).
  La app sólo muestra el enlace y un botón para copiar el UUID; nunca llama al SAT desde el navegador.
- Que el beneficiario sea cónyuge, concubino, ascendiente o descendiente, y sus ingresos.
- Título profesional del prestador, certificado de incapacidad, RVOE vigente, becas.
- Que el emisor de un donativo esté en el
  [directorio de donatarias autorizadas](https://www.sat.gob.mx/minisitio/DonatariasAutorizadas/padron_directorio.html).
- Que el transporte escolar sea obligatorio; el monto de intereses reales.

## 11. Categorías de gasto

Las categorías (salud, educación, súper, restaurantes y viajes, etc.) son una agrupación propia y
heurística, no una clasificación del SAT. Se basan en el segmento (dos primeros dígitos) de la
ClaveProdServ del concepto de mayor importe; el catálogo c_ClaveProdServ sigue la estructura de
segmentos de UNSPSC. Si el UsoCFDI es de deducción personal, manda el uso. Las notas de crédito
heredan la categoría de la factura que corrigen. AMARILLO.

## 12. Pendientes no verificados

- ROJO: texto de la regla 2.7.1.29 de la RMF (citada por el SAT para el UsoCFDI) y de la regla
  2.7.1.24 (público en general).
- ROJO: una regla de la RMF que haga obligatorio el complemento iedu; la exigencia se tomó del
  minisitio del SAT.
- ROJO: búsqueda exhaustiva de reformas posteriores a 2015 de los arts. 1.8 a 1.10 del Decreto de
  26-12-2013 (la única encontrada es la del DOF 30-12-2015, que reforma sólo el Transitorio Tercero
  fr. VI; el SAT sigue aplicando los mismos topes).
- ROJO: valores de UMA anteriores a 2023 (la app no los trae; se capturan a mano).

## 13. Fuentes

| Fuente | URL |
|---|---|
| LISR (texto consolidado) | https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf |
| Reformas a la LISR | https://www.diputados.gob.mx/LeyesBiblio/ref/lisr.htm |
| Reglamento de la LISR | https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LISR_060516.pdf |
| Decreto que compila diversos beneficios fiscales (DOF 26-12-2013) | https://dof.gob.mx/nota_detalle.php?codigo=5328028&fecha=26/12/2013 |
| Reforma al Decreto (DOF 30-12-2015) | https://dof.gob.mx/nota_detalle.php?codigo=5421729&fecha=30/12/2015 |
| Desindexación del salario mínimo (DOF 27-01-2016) | https://dof.gob.mx/nota_detalle.php?codigo=5423663&fecha=27/01/2016 |
| CFF (art. 29-A) | https://www.diputados.gob.mx/LeyesBiblio/pdf/CFF.pdf |
| Anexo 20 y catálogos | http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20.htm |
| Anexo 20 (DOF 13-01-2022) | http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/Anexo20_2022.pdf |
| Guía de llenado CFDI 4.0 | http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/Anexo_20_Guia_de_llenado_CFDI.pdf |
| Preguntas frecuentes CFDI 4.0 | http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/PregFrecCFDIVer4_0.pdf |
| Preguntas frecuentes CFDI 3.3 | http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/pregfreccfdiver3_3_07092017.pdf |
| Complemento de pagos | http://omawww.sat.gob.mx/tramitesyservicios/Paginas/recepcion_de_pagos.htm |
| Guía de llenado de pagos | http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/Guia_llenado_pagos.pdf |
| FAQ Declaración Anual PF 2025 | https://www.sat.gob.mx/minisitio/DeclaracionAnual/Personas/documentos/PreguntasFrecuentes_AnualPF2025.pdf |
| Minisitio Deducciones personales: colegiaturas | https://www.sat.gob.mx/minisitio/DeduccionesPersonales/colegiaturas.html |
| Minisitio Deducciones personales: gastos médicos | https://www.sat.gob.mx/minisitio/DeduccionesPersonales/gastos_medicos.html |
| Minisitio Deducciones personales: gastos funerarios | https://www.sat.gob.mx/minisitio/DeduccionesPersonales/gastos_funerarios.html |
| Verificación de CFDI | https://verificacfdi.facturaelectronica.sat.gob.mx/ |
| Directorio de donatarias autorizadas | https://www.sat.gob.mx/minisitio/DonatariasAutorizadas/padron_directorio.html |
| Certificados de sello digital de prueba (RFC de prueba) | http://omawww.sat.gob.mx/tramitesyservicios/Paginas/certificado_sello_digital.htm |
| UMA 2023 a 2026 (DOF) | ver tabla de la sección 8 |

Los datos de ejemplo y de prueba usan únicamente RFC de prueba publicados por el SAT junto con sus
certificados de sello digital de prueba (por ejemplo EKU9003173C9, CACX7605101P8), los RFC genéricos
XAXX010101000 y XEXX010101000, y nombres inventados. No representan a personas ni empresas reales.
