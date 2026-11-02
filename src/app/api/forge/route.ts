import Anthropic from "@anthropic-ai/sdk";

import {
  ATTACHMENT_LIMITS,
  CUSTOM_EFFORTS,
  effortsFor,
  findProvider,
  IMAGE_TYPES,
  TASK_TYPES,
  type Attachment,
} from "@/lib/catalog";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "claude-haiku-5-5";
const MAX_PROMPT_CHARS = 8000;
const MAX_CONTINUATIONS = 3;
const RATE_LIMIT = { windowMs: 10 * 60 * 1000, max: 15 };

const client = new Anthropic();

// Best-effort per-instance limiter so a public URL can't drain the key in seconds.
const hits = new Map<string, number[]>();
const rateLimited = (ip: string) => {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT.windowMs
  );
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT.max;
};

interface ForgeRequest {
  prompt: string;
  provider: string;
  model: string;
  customModel?: string;
  effort: string;
  task: string;
  previous?: string;
  attachments: Attachment[];
}

export type ForgeEvent =
  | { type: "thinking"; delta: string }
  | { type: "tool"; id: string; kind: "search" | "fetch"; arg: string }
  | {
      type: "results";
      id: string;
      items: { title: string; url: string; age: string | null }[];
      error?: string;
    }
  | { type: "text"; delta: string }
  | { type: "done"; inputTokens: number; outputTokens: number; searches: number }
  | { type: "error"; message: string };

