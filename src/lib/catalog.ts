export type ProviderId = "claude" | "gpt" | "gemini";

export interface EffortOption {
  id: string;
  /** Glyph shown in the Claude Code style status line. */
  glyph: string;
  label: string;
  /** Short, playful description for the UI. */
  blurb: string;
  /** How the target model behaves at this level, sent to the prompt engineer. */
  guidance: string;
}

export interface ModelOption {
  id: string;
  label: string;
  tag: string;
  /** What this model is good at, sent to the prompt engineer. */
  profile: string;
  /** Effort ids from the provider's pool that this model accepts. */
  efforts: string[];
  defaultEffort: string;
}

export interface Provider {
  id: ProviderId;
  label: string;
  vendor: string;
  /** Effort parameter name in the provider's API. */
  effortParam: string;
  /** What to search to find the vendor's current prompting guide. */
  searchHint: string;
  models: ModelOption[];
  /** Every effort level the vendor offers; models pick a subset. */
  efforts: EffortOption[];
}

const ALL_CLAUDE = ["low", "medium", "high", "xhigh", "max"];

export const PROVIDERS: Provider[] = [
  {
    id: "claude",
    label: "Claude",
    vendor: "Anthropic",
    effortParam: "output_config.effort",
    searchHint:
      "Anthropic prompt engineering best practices platform.claude.com/docs",
    models: [
      {
        id: "claude-fable-5-1",
        label: "Fable 5.1",
        tag: "el más capaz",
        profile:
          "Modelo más capaz de Anthropic. Pensamiento siempre activo. Los prompts demasiado prescriptivos reducen su calidad: dale el objetivo, el contexto y los criterios de éxito, no micro-pasos.",
        efforts: ALL_CLAUDE,
        defaultEffort: "high",
      },
      {
        id: "claude-opus-5-5",
        label: "Opus 5.5",
        tag: "top general",
        profile:
          "Opus actual. Pensamiento adaptativo siempre activo, effort por defecto medium. Muy bueno en tareas largas y agénticas. Sin prefill de asistente.",
        efforts: ALL_CLAUDE,
        defaultEffort: "high",
      },
      {
        id: "claude-sonnet-5-5",
        label: "Sonnet 5.5",
        tag: "rápido y fuerte",
        profile:
          "Equilibrio velocidad/capacidad para código, agentes y trabajo empresarial. Effort por defecto high.",
        efforts: ALL_CLAUDE,
        defaultEffort: "high",
      },
      {
        id: "claude-haiku-5-5",
        label: "Haiku 5.5",
        tag: "veloz y barato",
        profile:
          "Rápido y económico: clasificación, extracción, sub-agentes. Sigue instrucciones muy bien; prefiere instrucciones claras y formato de salida explícito. Effort por defecto medium.",
        efforts: ALL_CLAUDE,
        defaultEffort: "medium",
      },
    ],
    efforts: [
      {
        id: "low",
        glyph: "○",
        label: "low",
        blurb: "Respuesta express",
        guidance:
          "Poco razonamiento. El prompt debe ser directo, con la tarea, el formato de salida exacto y ejemplos si hacen falta. Nada de pedir que 'piense paso a paso'.",
      },
      {
        id: "medium",
        glyph: "◑",
        label: "medium",
        blurb: "Equilibrado",
        guidance:
          "Razonamiento moderado. Objetivo claro, contexto relevante, restricciones y formato. Puede incluir criterios de calidad breves.",
      },
      {
        id: "high",
        glyph: "◕",
        label: "high",
        blurb: "Piensa en serio",
        guidance:
          "Razonamiento profundo. Da el objetivo completo por adelantado, el porqué, criterios de éxito y casos borde; deja que el modelo planifique en lugar de dictar cada paso.",
      },
      {
        id: "xhigh",
        glyph: "◉",
        label: "xhigh",
        blurb: "Modo ingeniero",
        guidance:
          "Ideal para código y tareas agénticas largas. Especificación completa de la tarea desde el inicio, definición de 'terminado', cómo verificar el resultado.",
      },
      {
        id: "max",
        glyph: "●",
        label: "max",
        blurb: "Cerebro galáctico",
        guidance:
          "Máximo razonamiento para problemas muy difíciles. Plantea el problema completo, restricciones duras, cómo validar la respuesta; sin instrucciones de formato que corten el razonamiento.",
      },
    ],
  },
  {
    id: "gpt",
    label: "GPT",
    vendor: "OpenAI",
    effortParam: "reasoning.effort",
    searchHint:
      "OpenAI prompting guide GPT-6 developers.openai.com/api/docs/guides",
    models: [
      {
        id: "gpt-6-astra",
        label: "GPT-6 Astra",
        tag: "el más capaz",
        profile:
          "Modelo insignia de OpenAI para el trabajo más exigente. Razona siempre (sin nivel 'none'). Responde mejor a objetivos de alto nivel y criterios de verificación que a cadenas de pasos.",
        efforts: ["low", "medium", "high", "xhigh", "max"],
        defaultEffort: "medium",
      },
      {
        id: "gpt-6.1-sol",
        label: "GPT-6.1 Sol",
        tag: "casi Astra, más barato",
        profile:
          "Rendimiento cercano a Astra para trabajo complejo a menor costo. Razona siempre. Buen equilibrio para código y análisis.",
        efforts: ["low", "medium", "high", "xhigh", "max"],
        defaultEffort: "medium",
      },
      {
        id: "gpt-6.1-terra",
        label: "GPT-6.1 Terra",
        tag: "visión y escritura",
        profile:
          "Rápido y eficiente: razonamiento visual, uso preciso de computadora y escritura natural. Admite effort 'none' para respuestas sin razonamiento.",
        efforts: ["none", "low", "medium", "high", "xhigh", "max"],
        defaultEffort: "low",
      },
      {
        id: "gpt-6-luna",
        label: "GPT-6 Luna",
        tag: "alto volumen",
        profile:
          "El más eficiente, para tareas acotadas y de alto volumen. Con effort bajo necesita instrucciones explícitas, formato exacto y ejemplos.",
        efforts: ["none", "low", "medium", "high", "xhigh", "max"],
        defaultEffort: "low",
      },
    ],
    efforts: [
      {
        id: "none",
        glyph: "·",
        label: "none",
        blurb: "Sin razonar",
        guidance:
          "Sin razonamiento: se comporta como modelo de chat. Prompt muy explícito, pasos claros si la tarea los necesita, formato exacto y ejemplos few-shot.",
      },
      {
        id: "low",
        glyph: "○",
        label: "low",
        blurb: "Rápido y ligero",
        guidance:
          "Poco razonamiento. Prompt corto, tarea concreta, formato exacto, ejemplos si el formato es delicado.",
      },
      {
        id: "medium",
        glyph: "◑",
        label: "medium",
        blurb: "El default",
        guidance:
          "Razonamiento por defecto. Objetivo, contexto, restricciones y formato. Evita pedir 'piensa paso a paso': el modelo ya razona.",
      },
      {
        id: "high",
        glyph: "◕",
        label: "high",
        blurb: "A fondo",
        guidance:
          "Razonamiento extenso. Instrucciones de alto nivel, criterios de éxito, casos borde; deja espacio de tokens para razonar.",
      },
      {
        id: "xhigh",
        glyph: "◉",
        label: "xhigh",
        blurb: "Modo ingeniero",
        guidance:
          "Para código y agentes largos. Especificación completa desde el inicio, definición de 'terminado' y cómo verificar.",
      },
      {
        id: "max",
        glyph: "●",
        label: "max",
        blurb: "Todo el cerebro",
        guidance:
          "Máximo razonamiento para problemas muy difíciles. Problema completo, restricciones duras y cómo validar la respuesta.",
      },
    ],
  },
  {
    id: "gemini",
    label: "Gemini",
    vendor: "Google",
    effortParam: "thinking_level",
    searchHint: "Google Gemini API prompting strategies ai.google.dev/gemini-api/docs",
    models: [
      {
        id: "gemini-4-argon",
        label: "Gemini 4 Argon",
        tag: "el más capaz",
        profile:
          "Modelo insignia de razonamiento de Google, contexto de 1M y salidas largas. Prefiere instrucciones directas y concisas, contexto largo al inicio y la pregunta al final.",
        efforts: ["low", "medium", "high"],
        defaultEffort: "high",
      },
      {
        id: "gemini-3.8-flash",
        label: "Gemini 3.8 Flash",
        tag: "agentes y código",
        profile:
          "El Flash más capaz: código de larga duración, agentes autónomos y flujos empresariales. thinking_level por defecto medium.",
        efforts: ["low", "medium", "high"],
        defaultEffort: "medium",
      },
      {
        id: "gemini-3.6-flash",
        label: "Gemini 3.6 Flash",
        tag: "multimodal",
        profile:
          "Flash anterior: equilibra velocidad con tareas multimodales y agénticas generales. thinking_level por defecto medium.",
        efforts: ["minimal", "low", "medium", "high"],
        defaultEffort: "medium",
      },
      {
        id: "gemini-3.5-flash-lite",
        label: "Gemini 3.5 Flash-Lite",
        tag: "veloz y barato",
        profile:
          "El más rápido y económico para alto volumen. thinking_level por defecto minimal: necesita instrucciones explícitas y formato exacto.",
        efforts: ["minimal", "low", "medium", "high"],
        defaultEffort: "minimal",
      },
      {
        id: "gemini-3.1-pro-preview",
        label: "Gemini 3.1 Pro",
        tag: "preview",
        profile:
          "Pro de la serie 3.1 en preview. thinking_level por defecto high. Bueno con contexto largo y razonamiento.",
        efforts: ["low", "medium", "high"],
        defaultEffort: "high",
      },
    ],
    efforts: [
      {
        id: "minimal",
        glyph: "·",
        label: "minimal",
        blurb: "Casi sin pensar",
        guidance:
          "Pensamiento mínimo. Prompt directo, tarea única, formato exacto y ejemplos cortos.",
      },
      {
        id: "low",
        glyph: "○",
        label: "low",
        blurb: "Pensamiento ligero",
        guidance:
          "Razonamiento limitado. Instrucciones claras, formato explícito, pocas restricciones bien definidas.",
      },
      {
        id: "medium",
        glyph: "◑",
        label: "medium",
        blurb: "Equilibrado",
        guidance:
          "Razonamiento moderado. Objetivo, contexto, restricciones y formato; contexto largo primero y la pregunta al final.",
      },
      {
        id: "high",
        glyph: "◕",
        label: "high",
        blurb: "Pensamiento completo",
        guidance:
          "Razonamiento amplio. Objetivo completo, contexto primero y la pregunta al final, restricciones y criterios de calidad.",
      },
    ],
  },
];

