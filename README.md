# PromptForge

Dashboard de una pantalla que reescribe prompts a la medida del modelo destino (Claude, GPT, Gemini o cualquier modelo que escribas) y de su nivel de esfuerzo. Usa Claude Haiku 5.5 con búsqueda web en vivo para leer la guía oficial vigente del modelo y datos actuales del tema del pedido.

Demo: https://promptforge-omega-flame.vercel.app

## Qué hace

- Elige proveedor, modelo y esfuerzo (`output_config.effort`, `reasoning.effort`, `thinking_level`), o escribe otro modelo (DeepSeek, Qwen…) y se investiga por su nombre.
- Interfaz estilo Claude Code (bloque `@notra/claude-code`) con Clawd animado, búho y café.
- Sube PDF, Excel, Word, PowerPoint, CSV, código o imágenes: el texto se extrae en el navegador y Haiku analiza todo el contenido.
- Devuelve puntaje antes/después, prompt final, diagnóstico, cambios, configuración de API recomendada y fuentes consultadas.

## Desarrollo

```bash
npm install
echo "ANTHROPIC_API_KEY=tu-key" > .env.local
npm run dev
```

La key solo se usa en el servidor (`src/app/api/forge/route.ts`). En Vercel va como variable de entorno `ANTHROPIC_API_KEY`.

## Créditos

- Sprite de Clawd adaptado de [clawd-md](https://github.com/jaameypr/clawd-md) (MIT, Jamey Prüfert).
- Shine Border (magicui) y diseño de Halo Dropzone (cult-ui) vía 21st.dev.
- Logos de marca desde svgl.app.