const buildSystem = (body: ForgeRequest) => {
  const custom = body.customModel?.trim().slice(0, 80);
  const provider = findProvider(body.provider)!;
  const model = custom ? undefined : provider.models.find((m) => m.id === body.model);
  const allowed = custom ? CUSTOM_EFFORTS : effortsFor(provider, model);
  const effort =
    allowed.find((e) => e.id === body.effort) ??
    allowed.find((e) => e.id === model?.defaultEffort) ??
    allowed[0];
  const task = TASK_TYPES.find((t) => t.id === body.task) ?? TASK_TYPES[0];
  const modelName = custom || model!.label;
  const today = new Date().toISOString().slice(0, 10);
  const year = today.slice(0, 4);
  const effortParam = custom
    ? "el parámetro de razonamiento que documente su proveedor, si existe"
    : provider.effortParam;

  // A custom model has no vendor we know: research it from its own name only,
  // so a "DeepSeek" request never gets steered to Anthropic/OpenAI/Google docs.
  const target = custom
    ? `- Modelo: ${custom} (modelo elegido por el usuario; NO asumas que es de Anthropic, OpenAI ni Google)
- Proveedor: descúbrelo en la búsqueda (empresa, sitio oficial de docs, API)
- Esfuerzo pedido: ${effort.label}. ${effort.guidance}`
    : `- Proveedor: ${provider.vendor} (${provider.label})
- Modelo: ${modelName}
- Perfil conocido: ${model!.profile}
- Esfuerzo: ${effort.label} (parámetro de API: ${effortParam})
- Qué implica este esfuerzo: ${effort.guidance}`;

  const research = custom
    ? `1. Con web_search busca "${custom}" por su nombre exacto: quién lo hace, su documentación oficial, guía de prompting, ventana de contexto, si razona (modo thinking/reasoning) y sus parámetros recomendados (temperatura, top_p, etc.). Usa consultas como "${custom} prompt guide ${year}", "${custom} API docs", "${custom} best practices".
2. Con web_fetch abre la página del propio proveedor de ${custom} (su dominio oficial, su repositorio o su ficha de modelo) y léela.
3. Si la documentación oficial es pobre, haz una búsqueda más de fuentes independientes recientes sobre cómo hacer prompts para ${custom}.`
    : `1. Con web_search busca la guía oficial de prompting vigente para ${modelName} (pista: ${provider.searchHint}), incluyendo "${year}" o la versión exacta en la consulta.
2. Con web_fetch abre la página oficial del proveedor más relevante que encontraste y léela.
3. Si hay novedades del modelo (nueva versión, cambios de parámetros), confírmalas con una búsqueda más.`;

  return `Eres PromptForge, un ingeniero de prompts experto. Tu trabajo: reescribir el prompt del usuario para que rinda al máximo en un modelo y nivel de esfuerzo concretos. Hoy es ${today}.

## Modelo destino
${target}
- Tipo de tarea: ${task.label}${task.id === "auto" ? " (detéctalo tú)" : ""}

## Investigación en tiempo real (obligatoria)
La búsqueda web es en vivo: úsala para traer información actual, no la que ya sabes. Antes de escribir:
${research}
4. Investiga también el TEMA del pedido del usuario, no solo el modelo: si menciona un negocio, tecnología, mercado, norma, producto, tendencia o dato que cambie con el tiempo, busca fuentes actuales sobre eso y usa lo que encuentres para hacer el prompt concreto y correcto.
Reglas de búsqueda:
- Cada consulta debe ser distinta y específica (nombre exacto + versión o año); no repitas la misma consulta.
- Diversifica las fuentes: documentación oficial primero, y para el tema del usuario, fuentes especializadas del sector. No te quedes en los mismos sitios genéricos.
- Puedes hacer hasta 5 búsquedas y abrir hasta 3 páginas; usa las que aporten.
- No inventes datos: si la búsqueda contradice lo que creías, manda la búsqueda. Si algo no aparece, dilo.

## Cómo reescribir
- Respeta la intención y el idioma del usuario. No cambies la tarea, mejórala.
- Ajusta el estilo al modelo y al esfuerzo: con poco esfuerzo, instrucciones directas y formato exacto; con mucho, objetivo completo, contexto, criterios de éxito y libertad para planificar.
- Incluye solo lo que aporta: rol si ayuda, contexto, tarea, restricciones, formato de salida, criterios de calidad, ejemplos si el formato es delicado.
- Usa marcadores como [COMPLETAR: ...] donde falte información que solo el usuario conoce.
- No añadas trucos obsoletos ("piensa paso a paso" en modelos de razonamiento, amenazas, propinas, MAYÚSCULAS para enfatizar).
${body.previous ? "\nEl usuario está refinando un prompt que ya forjaste. Aplica su petición sobre ese prompt anterior.\n" : ""}${body.attachments.length > 0 ? `\n## Archivos adjuntos\nEl usuario adjuntó ${body.attachments.length} archivo(s). Léelos con atención: si contienen el prompt a mejorar, ese es el prompt original; si son contexto (documentos, datos, código, imágenes de referencia), usa lo relevante para que el prompt final sea concreto, e indica en el prompt dónde debe pegarse o adjuntarse cada archivo (por ejemplo dentro de etiquetas <documento>). Analiza TODO el contenido (cada página, hoja o diapositiva), no solo el inicio: cifras, columnas, totales, tendencias, fechas, nombres y vacíos de datos. Las hojas de cálculo llegan como CSV por hoja; los PDF, Word y PowerPoint como texto extraído. Menciona en <cambios> qué tomaste de cada archivo.\n` : ""}
## Formato de respuesta
Responde SOLO con estas etiquetas, en este orden, sin texto fuera de ellas:
<diagnostico>
3 a 5 viñetas cortas ("- ") con los problemas del prompt original.
</diagnostico>
<puntaje_antes>número 0-100</puntaje_antes>
<prompt>
El prompt final listo para copiar y pegar en ${modelName}.
</prompt>
<puntaje_despues>número 0-100</puntaje_despues>
<cambios>
3 a 6 viñetas ("- ") con qué cambiaste y por qué, citando lo que encontraste en la web cuando aplique.
</cambios>
<config>
Líneas "clave: valor" con la configuración recomendada de API para ${modelName} (incluye ${effortParam} con el valor adecuado a esfuerzo ${effort.label}, y lo demás que aplique según lo que encontraste).
</config>
<tip>Un consejo pro corto y con algo de humor.</tip>${body.attachments.length > 0 ? `
<archivos>
Una viñeta ("- ") por archivo: "nombre: qué contiene y los datos clave que encontraste (cifras, columnas, temas)". Después 1-2 viñetas con hallazgos cruzados o problemas en los datos.
</archivos>` : ""}`;
};

const parseAttachments = (raw: unknown): Attachment[] | string => {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return "Adjuntos inválidos.";
  if (raw.length > ATTACHMENT_LIMITS.maxFiles)
    return `Máximo ${ATTACHMENT_LIMITS.maxFiles} archivos.`;
  const files: Attachment[] = [];
  let total = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") return "Adjunto inválido.";
    const file = item as Record<string, unknown>;
    const name = typeof file.name === "string" ? file.name.slice(0, 120) : "";
    const data = typeof file.data === "string" ? file.data : "";
    const mediaType = String(file.mediaType ?? "");
    const kind = file.kind;
    if (!name || !data) return "Adjunto vacío.";
    if (kind === "image" && !IMAGE_TYPES.includes(mediaType))
      return `Formato de imagen no soportado: ${name}`;
    if (kind === "pdf" && mediaType !== "application/pdf")
      return `PDF inválido: ${name}`;
    if (kind !== "text" && kind !== "image" && kind !== "pdf")
      return `Tipo no soportado: ${name}`;
    total += data.length;
    files.push({
      id: String(file.id ?? name),
      name,
      size: Number(file.size) || data.length,
      kind,
      mediaType,
      data: kind === "text" ? data.slice(0, ATTACHMENT_LIMITS.maxTextChars) : data,
    });
  }
  if (total > ATTACHMENT_LIMITS.maxTotalBytes)
    return "Los archivos pesan demasiado (máx. ~3.5 MB en total).";
  return files;
};

const toContentBlocks = (
  files: Attachment[]
): Anthropic.ContentBlockParam[] =>
  files.map((file): Anthropic.ContentBlockParam => {
    if (file.kind === "image") {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: file.mediaType as "image/png",
          data: file.data,
        },
      };
    }
    if (file.kind === "pdf") {
      return {
        type: "document",
        title: file.name,
        source: { type: "base64", media_type: "application/pdf", data: file.data },
      };
    }
    return {
      type: "text",
      text: `<archivo nombre="${file.name.replace(/"/g, "'")}" tipo="${file.mediaType.replace(/"/g, "")}">\n${file.data}\n</archivo>`,
    };
  });

const parseBody = (raw: unknown): ForgeRequest | string => {
  if (!raw || typeof raw !== "object") return "Petición inválida.";
  const body = raw as Record<string, unknown>;
  const attachments = parseAttachments(body.attachments);
  if (typeof attachments === "string") return attachments;
  let prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt && attachments.length > 0)
    prompt = "Mejora el prompt que está en los archivos adjuntos.";
  if (!prompt) return "Escribe un prompt primero.";
  if (prompt.length > MAX_PROMPT_CHARS)
    return `El prompt supera ${MAX_PROMPT_CHARS} caracteres.`;
  const provider = findProvider(String(body.provider));
  if (!provider) return "Proveedor desconocido.";
  const customModel =
    typeof body.customModel === "string" ? body.customModel : undefined;
  if (!customModel?.trim() && !provider.models.some((m) => m.id === body.model))
    return "Modelo desconocido.";
  const previous =
    typeof body.previous === "string" && body.previous.trim()
      ? body.previous.slice(0, MAX_PROMPT_CHARS)
      : undefined;
  return {
    prompt,
    provider: provider.id,
    model: String(body.model),
    customModel,
    effort: String(body.effort),
    task: String(body.task),
    previous,
    attachments,
  };
};

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return Response.json(
      { error: "Demasiadas forjas seguidas. Respira y prueba en unos minutos." },
      { status: 429 }
    );
  }

  const body = parseBody(await request.json().catch(() => null));
  if (typeof body === "string") {
    return Response.json({ error: body }, { status: 400 });
  }

  const promptText = body.previous
    ? `<prompt_anterior>\n${body.previous}\n</prompt_anterior>\n\n<peticion_de_refinamiento>\n${body.prompt}\n</peticion_de_refinamiento>`
    : `<prompt_original>\n${body.prompt}\n</prompt_original>`;
  // Files go before the question so the model reads the context first.
  const userContent: Anthropic.ContentBlockParam[] = [
    ...toContentBlocks(body.attachments),
    { type: "text", text: promptText },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ForgeEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: userContent },
      ];
      let inputTokens = 0;
      let outputTokens = 0;
      let searches = 0;

      try {
        for (let round = 0; round <= MAX_CONTINUATIONS; round++) {
          const response = client.messages.stream(
            {
              model: MODEL,
              max_tokens: 16000,
              thinking: { type: "adaptive", display: "summarized" },
              output_config: { effort: "medium" },
              system: buildSystem(body),
              // Basic variants: Haiku 5.5 mis-shapes the dynamic-filtering inputs.
              tools: [
                { type: "web_search_20250305", name: "web_search", max_uses: 5 },
                {
                  type: "web_fetch_20250910",
                  name: "web_fetch",
                  max_uses: 3,
                  max_content_tokens: 12000,
                },
              ],
              messages,
            },
            { signal: request.signal }
          );

          // Server tool inputs stream as JSON fragments; collect per block index.
          const toolInputs = new Map<
            number,
            { id: string; kind: "search" | "fetch"; json: string }
          >();

          for await (const event of response) {
            if (event.type === "content_block_start") {
              const block = event.content_block;
              if (
                block.type === "server_tool_use" &&
                (block.name === "web_search" || block.name === "web_fetch")
              ) {
                toolInputs.set(event.index, {
                  id: block.id,
                  kind: block.name === "web_search" ? "search" : "fetch",
                  json: "",
                });
              } else if (block.type === "web_fetch_tool_result") {
                const content = block.content;
                if (content.type === "web_fetch_result") {
                  send({
                    type: "results",
                    id: block.tool_use_id,
                    items: [
                      {
                        title: content.content.title ?? content.url,
                        url: content.url,
                        age: content.retrieved_at ?? null,
                      },
                    ],
                  });
                } else {
                  send({
                    type: "results",
                    id: block.tool_use_id,
                    items: [],
                    error: content.error_code,
                  });
                }
              } else if (block.type === "web_search_tool_result") {
                if (Array.isArray(block.content)) {
                  send({
                    type: "results",
                    id: block.tool_use_id,
                    items: block.content.map((r) => ({
                      title: r.title,
                      url: r.url,
                      age: r.page_age,
                    })),
                  });
                } else {
                  send({
                    type: "results",
                    id: block.tool_use_id,
                    items: [],
                    error: block.content.error_code,
                  });
                }
              }
            } else if (event.type === "content_block_delta") {
              const delta = event.delta;
              if (delta.type === "text_delta") {
                send({ type: "text", delta: delta.text });
              } else if (delta.type === "thinking_delta") {
                send({ type: "thinking", delta: delta.thinking });
              } else if (delta.type === "input_json_delta") {
                const tool = toolInputs.get(event.index);
                if (tool) tool.json += delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              const tool = toolInputs.get(event.index);
              if (tool) {
                let arg = "";
                try {
                  const input = JSON.parse(tool.json || "{}");
                  arg = String(tool.kind === "search" ? input.query : input.url);
                } catch {
                  arg = "";
                }
                searches++;
                send({ type: "tool", id: tool.id, kind: tool.kind, arg });
              }
            }
          }

          const final = await response.finalMessage();
          inputTokens += final.usage.input_tokens;
          outputTokens += final.usage.output_tokens;

          if (final.stop_reason === "refusal") {
            send({
              type: "error",
              message:
                "El modelo rechazó este pedido por sus filtros de seguridad. Reformúlalo.",
            });
            break;
          }
          if (final.stop_reason === "pause_turn") {
            // Server tool loop paused: resend with the partial turn to resume.
            messages.push({ role: "assistant", content: final.content });
            continue;
          }
          send({ type: "done", inputTokens, outputTokens, searches });
          break;
        }
      } catch (error) {
        if (!request.signal.aborted) {
          const message =
            error instanceof Anthropic.RateLimitError
              ? "La API está saturada (429). Prueba en un momento."
              : error instanceof Anthropic.AuthenticationError
                ? "La API key no es válida o no está configurada."
                : error instanceof Anthropic.APIError
                  ? `Error de la API (${error.status ?? "?"}).`
                  : "Error inesperado al forjar el prompt.";
          console.error("forge error", error);
          send({ type: "error", message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
