# Mis recibos de sueldo

PWA personal, pensada para PC, para registrar y auditar recibos de sueldo argentinos. Ver README.md.

Flujo de lectura: OCR local (`lib/ocr.ts`) → `ocultarDatosPersonales` (`lib/ocultar.ts`) → la persona revisa el texto → Gemini gratis o Claude (`lib/ia.ts`) → editor con auditoría en vivo.

## Reglas

- **Privacidad**: el repo es público. Nunca commitear fotos, PDFs, respaldos ni montos/CUIL reales. Los fixtures de test (`src/lib/fixtures.ts`) usan montos inventados.
- Código, nombres y UI en español rioplatense (vos). Montos en formato es-AR.
- La lógica de negocio va en `src/lib/` como funciones puras con tests (`*.test.ts`, Vitest). Las pantallas solo componen.
- Estilo: colorido y alegre, siempre oscuro, violeta como color principal y un color por sección (`data-seccion` en `<main>`). Colores solo desde los tokens de `src/index.css`. En Recharts usar `useTokens()` porque los atributos SVG no aceptan `var()`; los colores de gráficos se validan para daltonismo sobre `--hoja`.
- Nunca mandar la foto ni datos personales a servicios externos: solo el texto ya pasado por `ocultarDatosPersonales`. Cualquier cambio ahí va con test.
- Llamadas a modelos solo en `src/lib/gemini.ts` / `src/lib/claude.ts`, con el esquema de `src/lib/esquema.ts`.

## Comandos

- `npm run dev`: http://localhost:5173/recibodesueldo/ (en dev, `window.__db` y `window.__fixtures` para cargar datos de prueba)
- `npm test`, `npm run build` (incluye `tsc -b`)

## Skills del proyecto (`.claude/skills/`)

test-driven-development, systematic-debugging, verification-before-completion, writing-plans (obra/superpowers) y webapp-testing (anthropics/skills).