export interface TaskType {
  id: string;
  label: string;
  emoji: string;
}

export const TASK_TYPES: TaskType[] = [
  { id: "auto", label: "Auto-detectar", emoji: "✦" },
  { id: "code", label: "Código", emoji: "⌘" },
  { id: "writing", label: "Escritura", emoji: "✎" },
  { id: "analysis", label: "Análisis", emoji: "◈" },
  { id: "agent", label: "Agente", emoji: "⚙" },
  { id: "marketing", label: "Marketing", emoji: "✺" },
  { id: "image", label: "Imagen", emoji: "◐" },
  { id: "research", label: "Investigación", emoji: "⌕" },
];

export const findProvider = (id: string) =>
  PROVIDERS.find((provider) => provider.id === id);

/** The effort levels a model accepts, in the provider's order. */
export const effortsFor = (provider: Provider, model?: ModelOption) =>
  model
    ? provider.efforts.filter((e) => model.efforts.includes(e.id))
    : provider.efforts;

/** Fun ranks unlocked with XP earned per forged prompt. */
export const RANKS = [
  { xp: 0, name: "Aprendiz de Prompts" },
  { xp: 100, name: "Herrero de Tokens" },
  { xp: 300, name: "Alquimista de Contexto" },
  { xp: 700, name: "Mago del Few-Shot" },
  { xp: 1500, name: "Arquitecto de Agentes" },
  { xp: 3000, name: "Leyenda del Prompt" },
];

