"use client";

import {
  Check,
  Copy,
  ExternalLink,
  Paperclip,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { ClaudeCodeLogo } from "@/components/claude-code/components/claude-code-logo";
import { ClaudeCodeMessage } from "@/components/claude-code/components/claude-code-message";
import {
  ClaudeCodeInterrupted,
  ClaudeCodeSpinner,
  ClaudeCodeTurnSummary,
} from "@/components/claude-code/components/claude-code-status";
import { ClaudeCodeTerminal } from "@/components/claude-code/components/claude-code-terminal";
import { ClaudeCodeThinking } from "@/components/claude-code/components/claude-code-thinking";
import { ClaudeCodeTodoList } from "@/components/claude-code/components/claude-code-todo-list";
import { ClaudeCodeToolCall } from "@/components/claude-code/components/claude-code-tool-call";
import { CLAUDE_CODE_RESULT_GLYPH } from "@/components/claude-code/constants/claude-code";
import { renderClaudeCodeInline } from "@/components/claude-code/lib/claude-code-inline";
import type { ClaudeCodeTodo } from "@/components/claude-code/types/claude-code";
import { ShineBorder } from "@/components/ui/shine-border";
import {
  ACCEPT_FILES,
  ATTACHMENT_LIMITS,
  CUSTOM_EFFORTS,
  effortsFor,
  findProvider,
  PROVIDERS,
  RANKS,
  TASK_TYPES,
  type Attachment,
  type ProviderId,
} from "@/lib/catalog";
import { readAttachment } from "@/lib/read-attachment";
import {
  parseBullets,
  parseConfig,
  parseForge,
  parseScore,
  type ForgeResult,
} from "@/lib/parse-forge";
import { cn } from "@/lib/utils";

import { DeskScene, type SceneState } from "./desk-scene";
import { HaloDropzone } from "./halo-dropzone";
import { useForge, type ForgeRun } from "./use-forge";

const PROVIDER_STYLE: Record<
  ProviderId,
  { logo: string; ring: string; text: string; glow: string; shine: string[] }
> = {
  claude: {
    logo: "/logos/claude.svg",
    ring: "ring-[#e06443]/70",
    text: "text-[#e06443]",
    glow: "from-[#e06443]/25",
    shine: ["#e06443", "#fbbf24", "#f472b6"],
  },
  gpt: {
    logo: "/logos/openai.svg",
    ring: "ring-emerald-400/70",
    text: "text-emerald-400",
    glow: "from-emerald-400/20",
    shine: ["#34d399", "#a7f3d0", "#22d3ee"],
  },
  gemini: {
    logo: "/logos/gemini.svg",
    ring: "ring-sky-400/70",
    text: "text-sky-400",
    glow: "from-sky-400/20",
    shine: ["#38bdf8", "#a78bfa", "#f472b6"],
  },
};

const sceneStateOf = (run: ForgeRun | undefined): SceneState => {
  if (!run) return "idle";
  if (run.status === "done") return "done";
  if (run.status === "error") return "error";
  if (run.status !== "working") return "idle";
  const searching = run.searches.some((s) => !s.results && !s.error);
  return run.text && !searching ? "writing" : "searching";
};

const EXAMPLES = [
  "hazme una landing page para mi cafetería",
  "resume este contrato y dime los riesgos",
  "escribe un script en python que limpie un csv",
  "ideas de posts para instagram de una marca de ropa",
];

const XP_KEY = "promptforge:xp";
const COUNT_KEY = "promptforge:count";

const readNumber = (key: string) => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};

const writeNumber = (key: string, value: number) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage blocked: XP just won't persist.
  }
};

