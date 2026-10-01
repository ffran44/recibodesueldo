# Mis recibos de sueldo

App personal para la computadora para llevar el registro de tus recibos de sueldo. Subís la foto o el PDF, se lee **gratis**, la app **audita que las cuentas cierren** y te muestra cuánto vale tu sueldo contra la inflación y el dólar. También se puede instalar como app desde Chrome o Edge.

Todo queda guardado en tu computadora. No hay servidor ni cuenta.

## Cómo lee los recibos (gratis y sin exponer tus datos)

1. **Tu computadora lee la foto** con OCR local (Tesseract). Antes la agranda, la pasa a grises, le sube el contraste y la enfoca: con una foto de WhatsApp leyó bien los 20 importes de prueba. Los PDF digitales se leen directo, sin OCR.
2. **Se ocultan tus datos personales**: nombre, CUIL, CUIT, DNI y legajo. Si cargás tu nombre en Ajustes, se oculta aunque el OCR lo haya leído con errores.
3. **Ves exactamente el texto que se va a mandar** y lo podés editar.
4. **Gemini (plan gratis) solo ordena ese texto** en conceptos y totales, y usa los totales impresos para corregir errores del OCR. En el plan gratis Google puede usar lo que recibe para mejorar sus productos: por eso nunca le llega la foto ni tus datos. Si preferís, podés usar Claude, que es pago.
5. Revisás con la foto al lado, con la auditoría en vivo, y guardás.

## Qué hace

| Función | Para qué sirve |
|---|---|
| **Cargar** fotos o PDF | Arrastrás los archivos o pegás con Ctrl+V una imagen copiada de WhatsApp Web. Un recibo puede tener varias páginas. Para cargar tu historial podés subir **muchos recibos juntos** y revisarlos uno por uno. |
| **Revisión con auditoría en vivo** | Ves lo leído al lado de la foto (con zoom). Mientras corregís, la app verifica que los conceptos sumen el total impreso, así un número mal leído salta enseguida. |
| **Sello de auditoría** | Cada recibo lleva un sello: *Conforme*, *Revisar* u *Observado*. Chequea: sumas por columna; neto = remunerativo + no remunerativo − descuentos; neto en letras = neto en números; aporte jubilatorio del 11%; **pago en término** (4° día hábil, art. 128 LCT, con feriados nacionales); **aportes depositados al día** (SUSS). |
| **Comparación con el mes anterior** | Avisa si dejaste de cobrar un concepto, si apareció uno nuevo, si un descuento cambió de alícuota (ej.: la obra social pasó de 6,5% a 7%) o si cobraste menos. |
| **Análisis: Resumen** | Último neto, poder de compra, plata ganada o perdida contra la inflación, inflación desde tu último aumento, cuánto deberías cobrar hoy para igualar tu mejor mes, aguinaldo estimado y total cobrado por año. |
| **Análisis: Inflación y dólar** | Poder de compra con base 100 (contra precios, dólar oficial y blue en la misma escala), tu variación vs. la inflación de cada mes, ganancia o pérdida mensual, **aumentos detectados** con la inflación entre uno y otro, y neto en dólares. |
| **Análisis: Composición** | Remunerativo vs. no remunerativo (lo no remunerativo no suma para jubilación ni aguinaldo: la app calcula cuánto aguinaldo perdés), peso de los descuentos, a dónde va cada descuento y cuánto de lo que le costás a tu empleador te llega. |
| **Análisis: Conceptos** | Planilla de todos los conceptos mes a mes, coloreada según si subieron más o menos que la inflación, y evolución de cualquier concepto contra "si hubiera seguido a la inflación". |
| **Filtro de período** | Todo, últimos 12 o 6 meses, o un año puntual. |
| **Preguntale a tus recibos** | Preguntas en lenguaje natural: "¿cuánto aumentó mi básico este año?", "¿cuándo cobré más en dólares?". |
| **Respaldo y Excel** | Descargá un respaldo completo (con fotos) o un CSV que abre directo en Excel. |

## Por qué estas decisiones (investigación)