export const SPINNER_VERBS = [
  "Forjando",
  "Destilando",
  "Afinando runas",
  "Martillando tokens",
  "Puliendo contexto",
  "Invocando few-shots",
  "Calibrando el esfuerzo",
];

/** What the owl says while the pair works. */
export const OWL_LINES = {
  idle: ["¡Huu! Pásame un prompt", "Café listo ☕", "Esperando órdenes…"],
  searching: ["Leyendo la guía oficial…", "Huu… ¡encontré algo!", "Revisando la web"],
  writing: ["¡Así queda mejor!", "Escribiendo a cuatro alas", "Casi listo…"],
  done: ["¡Prompt forjado! 🎉", "¡Huu-rra!", "Otro café, por favor"],
  error: ["Uy… algo falló", "Huu… reintentemos"],
};

export interface Attachment {
  id: string;
  name: string;
  size: number;
  kind: "text" | "pdf" | "image";
  mediaType: string;
  /** Plain text for text files, base64 for PDFs and images. */
  data: string;
}

export const ATTACHMENT_LIMITS = {
  maxFiles: 5,
  /** Vercel caps request bodies at 4.5 MB; leave room for the JSON wrapper. */
  maxTotalBytes: 3_800_000,
  maxTextChars: 150_000,
};

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export const ACCEPT_FILES =
  ".pdf,.xlsx,.xlsm,.xls,.ods,.csv,.tsv,.docx,.pptx,.txt,.md,.markdown,.rtf,.json,.xml,.yaml,.yml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.go,.rb,.php,.sql,.log,.png,.jpg,.jpeg,.webp,.gif";

/** Human label for an attachment chip. */
export const attachmentLabel = (file: Attachment) =>
  file.kind === "image"
    ? "imagen"
    : file.kind === "pdf"
      ? "PDF escaneado"
      : ({ "application/pdf": "PDF", spreadsheet: "Excel", word: "Word", slides: "PowerPoint" } as Record<string, string>)[file.mediaType] ?? "texto";

/** Effort levels for a model typed by hand: described generically, researched live. */
export const CUSTOM_EFFORTS: EffortOption[] = [
  {
    id: "low",
    glyph: "○",
    label: "bajo",
    blurb: "Rápido",
    guidance:
      "Respuestas rápidas con poco razonamiento: prompt directo, tarea concreta, formato exacto y ejemplos si el formato importa.",
  },
  {
    id: "medium",
    glyph: "◑",
    label: "medio",
    blurb: "Equilibrado",
    guidance:
      "Razonamiento moderado: objetivo claro, contexto relevante, restricciones y formato de salida.",
  },
  {
    id: "high",
    glyph: "◕",
    label: "alto",
    blurb: "A fondo",
    guidance:
      "Razonamiento profundo: objetivo completo, contexto, criterios de éxito y casos borde; si el modelo tiene modo de razonamiento, recomiéndalo activado.",
  },
];
