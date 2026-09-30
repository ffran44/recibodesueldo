# Mis recibos de sueldo

PWA personal para registrar y auditar recibos de sueldo argentinos. Ver README.md.

## Reglas

- **Privacidad**: el repo es público. Nunca commitear fotos, PDFs, respaldos ni montos/CUIL reales. Los fixtures de test (`src/lib/fixtures.ts`) usan montos inventados.
- Código, nombres y UI en español rioplatense (vos). Montos en formato es-AR.
- La lógica de negocio va en `src/lib/` como funciones puras con tests (`*.test.ts`, Vitest). Las pantallas solo componen.
- Colores solo desde los tokens de `src/index.css` (modo claro y oscuro). En Recharts usar `useTokens()` porque los atributos SVG no aceptan `var()`.
- Llamadas a Claude solo en `src/lib/claude.ts` con `@anthropic-ai/sdk`.

## Comandos

- `npm run dev`: http://localhost:5173/recibodesueldo/ (en dev, `window.__db` y `window.__fixtures` para cargar datos de prueba)
- `npm test`, `npm run build` (incluye `tsc -b`)

## Skills del proyecto (`.claude/skills/`)

test-driven-development, systematic-debugging, verification-before-completion, writing-plans (obra/superpowers) y webapp-testing (anthropics/skills).