const formatDuration = (ms: number) => {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const Forge = () => {
  const [providerId, setProviderId] = useState<ProviderId>("claude");
  const provider = findProvider(providerId)!;
  const [modelId, setModelId] = useState(provider.models[1].id);
  const [customModel, setCustomModel] = useState("");
  const [effort, setEffort] = useState(provider.models[1].defaultEffort);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [task, setTask] = useState("auto");
  const [draft, setDraft] = useState("");
  const [refineFrom, setRefineFrom] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const [count, setCount] = useState(0);
  const [celebrate, setCelebrate] = useState(0);
  const { runs, busy, now, forge, stop, clear } = useForge();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const rewarded = useRef(new Set<string>());

  useEffect(() => {
    setXp(readNumber(XP_KEY));
    setCount(readNumber(COUNT_KEY));
  }, []);

  const model = customModel.trim()
    ? undefined
    : provider.models.find((m) => m.id === modelId);
  const efforts = customModel.trim() ? CUSTOM_EFFORTS : effortsFor(provider, model);
  const effortOption = efforts.find((e) => e.id === effort) ?? efforts[0];
  const targetLabel = customModel.trim() || model?.label || provider.label;

  const pickProvider = (id: ProviderId) => {
    const next = findProvider(id)!;
    setProviderId(id);
    setModelId(next.models[0].id);
    setEffort(next.models[0].defaultEffort);
    setCustomModel("");
  };

  const addFiles = async (incoming: File[]) => {
    setFileError(null);
    const room = ATTACHMENT_LIMITS.maxFiles - attachments.length;
    if (room <= 0) {
      setFileError(`Máximo ${ATTACHMENT_LIMITS.maxFiles} archivos.`);
      return;
    }
    setReading(true);
    const read = await Promise.all(incoming.slice(0, room).map(readAttachment)).finally(() =>
      setReading(false)
    );
    const ok = read.filter((item): item is Attachment => typeof item !== "string");
    const problems = read.filter((item): item is string => typeof item === "string");
    const next = [...attachments, ...ok.filter((f) => !attachments.some((a) => a.id === f.id))];
    const total = next.reduce((sum, file) => sum + file.data.length, 0);
    if (total > ATTACHMENT_LIMITS.maxTotalBytes) {
      setFileError("Los archivos pesan demasiado (máx. ~3.5 MB en total).");
      return;
    }
    setAttachments(next);
    if (problems.length > 0) setFileError(problems[0]);
    else if (incoming.length > room) setFileError(`Solo entran ${ATTACHMENT_LIMITS.maxFiles} archivos.`);
  };

  const activeRun =
    runs.find((run) => run.id === selectedRunId) ?? runs.at(-1) ?? null;
  const activeResult = useMemo(
    () => (activeRun ? parseForge(activeRun.text) : {}),
    [activeRun]
  );

  // Award XP once per finished run, scaled by how much the score improved.
  useEffect(() => {
    for (const run of runs) {
      if (run.status !== "done" || rewarded.current.has(run.id)) continue;
      rewarded.current.add(run.id);
      const parsed = parseForge(run.text);
      const gain = Math.max(
        0,
        (parseScore(parsed.puntaje_despues) ?? 0) -
          (parseScore(parsed.puntaje_antes) ?? 0)
      );
      setXp((value) => {
        const next = value + 10 + gain;
        writeNumber(XP_KEY, next);
        return next;
      });
      setCount((value) => {
        writeNumber(COUNT_KEY, value + 1);
        return value + 1;
      });
      if (gain >= 25) setCelebrate(Date.now());
    }
  }, [runs]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [runs]);

  const runCommand = (text: string) => {
    const [command, ...rest] = text.slice(1).split(/\s+/);
    const arg = rest.join(" ").toLowerCase();
    if (command === "clear") {
      clear();
      setSelectedRunId(null);
      setRefineFrom(null);
    } else if (command === "effort") {
      const match = efforts.find((e) => e.id === arg);
      if (match) setEffort(match.id);
    } else if (command === "model") {
      for (const p of PROVIDERS) {
        const match = p.models.find(
          (m) => m.label.toLowerCase().includes(arg) || m.id.includes(arg)
        );
        if (match && arg) {
          setProviderId(p.id);
          setModelId(match.id);
          setEffort(match.defaultEffort);
          setCustomModel("");
          break;
        }
      }
    }
  };

  const send = () => {
    const text = draft.trim();
    if ((!text && attachments.length === 0) || busy) return;
    setDraft("");
    if (text.startsWith("/")) {
      runCommand(text);
      return;
    }
    setSelectedRunId(null);
    void forge({
      prompt: text,
      provider: providerId,
      model: modelId,
      customModel: customModel.trim() || undefined,
      effort: effortOption.id,
      task,
      previous: refineFrom ?? undefined,
      attachments,
      target: targetLabel,
    });
    setRefineFrom(null);
    setAttachments([]);
    setFileError(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    } else if (event.key === "Escape" && busy) {
      event.preventDefault();
      stop();
    }
  };

  const rankIndex = RANKS.findLastIndex((rank) => xp >= rank.xp);
  const rank = RANKS[rankIndex];
  const nextRank = RANKS[rankIndex + 1];
  const rankProgress = nextRank
    ? ((xp - rank.xp) / (nextRank.xp - rank.xp)) * 100
    : 100;
  const style = PROVIDER_STYLE[providerId];

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip lg:h-dvh">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="forge-aurora forge-aurora-a transition-colors duration-1000"
          style={{ background: style.shine[0] }}
        />
        <div
          className="forge-aurora forge-aurora-b transition-colors duration-1000"
          style={{ background: style.shine[2] }}
        />
        <div className="forge-aurora forge-aurora-c" />
        <div className="forge-noise absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#09090b_95%)]" />
      </div>
      {celebrate > 0 && <Confetti key={celebrate} />}

      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
            <ClaudeCodeLogo className="text-claude-code-accent forge-bob" size={26} />
          </div>
          <div>
            <h1 className="font-claude-code bg-gradient-to-r from-white via-white to-[#e06443] bg-clip-text text-base font-bold tracking-tight text-transparent">
              PromptForge
            </h1>
            <p className="text-xs text-white/50">
              Forja prompts a la medida de cada modelo · Haiku 5.5 + búsqueda web
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
          <div className="text-right">
            <p className="font-claude-code text-xs text-white">
              <span className="text-claude-code-accent">✦</span> {rank.name}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                <div
                  className="bg-claude-code-accent h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${rankProgress}%` }}
                />
              </div>
              <span className="font-claude-code text-[0.6875rem] text-white/50 tabular-nums">
                {xp} XP
              </span>
            </div>
          </div>
          <div className="font-claude-code border-l border-white/10 pl-3 text-center">
            <p className="text-sm font-bold text-white tabular-nums">{count}</p>
            <p className="text-[0.625rem] text-white/50">forjados</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 grid min-h-0 flex-1 gap-4 p-4 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)_23rem] xl:grid-cols-[19rem_minmax(0,1fr)_26rem]">
        {/* Config */}
        <section className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.015] shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_20px_50px_-20px_rgb(0_0_0/0.6)] backdrop-blur-xl p-4 ring-1 ring-white/10 lg:pr-3">
          <Step n={1} title="Elige el modelo">
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => {
                const s = PROVIDER_STYLE[p.id];
                const active = p.id === providerId;
                return (
                  <button
                    className={cn(
                      "group flex flex-col items-center gap-1 rounded-xl bg-white/[0.04] px-2 py-3 ring-1 ring-white/10 transition hover:bg-white/[0.08]",
                      active && !customModel.trim() && ["bg-white/[0.08] ring-2", s.ring]
                    )}
                    key={p.id}
                    onClick={() => pickProvider(p.id)}
                    type="button"
                  >
                    <span
                      className={cn(
                        "grid size-9 place-items-center rounded-lg bg-black/40 ring-1 ring-white/10 transition-transform group-hover:scale-110",
                        active && "forge-spin-once"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt={`Logo de ${p.label}`} className="size-5" src={s.logo} />
                    </span>
                    <span className="text-xs font-medium text-white">{p.label}</span>
                    <span className="text-[0.625rem] text-white/40">{p.vendor}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {provider.models.map((m) => {
                const active = m.id === modelId && !customModel.trim();
                return (
                  <button
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.06]",
                      active && "bg-white/[0.08] text-white"
                    )}
                    key={m.id}
                    onClick={() => {
                      setModelId(m.id);
                      setEffort(m.defaultEffort);
                      setCustomModel("");
                    }}
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 rounded-full bg-white/20",
                          active && ["bg-current", style.text]
                        )}
                      />
                      {m.label}
                    </span>
                    <span className="text-[0.6875rem] text-white/40">{m.tag}</span>
                  </button>
                );
              })}
              <input
                className="font-claude-code mt-1 rounded-lg bg-black/30 px-3 py-2 text-xs text-white ring-1 ring-white/10 outline-none placeholder:text-white/30 focus:ring-white/30"
                onChange={(event) => setCustomModel(event.target.value)}
                placeholder="¿Otro modelo? ej. DeepSeek V4, Qwen, Llama…"
                value={customModel}
              />
              {customModel.trim() && (
                <p className="mt-1 flex items-start gap-1.5 rounded-lg bg-sky-400/10 px-2.5 py-1.5 text-[0.6875rem] text-sky-200 ring-1 ring-sky-400/20">
                  <span className="mt-px">⌕</span>
                  <span>
                    <span className="font-medium">{customModel.trim()}</span> se investiga en vivo por su nombre: proveedor, docs y guía de prompting actuales.
                  </span>
                </p>
              )}
            </div>
          </Step>

          <Step n={2} title="Nivel de esfuerzo">
            <div
              className="grid gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/10"
              style={{
                gridTemplateColumns: `repeat(${efforts.length}, minmax(0, 1fr))`,
              }}
            >
              {efforts.map((e) => (
                <button
                  className={cn(
                    "font-claude-code flex flex-col items-center rounded-lg py-2 text-[0.6875rem] text-white/50 transition hover:text-white",
                    e.id === effortOption.id && "bg-white/10 text-white shadow-inner"
                  )}
                  key={e.id}
                  onClick={() => setEffort(e.id)}
                  type="button"
                >
                  <span className={cn("text-base", e.id === effortOption.id && style.text)}>
                    {e.glyph}
                  </span>
                  {e.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-white/60">
              <span className="font-medium text-white">{effortOption.blurb}.</span>{" "}
              {effortOption.guidance}
            </p>
            <p className="font-claude-code mt-1 text-[0.6875rem] text-white/30">
              {customModel.trim() ? "parámetro: se investiga en su documentación" : `${provider.effortParam}: "${effortOption.id}"`}
              {model && effortOption.id === model.defaultEffort && " · default"}
            </p>
          </Step>

          <Step n={3} title="Tipo de tarea">
            <div className="flex flex-wrap gap-1.5">
              {TASK_TYPES.map((t) => (
                <button
                  className={cn(
                    "rounded-full px-3 py-1 text-xs text-white/60 ring-1 ring-white/10 transition hover:text-white",
                    t.id === task && "bg-white text-black ring-white hover:text-black"
                  )}
                  key={t.id}
                  onClick={() => setTask(t.id)}
                  type="button"
                >
                  <span className="mr-1 opacity-70">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </Step>

          <Step n={4} title="Archivos de contexto">
            <HaloDropzone
              disabled={busy || reading}
              reading={reading}
              error={fileError}
              files={attachments}
              onFiles={(files) => void addFiles(files)}
              onRemove={(id) => setAttachments((current) => current.filter((f) => f.id !== id))}
            />
          </Step>

          <div className="mt-auto flex items-start gap-2.5 rounded-xl bg-emerald-400/[0.07] p-3 text-xs text-emerald-200 ring-1 ring-emerald-400/20">
            <span className="relative mt-1 flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <p className="text-emerald-200/75">
              <span className="font-medium text-emerald-200">Búsqueda web en vivo.</span>{" "}
              Lee la guía oficial vigente de {targetLabel} antes de reescribir.
            </p>
          </div>
        </section>

        {/* Terminal */}
        <section
          className="relative flex min-h-[36rem] min-w-0 flex-col rounded-xl lg:min-h-0"
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
          }}
          onDragOver={(event) => {
            if (busy || !event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            setDragging(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void addFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <ShineBorder borderWidth={1} className="z-20" color={style.shine} duration={busy ? 5 : 14} />
          {dragging && (
            <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center rounded-xl bg-black/70 backdrop-blur-sm">
              <p className="font-claude-code rounded-xl border border-dashed border-white/40 px-6 py-4 text-sm text-white">
                <Paperclip className="mr-2 inline size-4" /> Suelta los archivos para dárselos a Claude
              </p>
            </div>
          )}
          <input
            accept={ACCEPT_FILES}
            className="sr-only"
            multiple
            onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
            ref={fileInputRef}
            tabIndex={-1}
            type="file"
          />
          <ClaudeCodeTerminal
            className="h-full flex-1 bg-[#0d0d0f]/95 backdrop-blur"
            footer={
              <Composer
                attachments={attachments}
                busy={busy}
                draft={draft}
                effortGlyph={effortOption.glyph}
                effortLabel={effortOption.label}
                inputRef={inputRef}
                onAttach={() => fileInputRef.current?.click()}
                onChange={setDraft}
                onClearRefine={() => setRefineFrom(null)}
                onKeyDown={onKeyDown}
                onRemoveAttachment={(id) =>
                  setAttachments((current) => current.filter((f) => f.id !== id))
                }
                onSend={send}
                onStop={stop}
                refining={Boolean(refineFrom)}
                target={targetLabel}
              />
            }
            title={`promptforge — ${targetLabel} · ${effortOption.label}`}
          >
            <div className="font-claude-code flex flex-col gap-4 text-[0.8125rem] leading-5">
              <div className="flex flex-col gap-3 rounded-xl bg-[radial-gradient(ellipse_at_20%_110%,rgb(217_119_87/0.14),transparent_60%)] p-3 ring-1 ring-white/[0.06] sm:flex-row sm:items-center sm:gap-5">
                <DeskScene
                  className="w-full max-w-[22rem] shrink-0 pb-5"
                  state={sceneStateOf(runs.at(-1))}
                />
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="text-claude-code-strong font-bold">Claude Code</span>{" "}
                    <span className="text-claude-code-muted">PromptForge v1.1</span>
                  </p>
                  <p className="text-claude-code-muted truncate">Haiku 5.5 · web search · archivos</p>
                  <p className="text-claude-code-muted truncate">~/forja · con búho y café ☕</p>
                </div>
              </div>
              <div className="flex flex-col pl-[2ch]">
                <p>
                  {renderClaudeCodeInline(
                    `Pega tu prompt crudo o suelta archivos. Lo reescribo para **${targetLabel}** con esfuerzo **${effortOption.label}**.`
                  )}
                </p>
                {[
                  "Escribe `/effort high`, `/model astra` o `/clear`",
                  "Enter forja · Shift+Enter nueva línea · Esc detiene",
                ].map((tip) => (
                  <p className="text-claude-code-muted flex gap-[2ch]" key={tip}>
                    <span aria-hidden="true">{CLAUDE_CODE_RESULT_GLYPH}</span>
                    <span>{renderClaudeCodeInline(tip)}</span>
                  </p>
                ))}
              </div>
            </div>
            {runs.length === 0 && (
              <div className="flex flex-wrap gap-2 pl-[2ch]">
                {EXAMPLES.map((example) => (
                  <button
                    className="font-claude-code text-claude-code-muted hover:text-claude-code-fg rounded-md border border-dashed border-white/15 px-2 py-1 text-xs transition hover:border-white/40"
                    key={example}
                    onClick={() => {
                      setDraft(example);
                      inputRef.current?.focus();
                    }}
                    type="button"
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}
            {runs.map((run) => (
              <RunView
                key={run.id}
                now={now}
                onSelect={() => setSelectedRunId(run.id)}
                run={run}
                selected={run.id === activeRun?.id}
              />
            ))}
            <div ref={endRef} />
          </ClaudeCodeTerminal>
        </section>

        {/* Result */}
        <ResultPanel
          onRefine={(prompt) => {
            setRefineFrom(prompt);
            setDraft("");
            inputRef.current?.focus();
          }}
          result={activeResult}
          run={activeRun}
        />
      </main>
    </div>
  );
};

const Step = ({
  children,
  n,
  title,
}: {
  children: React.ReactNode;
  n: number;
  title: string;
}) => (
  <div>
    <p className="font-claude-code mb-2 flex items-center gap-2 text-[0.6875rem] tracking-wider text-white/50 uppercase">
      <span className="grid size-4 place-items-center rounded-full bg-white/10 text-[0.625rem] text-white">
        {n}
      </span>
      {title}
    </p>
    {children}
  </div>
);

const Composer = ({
  attachments,
  busy,
  draft,
  effortGlyph,
  effortLabel,
  inputRef,
  onAttach,
  onChange,
  onClearRefine,
  onKeyDown,
  onRemoveAttachment,
  onSend,
  onStop,
  refining,
  target,
}: {
  attachments: Attachment[];
  onAttach: () => void;
  onRemoveAttachment: (id: string) => void;
  busy: boolean;
  draft: string;
  effortGlyph: string;
  effortLabel: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onClearRefine: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  refining: boolean;
  target: string;
}) => (
  <div className="font-claude-code flex flex-col gap-2">
    {refining && (
      <p className="text-claude-code-mode-accept-edits flex items-center gap-2 pl-[2ch] text-xs">
        ⏵⏵ refinando el último prompt — dime qué cambiar
        <button
          aria-label="Cancelar refinamiento"
          className="text-claude-code-muted hover:text-claude-code-fg"
          onClick={onClearRefine}
          type="button"
        >
          <X className="size-3" />
        </button>
      </p>
    )}
    {attachments.length > 0 && (
      <div className="flex flex-wrap gap-1.5 pl-[2ch]">
        {attachments.map((file) => (
          <span
            className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-white/80 ring-1 ring-white/10"
            key={file.id}
          >
            <Paperclip className="size-3 text-white/50" />
            <span className="max-w-40 truncate">{file.name}</span>
            <button
              aria-label={`Quitar ${file.name}`}
              className="text-white/40 hover:text-white"
              onClick={() => onRemoveAttachment(file.id)}
              type="button"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
    )}
    <div className="border-claude-code-rule grid grid-cols-[2ch_minmax(0,1fr)_auto_auto] items-start gap-x-0 border-y py-1.5">
      <span aria-hidden="true" className="text-claude-code-strong">
        ❯
      </span>
      <textarea
        aria-label="Tu prompt"
        className="text-claude-code-strong placeholder:text-claude-code-muted caret-claude-code-accent field-sizing-content max-h-40 min-h-5 resize-none bg-transparent outline-none"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={
          refining
            ? "ej. hazlo más corto y añade un ejemplo"
            : "Pega o escribe tu prompt…"
        }
        ref={inputRef}
        rows={1}
        spellCheck={false}
        value={draft}
      />
      <button
        aria-label="Adjuntar archivos"
        className="text-claude-code-muted hover:text-claude-code-fg ml-2 rounded-md px-1.5 transition hover:bg-white/5 disabled:opacity-30"
        disabled={busy}
        onClick={onAttach}
        title="Adjuntar archivos"
        type="button"
      >
        <Paperclip className="size-3.5" />
      </button>
      <button
        className={cn(
          "ml-1 rounded-md px-2 text-xs font-bold transition",
          busy
            ? "text-claude-code-error hover:bg-white/5"
            : "bg-claude-code-accent text-black hover:brightness-110 disabled:opacity-30"
        )}
        disabled={!busy && !draft.trim() && attachments.length === 0}
        onClick={busy ? onStop : onSend}
        type="button"
      >
        {busy ? "esc" : "forjar ↵"}
      </button>
    </div>
    <div className="text-claude-code-muted flex flex-wrap items-baseline justify-between gap-x-[2ch] pl-[2ch] text-xs">
      <p>
        <span className="text-claude-code-mode-plan">⏵⏵ web search on</span> · {target}
      </p>
      <p>
        {effortGlyph} {effortLabel} · /effort
      </p>
    </div>
  </div>
);

const RunView = ({
  now,
  onSelect,
  run,
  selected,
}: {
  now: number;
  onSelect: () => void;
  run: ForgeRun;
  selected: boolean;
}) => {
  const parsed = parseForge(run.text);
  const searching = run.searches.some((s) => !s.results && !s.error);
  const writing = Boolean(parsed.diagnostico);
  const before = parseScore(parsed.puntaje_antes);
  const after = parseScore(parsed.puntaje_despues);
  const working = run.status === "working";

  const todos: ClaudeCodeTodo[] = [
    { label: "Leer tu prompt", status: "done" },
    {
      label: `Investigar la guía actual de ${run.target}`,
      status:
        writing || !working ? "done" : run.searches.length > 0 || searching ? "active" : "todo",
    },
    {
      label: `Reescribir para esfuerzo ${run.effort}`,
      status: parsed.prompt?.done || !working ? "done" : writing ? "active" : "todo",
    },
    {
      label: "Puntuar y explicar cambios",
      status: !working ? "done" : parsed.prompt?.done ? "active" : "todo",
    },
  ];

  const tokens = Math.round((run.thinking.length + run.text.length) / 4);

  return (
    <div
      className={cn(
        "-mx-2 flex flex-col gap-4 rounded-lg px-2 py-2 transition",
        selected && "bg-white/[0.02]"
      )}
    >
      <ClaudeCodeMessage className="-mx-1 rounded px-1 py-0.5" from="user">
        <span className="line-clamp-6">
          {run.refining && <span className="text-claude-code-mode-accept-edits">[refinar] </span>}
          {run.prompt || <span className="text-claude-code-muted">(mejora el prompt de los archivos)</span>}
        </span>
      </ClaudeCodeMessage>

      {run.files.length > 0 && (
        <ClaudeCodeToolCall
          arg={`${run.files.length} archivo${run.files.length === 1 ? "" : "s"}`}
          result={run.files.join(", ")}
          tool="Read"
        />
      )}

      {run.thinking && (
        <ClaudeCodeThinking label={working && !writing ? "Pensando…" : "Pensé un poco"}>
          {run.thinking}
        </ClaudeCodeThinking>
      )}

      {run.searches.map((search) => (
        <ClaudeCodeToolCall
          arg={(search.kind === "fetch" ? hostOf(search.query) : search.query) || "…"}
          key={search.id}
          result={
            search.error
              ? `Falló (${search.error})`
              : search.results
                ? search.kind === "fetch"
                  ? `Leí «${search.results[0]?.title ?? "la página"}»`
                  : `${search.results.length} resultados`
                : search.kind === "fetch"
                  ? "Leyendo la página…"
                  : "Buscando en la web…"
          }
          status={search.error ? "error" : search.results ? "success" : "pending"}
          tool={search.kind === "fetch" ? "WebFetch" : "WebSearch"}
        >
          {search.kind === "search" && search.results && search.results.length > 0
            ? search.results
                .slice(0, 8)
                .map((r) => `${r.title}\n  ${hostOf(r.url)}`)
                .join("\n")
            : undefined}
        </ClaudeCodeToolCall>
      ))}

      <ClaudeCodeTodoList heading="Plan de forja" todos={todos} />

      {after !== undefined && (
        <ClaudeCodeMessage>
          {renderClaudeCodeInline(
            `Prompt forjado para **${run.target}**: puntaje \`${before ?? "?"}\` → \`${after}\``
          )}
          {before !== undefined && (
            <span className="text-claude-code-success"> (+{Math.max(0, after - before)})</span>
          )}
          {!selected && (
            <button
              className="text-claude-code-link ml-2 underline underline-offset-2"
              onClick={onSelect}
              type="button"
            >
              ver resultado
            </button>
          )}
        </ClaudeCodeMessage>
      )}

      {working && (
        <ClaudeCodeSpinner
          details={[searching ? "buscando" : writing ? "escribiendo" : "pensando"]}
          elapsed={formatDuration(now - run.startedAt)}
          tip={
            searching
              ? "Leyendo la documentación oficial más reciente…"
              : "Esc para detener"
          }
          tokens={tokens}
          verb={run.verb}
        />
      )}
      {run.status === "done" && (
        <ClaudeCodeTurnSummary
          duration={formatDuration(run.durationMs ?? 0)}
          verb="Forjado"
          doneAt={run.tokens ? `${run.tokens.toLocaleString("es")} tokens` : undefined}
        />
      )}
      {run.status === "interrupted" && <ClaudeCodeInterrupted hint="¿Qué forjamos ahora?" />}
      {run.status === "error" && <ClaudeCodeInterrupted hint={run.error} />}
    </div>
  );
};

const ScoreRing = ({
  label,
  tone,
  value,
}: {
  label: string;
  tone: string;
  value?: number;
}) => {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const shown = value ?? 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative size-16">
        <svg className="size-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" fill="none" r={radius} stroke="rgb(255 255 255 / 0.08)" strokeWidth="6" />
          <circle
            className="transition-[stroke-dashoffset] duration-1000 ease-out"
            cx="32"
            cy="32"
            fill="none"
            r={radius}
            stroke={tone}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - shown / 100)}
            strokeLinecap="round"
            strokeWidth="6"
          />
        </svg>
        <span className="font-claude-code absolute inset-0 grid place-items-center text-sm font-bold text-white tabular-nums">
          {value ?? "–"}
        </span>
      </div>
      <span className="text-[0.625rem] tracking-wider text-white/50 uppercase">{label}</span>
    </div>
  );
};

const ResultPanel = ({
  onRefine,
  result,
  run,
}: {
  onRefine: (prompt: string) => void;
  result: ForgeResult;
  run: ForgeRun | null;
}) => {
  const [copied, setCopied] = useState(false);
  const before = parseScore(result.puntaje_antes);
  const after = parseScore(result.puntaje_despues);
  const prompt = result.prompt?.value ?? "";
  const diagnosis = parseBullets(result.diagnostico);
  const fileNotes = parseBullets(result.archivos);
  const changes = parseBullets(result.cambios);
  const config = parseConfig(result.config);
  const sources = run
    ? Array.from(
        new Map(
          run.searches.flatMap((s) => s.results ?? []).map((r) => [r.url, r])
        ).values()
      ).slice(0, 8)
    : [];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  if (!run) {
    return (
      <section className="flex min-h-0 flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.015] shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_20px_50px_-20px_rgb(0_0_0/0.6)] backdrop-blur-xl p-6 text-center ring-1 ring-white/10">
        <div className="forge-bob text-5xl">⚒</div>
        <p className="font-claude-code text-sm text-white">El yunque está listo</p>
        <p className="max-w-60 text-xs text-white/50">
          Elige modelo y esfuerzo, pega tu prompt en la terminal y aquí aparece la
          versión forjada con su puntaje, cambios y fuentes.
        </p>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.015] shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_20px_50px_-20px_rgb(0_0_0/0.6)] backdrop-blur-xl p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-around rounded-xl bg-black/30 py-3 ring-1 ring-white/10">
        <ScoreRing label="antes" tone="#8c8c8c" value={before} />
        <div className="font-claude-code text-center">
          <p className="text-claude-code-accent text-lg">→</p>
          {before !== undefined && after !== undefined && (
            <p className="text-xs font-bold text-emerald-400">+{Math.max(0, after - before)}</p>
          )}
        </div>
        <ScoreRing label="después" tone="#34d399" value={after} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-claude-code text-[0.6875rem] tracking-wider text-white/50 uppercase">
            Prompt forjado · {run.target}
          </p>
          <div className="flex gap-1">
            <button
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-white/60 ring-1 ring-white/10 transition hover:text-white disabled:opacity-30"
              disabled={!result.prompt?.done}
              onClick={() => onRefine(prompt)}
              type="button"
            >
              <RotateCcw className="size-3" /> Refinar
            </button>
            <button
              className="bg-claude-code-accent flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-black transition hover:brightness-110 disabled:opacity-30"
              disabled={!prompt}
              onClick={copy}
              type="button"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
        <pre className="font-claude-code max-h-80 overflow-y-auto rounded-xl bg-black/40 p-3 text-xs leading-5 whitespace-pre-wrap text-white/90 ring-1 ring-white/10">
          {prompt || (run.status === "working" ? "…" : "Sin resultado.")}
          {run.status === "working" && result.prompt && !result.prompt.done && (
            <span className="bg-claude-code-accent ml-0.5 inline-block h-3.5 w-[1ch] animate-pulse align-middle" />
          )}
        </pre>
      </div>

      {fileNotes.length > 0 && (
        <ListBlock items={fileNotes} marker="◈" markerClass="text-sky-300" title="Análisis de archivos" />
      )}
      {diagnosis.length > 0 && (
        <ListBlock items={diagnosis} marker="✗" markerClass="text-rose-400" title="Diagnóstico" />
      )}
      {changes.length > 0 && (
        <ListBlock items={changes} marker="✓" markerClass="text-emerald-400" title="Qué cambié" />
      )}

      {config.length > 0 && (
        <div>
          <p className="font-claude-code mb-2 text-[0.6875rem] tracking-wider text-white/50 uppercase">
            Config recomendada
          </p>
          <div className="font-claude-code overflow-hidden rounded-xl bg-black/30 text-xs ring-1 ring-white/10">
            {config.map((row) => (
              <div className="flex gap-3 border-b border-white/5 px-3 py-1.5 last:border-0" key={row.key + row.value}>
                <span className="text-sky-300">{row.key}</span>
                <span className="min-w-0 break-words text-white/80">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div>
          <p className="font-claude-code mb-2 text-[0.6875rem] tracking-wider text-white/50 uppercase">
            Fuentes consultadas
          </p>
          <ul className="flex flex-col gap-1">
            {sources.map((source) => (
              <li key={source.url}>
                <a
                  className="group flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-white/5"
                  href={source.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink className="mt-0.5 size-3 shrink-0 text-white/40 group-hover:text-white" />
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-white/80">{source.title}</span>
                    <span className="text-white/40">{hostOf(source.url)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.tip?.value && (
        <div className="flex gap-2 rounded-xl bg-amber-300/10 p-3 text-xs text-amber-100 ring-1 ring-amber-300/20">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
          <p>{result.tip.value}</p>
        </div>
      )}
    </section>
  );
};

const ListBlock = ({
  items,
  marker,
  markerClass,
  title,
}: {
  items: string[];
  marker: string;
  markerClass: string;
  title: string;
}) => (
  <div>
    <p className="font-claude-code mb-2 text-[0.6875rem] tracking-wider text-white/50 uppercase">
      {title}
    </p>
    <ul className="flex flex-col gap-1.5 text-xs text-white/75">
      {items.map((item) => (
        <li className="flex gap-2" key={item}>
          <span className={cn("font-claude-code shrink-0", markerClass)}>{marker}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

const CONFETTI_COLORS = ["#e06443", "#34d399", "#38bdf8", "#fbbf24", "#f472b6"];

const Confetti = () => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.6 + Math.random() * 1.2,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360,
      })),
    []
  );
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((piece, i) => (
        <span
          className="forge-confetti absolute top-0 h-3 w-1.5 rounded-sm"
          key={i}
          style={{
            left: `${piece.left}%`,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            rotate: `${piece.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
};