- **OCR local + modelo de lenguaje.** El OCR clásico transcribe el texto pero no entiende qué importe va en qué columna; un modelo de lenguaje sí ([comparativa](https://dev.to/gabrielanhaia/vision-models-for-ocr-when-they-beat-tesseract-and-when-they-dont-54a6), [benchmark 2026](https://parsli.co/blog/llm-ocr-vs-traditional-ocr)). Combinándolos, la foto no sale de tu equipo y el modelo recibe solo texto anónimo.
- **Gemini gratis, con cuidado.** El plan gratuito de la API de Gemini no pide tarjeta, pero lo enviado puede usarse para mejorar productos de Google y lo pueden revisar personas ([precios y condiciones](https://ai.google.dev/gemini-api/docs/pricing)). Por eso la app oculta los datos personales antes de enviar.
- **La auditoría es lo que agrega valor.** Desde julio de 2026, ARCA publica la liquidación en *Mi Argentina → Mi Liquidación Digital*, donde se pueden denunciar diferencias ([fuente](https://www.canal26.com/general/2026/07/07/mi-argentina-suma-una-funcion-clave-como-ver-tu-recibo-de-sueldo-desde-el-celular-paso-a-paso/)). Esta app avisa cuándo conviene ir a mirar ahí: aportes atrasados, conceptos que desaparecen, pagos fuera de término.
- **El sueldo en Argentina se mide contra la inflación y el dólar**, no en pesos nominales. Por eso usa la [API de Series de Tiempo](https://datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26) (IPC INDEC) y [ArgentinaDatos](https://api.argentinadatos.com) (dólar y feriados). Ambas son gratuitas y se pueden consultar desde el navegador.

## Cómo usarla

1. Abrí la app publicada (ver *Publicación*) o corré `npm run dev`.
2. Sacá una API key gratis de Gemini en [aistudio.google.com/apikey](https://aistudio.google.com/apikey) y pegala en **Ajustes**. Cargá también tu nombre para que se oculte siempre.
3. Opcional: en Chrome o Edge, tocá el ícono de instalar en la barra de direcciones y queda como una app más de la PC.
4. **Cargar** → arrastrá la foto → revisá el texto que se envía → **Enviar a Gemini** → revisá → **Guardar recibo**.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173/recibodesueldo/
npm test           # auditoría, ocultado de datos, indicadores, aguinaldo, montos
npm run build
```

Stack: Vite + React 19 + TypeScript, Dexie (IndexedDB), Recharts, vite-plugin-pwa, Tesseract.js (OCR local), pdf.js, `@google/genai` y `@anthropic-ai/sdk` con salida estructurada (esquema Zod compartido).

```
src/
  lib/ocr.ts        lectura local de fotos (Tesseract) y PDF (pdf.js)
  lib/ocultar.ts    oculta nombre, CUIL, CUIT, DNI y legajo antes de enviar
  lib/ia.ts         elige Gemini o Claude; esquema e instrucciones en lib/esquema.ts
  lib/audit.ts      chequeos del recibo (funciones puras, testeadas)
  lib/analysis.ts   sueldo real, dólar, aguinaldo, evolución
  lib/indicadores.ts poder de compra, brecha, aumentos, composición, planilla de conceptos
  lib/econ.ts       IPC, dólar y feriados con caché local
  lib/db.ts         base local (IndexedDB)
  pantallas/        Inicio, Cargar, Detalle, Análisis, Preguntar, Ajustes
  componentes/      Hoja de recibo, Sello, Editor, Visor, Lista de chequeos
  sw.ts             service worker (uso sin conexión)
```

## Publicación

Cada push a `main` se publica en GitHub Pages con `.github/workflows/deploy.yml`. Hay que activarlo una vez: **Settings → Pages → Source: GitHub Actions**. Queda en `https://ffran44.github.io/recibodesueldo/`.

La página es pública, pero no contiene datos: cada persona que la abre ve solo lo que guardó en su propio navegador.

## Privacidad

- La foto nunca sale de tu computadora. Al servicio elegido le llega solo el texto, con los datos personales ocultos, y lo ves antes de enviarlo.
- `.gitignore` bloquea fotos, PDFs, respaldos y CSV, así no se sube ningún recibo por error al repositorio público.
- Las API keys quedan en el `localStorage` del navegador y solo se envían al servicio correspondiente.
- "Preguntar" manda los importes y conceptos de tus recibos, pero no fotos, nombre ni CUIL.
