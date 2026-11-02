"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SceneState = "idle" | "searching" | "writing" | "done" | "error";

type Vignette = "owl" | "coffee" | "laptop";

const IDLE_ORDER: Vignette[] = ["owl", "coffee", "laptop"];
const IDLE_MS = 7000;

const LINES: Record<Vignette | "searching" | "writing" | "done" | "error", string[]> = {
  coffee: ["Un cafecito primero ☕", "Mmm… café de grano", "Recargando energía"],
  laptop: ["A trabajar 💻", "Abriendo la terminal…", "Listo para forjar"],
  owl: ["¡Ven, búho! 🦉", "¡Huu-huu!", "Aterrizaje perfecto"],
  searching: ["Buscando la guía oficial…", "Leyendo docs en la web", "Huu… ¡encontré algo!"],
  writing: ["Reescribiendo tu prompt", "Puliendo cada línea", "Casi listo…"],
  done: ["¡Prompt forjado! 🎉", "¡Huu-rra!", "¡Choca esas alas!"],
  error: ["Uy… algo falló", "Respira, reintentemos"],
};

const ORANGE = "#D97757";
const DARK = "#141413";
const SCARF = { maroon: "#7b1e2c", gold: "#f0b323" };

/* ─── Clawd ───────────────────────────────────────────────────────────────
 * Sprite adapted from clawd-md by Jamey Prüfert (MIT,
 * https://github.com/jaameypr/clawd-md): an 11×8 unit grid, body 9×6,
 * one-unit arms, four legs, square eyes that turn into ^ ^ when happy.
 */
const Px = ({ h, w, x, y, ...rest }: { x: number; y: number; w: number; h: number; className?: string; fill?: string }) => (
  <rect height={h} width={w} x={x} y={y} {...rest} />
);

const Clawd = ({
  children,
  leftArm,
  pose,
  rightArm,
}: {
  pose: "stand" | "sit";
  leftArm?: string;
  rightArm?: string;
  children?: (by: number) => ReactNode;
}) => {
  const by = pose === "sit" ? 1 : 0;
  const legH = pose === "sit" ? 1 : 2;
  const eye = (c: number) => <Px h={1} key={c} w={1} x={c - 0.5} y={by + 2} />;
  const happy = (c: number) => (
    <g key={c}>
      <Px h={0.6} w={0.6} x={c - 0.9} y={by + 2.5} />
      <Px h={0.6} w={0.6} x={c - 0.3} y={by + 1.9} />
      <Px h={0.6} w={0.6} x={c + 0.3} y={by + 2.5} />
    </g>
  );
  return (
    <g fill={ORANGE} shapeRendering="crispEdges">
      {[1, 3, 7, 9].map((x) => (
        <Px h={legH} key={x} w={1} x={x} y={by + 6} />
      ))}
      <Px h={6} w={9} x={1} y={by} />
      <Px className={leftArm} h={2} w={1} x={0} y={by + 2} />
      <Px className={rightArm} h={2} w={1} x={10} y={by + 2} />
      <g className="pf-eyes" fill={DARK}>
        <g className="pf-blink">{[2.5, 8.5].map(eye)}</g>
      </g>
      <g className="pf-happy" fill={DARK}>
        {[2.5, 8.5].map(happy)}
      </g>
      {children?.(by)}
    </g>
  );
};

/** Clawd is drawn at 6px per unit, centred on the stage. */
const ClawdStage = ({ children }: { children: ReactNode }) => (
  <g transform="translate(21 56) scale(6)">{children}</g>
);

/* ─── Claude Code running on the laptop screen (display: x 108–192, y 45–95) ─── */
const DEMO = [
  { ask: "mejora mi prompt para Opus 5.5", tool: "WebSearch(guía de Opus 5.5)" },
  { ask: "landing para mi cafetería", tool: "Read(menu.csv)" },
  { ask: "/effort high", tool: "Effort → high ◕" },
  { ask: "resume el contrato.pdf", tool: "Read(contrato.pdf)" },
];
const TYPE_MS = 75;
const HOLD_TICKS = 16;
/** Monospace advance at fontSize 3 (≈0.6em). */
const CHAR_W = 1.8;

/** Types demo prompts into the input box and "sends" them, like a real session. */
const useTypingDemo = (active: boolean) => {
  const [step, setStep] = useState({ index: 0, chars: 0, hold: 0 });

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setStep(({ index, chars, hold }) => {
        const length = DEMO[index % DEMO.length].ask.length;
        if (chars < length) return { index, chars: chars + 1, hold };
        if (hold < HOLD_TICKS) return { index, chars, hold: hold + 1 };
        return { index: index + 1, chars: 0, hold: 0 };
      });
    }, TYPE_MS);
    return () => window.clearInterval(id);
  }, [active]);

  const current = DEMO[step.index % DEMO.length];
  const previous = DEMO[(step.index + DEMO.length - 1) % DEMO.length];
  return { typed: current.ask.slice(0, step.chars), sent: previous };
};

const ClaudeCodeScreen = ({ active, state }: { active: boolean; state: SceneState }) => {
  const working = state === "searching" || state === "writing";
  const { sent, typed } = useTypingDemo(active && !working);
  const tool =
    state === "searching"
      ? "WebSearch(guía oficial)"
      : state === "writing"
        ? "Write(prompt.md)"
        : state === "done"
          ? "Forjado para tu modelo"
          : sent.tool;
  return (
    <g fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
      {/* window chrome */}
      <rect fill="#1c1c1f" height="4.5" width="84" x="108" y="45" />
      <circle cx="111" cy="47.25" fill="#ff5f57" r="0.9" />
      <circle cx="114" cy="47.25" fill="#febc2e" r="0.9" />
      <circle cx="117" cy="47.25" fill="#28c840" r="0.9" />
      <text fill="#8c8c8c" fontSize="2.6" textAnchor="middle" x="150" y="48.2">claude — ~/forja</text>
      {/* welcome box */}
      <rect fill="none" height="11" rx="1.2" stroke={ORANGE} strokeWidth="0.5" width="78" x="111" y="52" />
      <text fill={ORANGE} fontSize="3.4" fontWeight="700" x="113.5" y="56.6">✻</text>
      <text fill="#f7f7f7" fontSize="3.2" fontWeight="700" x="118" y="56.6">Welcome to Claude Code!</text>
      <text fill="#8c8c8c" fontSize="2.6" x="118" y="60.6">/help · cwd: ~/forja</text>
      {/* transcript */}
      <text fill="#f7f7f7" fontSize="3" x="111" y="68">&gt; {working ? "mejora mi prompt" : sent.ask}</text>
      <circle cx="112.2" cy="72.3" fill={working ? "#8c8c8c" : "#4eba65"} r="0.9" className={working ? "pf-pending" : undefined} />
      <text fill="#d4d4d4" fontSize="3" x="114.5" y="73.3">{tool}</text>
      <text fill="#8c8c8c" fontSize="2.6" x="114.5" y="77">⎿ {working ? "trabajando…" : state === "done" ? "listo ✓" : "esperando"}</text>
      {/* spinner */}
      <g className={working ? "pf-spinline" : undefined} opacity={working ? 1 : 0.8}>
        <text className="pf-spinglyph" fill={ORANGE} fontSize="3.2" x="111" y="82.6">✻</text>
        <text fill={ORANGE} fontSize="3" x="115" y="82.6">
          {working ? "Forjando… (esc to interrupt)" : state === "done" ? "Forjado en 33s" : "Listo"}
        </text>
      </g>
      {/* input box + status line */}
      <rect fill="none" height="5.2" rx="1" stroke="#555" strokeWidth="0.4" width="78" x="111" y="85" />
      <text fill="#f7f7f7" fontSize="3" x="112.6" y="88.6">❯</text>
      <text fill="#f7f7f7" fontSize="3" x="116" xmlSpace="preserve" y="88.6">{working ? "" : typed}</text>
      <rect className="pf-cursor" fill="#f7f7f7" height="3" width="1.5" x={116 + (working ? 0 : typed.length) * CHAR_W} y="86.1" />
      <text fill="#af87ff" fontSize="2.4" x="112" y="93.4">⏵⏵ auto mode on</text>
      <text fill="#8c8c8c" fontSize="2.4" textAnchor="end" x="189" y="93.4">◕ high · /effort</text>
    </g>
  );
};

/* ─── The owl: the user's plush, small and chubby ─────────────────────── */
const Owl = () => (
  <g>
    <g className="pf-owl-wing pf-owl-wing-l">
      <path d="M-10.5 -2 C-15.5 1 -15.5 8 -11.5 11 C-10 7 -9.6 2 -10.5 -2 Z" fill="#e4e4e0" stroke="#d0d0cb" strokeWidth="0.4" />
    </g>
    <g className="pf-owl-wing pf-owl-wing-r">
      <path d="M10.5 -2 C15.5 1 15.5 8 11.5 11 C10 7 9.6 2 10.5 -2 Z" fill="#e4e4e0" stroke="#d0d0cb" strokeWidth="0.4" />
    </g>
    <path d="M0 -13.5 C8.5 -13.5 12.5 -6 12.5 2 C12.5 9.5 7.5 13.6 0 13.6 C-7.5 13.6 -12.5 9.5 -12.5 2 C-12.5 -6 -8.5 -13.5 0 -13.5 Z" fill="url(#pf-fur)" />
    <ellipse cx="0" cy="8" fill="#ffffff" opacity="0.75" rx="7.5" ry="5" />
    <ellipse cx="0" cy="-3.5" fill="#ffffff" opacity="0.55" rx="10" ry="6.5" />
    <path d="M-3.4 -11.4 l1.4 -0.4 M0 -12 l1.2 0 M3 -11.2 l1 0.3" stroke="#262626" strokeLinecap="round" strokeWidth="0.6" />
    <circle cx="-4.6" cy="-4" fill="#f2a516" r="4.2" />
    <circle cx="4.6" cy="-4" fill="#f2a516" r="4.2" />
    <circle cx="-4.1" cy="-4.5" fill="#0b0b0b" r="3.5" />
    <circle cx="5.1" cy="-4.5" fill="#0b0b0b" r="3.5" />
    <circle cx="-3" cy="-5.8" fill="#fff" r="0.9" />
    <circle cx="6.2" cy="-5.8" fill="#fff" r="0.9" />
    <g className="pf-owl-lids" fill="#f3f3f1">
      <ellipse cx="-4.6" cy="-4" rx="4.4" ry="4.4" />
      <ellipse cx="4.6" cy="-4" rx="4.4" ry="4.4" />
    </g>
    <ellipse cx="-7.4" cy="1" fill="#f9a8b8" opacity="0.35" rx="1.6" ry="0.9" />
    <ellipse cx="7.4" cy="1" fill="#f9a8b8" opacity="0.35" rx="1.6" ry="0.9" />
    <path d="M-1.3 -1.2 Q0 -1.8 1.3 -1.2 L0.2 1.6 Q0 1.9 -0.2 1.6 Z" fill="#141414" />
    <path d="M-11.6 2.4 Q0 6.6 11.6 2.4 L11.3 6.2 Q0 10.6 -11.3 6.2 Z" fill="url(#pf-stripes)" />
    <rect fill="url(#pf-stripes)" height="4.4" rx="1.4" width="4.6" x="5.4" y="5" />
    <g className="pf-owl-tail">
      <rect fill="url(#pf-stripes-v)" height="9.5" rx="0.9" transform="rotate(-14 8 8)" width="3.6" x="6.4" y="7.6" />
    </g>
    <path d="M-6.6 13 q1.1 -2 2.2 0 q1.1 -2 2.2 0 q0 1.6 -2.2 1.6 q-2.2 0 -2.2 -1.6 Z" fill="#141414" />
    <path d="M2.2 13 q1.1 -2 2.2 0 q1.1 -2 2.2 0 q0 1.6 -2.2 1.6 q-2.2 0 -2.2 -1.6 Z" fill="#141414" />
  </g>
);

/**
 * Clawd (Claude Code's mascot) cycling through little scenes: playing with
 * the owl, a coffee break, and coding on the laptop. Work states pin the laptop.
 */
export const DeskScene = ({ className, state }: { className?: string; state: SceneState }) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick(0);
    const id = window.setInterval(() => setTick((t) => t + 1), state === "idle" ? IDLE_MS : 3200);
    return () => window.clearInterval(id);
  }, [state]);

  const vignette: Vignette =
    state === "searching" || state === "writing"
      ? "laptop"
      : state === "done"
        ? "owl"
        : state === "error"
          ? "coffee"
          : IDLE_ORDER[tick % IDLE_ORDER.length];

  const lines = state === "idle" ? LINES[vignette] : LINES[state];
  const line = lines[(state === "idle" ? Math.floor(tick / IDLE_ORDER.length) : tick) % lines.length];
  const on = (v: Vignette) => vignette === v || undefined;

  return (
    <div className={cn("pf-scene relative select-none", className)} data-state={state} data-vignette={vignette}>
      <p
        className="font-claude-code pf-bubble text-claude-code-muted absolute bottom-0 left-0 z-10 max-w-full truncate text-[0.6875rem]"
        key={line}
      >
        <span className="text-claude-code-accent">✻</span> {line}
      </p>
      <svg
        aria-label="Clawd, la mascota de Claude Code, jugando con su búho, tomando café o programando en su laptop"
        className="block h-auto w-full overflow-visible"
        role="img"
        viewBox="0 0 200 112"
      >
        <defs>
          <radialGradient id="pf-fur" cx="0.38" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.65" stopColor="#f2f2ef" />
            <stop offset="1" stopColor="#d3d3ce" />
          </radialGradient>
          <pattern height="3.2" id="pf-stripes" patternTransform="rotate(12)" patternUnits="userSpaceOnUse" width="3.2">
            <rect fill={SCARF.maroon} height="3.2" width="1.6" />
            <rect fill={SCARF.gold} height="3.2" width="1.6" x="1.6" />
          </pattern>
          <pattern height="2.6" id="pf-stripes-v" patternUnits="userSpaceOnUse" width="3">
            <rect fill={SCARF.gold} height="1.3" width="3" />
            <rect fill={SCARF.maroon} height="1.3" width="3" y="1.3" />
          </pattern>
        </defs>

        {/* ground */}
        <path d="M8 104.5 H192" stroke="#ffffff" strokeDasharray="1 3" strokeOpacity="0.12" />
        <ellipse className="pf-shadow" cx="54" cy="105" fill="#000" opacity="0.4" rx="30" ry="2.4" />

        {/* ── Owl: Clawd waves, the owl loops around and lands on its head ── */}
        <g className="pf-v pf-v-owl" data-on={on("owl")}>
          <g className="pf-clawd-hop">
            <ClawdStage>
              <Clawd pose="stand" rightArm="pf-wave" />
            </ClawdStage>
          </g>
          <ellipse className="pf-owl-shadow" cx="130" cy="105" fill="#000" opacity="0.35" rx="8" ry="1.4" />
          <g transform="translate(130 44)">
            <g className="pf-owl-fly">
              <Owl />
            </g>
          </g>
          <g className="pf-sparkles" fill="#fbbf24">
            <path d="M40 46 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" />
            <path d="M180 24 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3 z" style={{ animationDelay: "0.25s" }} />
            <path d="M128 20 l1.3 3.2 3.2 1.3 -3.2 1.3 -1.3 3.2 -1.3 -3.2 -3.2 -1.3 3.2 -1.3 z" style={{ animationDelay: "0.5s" }} />
          </g>
        </g>

        {/* ── Coffee: Clawd sits, lifts the mug to sip, ^ ^ ── */}
        <g className="pf-v pf-v-coffee" data-on={on("coffee")}>
          <ClawdStage>
            <Clawd pose="sit">
              {(by) => (
                <g className="pf-mug" shapeRendering="crispEdges">
                  <g className="pf-steam-group" fill="#c8c1b6">
                    <Px className="pf-steam" h={0.8} w={0.45} x={11.3} y={by + 1.3} />
                    <Px className="pf-steam pf-steam-2" h={0.8} w={0.45} x={12.2} y={by + 1.1} />
                  </g>
                  <Px fill="#f5f0e8" h={2.4} w={2.2} x={10.9} y={by + 2.5} />
                  <Px fill="#f5f0e8" h={1.2} w={0.6} x={13.1} y={by + 3} />
                  <Px fill="#6f4e37" h={0.45} w={2.2} x={10.9} y={by + 2.5} />
                  <Px fill="#e06443" h={0.45} w={2.2} x={10.9} y={by + 3.7} />
                </g>
              )}
            </Clawd>
          </ClawdStage>
          <text className="pf-heart" fill="#f472b6" fontSize="9" x="74" y="56">♥</text>
        </g>

        {/* ── Laptop: Clawd types on a laptop showing Claude Code ── */}
        <g className="pf-v pf-v-laptop" data-on={on("laptop")}>
          <ellipse cx="150" cy="105" fill="#000" opacity="0.4" rx="48" ry="2.2" />
          <g className="pf-laptop">
            {/* lid + screen */}
            <rect fill="#2b2b30" height="56" rx="3" stroke="#45454d" strokeWidth="0.6" width="90" x="105" y="42" />
            <rect fill="#0d0d0f" height="50" rx="1.5" width="84" x="108" y="45" />
            <circle cx="150" cy="43.5" fill="#111" r="0.6" />
            <ClaudeCodeScreen active={vignette === "laptop"} state={state} />
            {/* keyboard deck */}
            <path d="M103 98 H197 L200 104.5 H100 Z" fill="#3b3b42" />
            <path d="M103 98 H197" stroke="#62626c" strokeWidth="0.5" />
            <rect fill="#2a2a30" height="1.2" rx="0.6" width="22" x="139" y="102" />
          </g>
          <g>
            <ClawdStage>
              <Clawd leftArm="pf-tap" pose="sit" rightArm="pf-tap pf-tap-2" />
            </ClawdStage>
          </g>
          {/* arm reaching the keyboard */}
          <rect className="pf-type" fill={ORANGE} height="6" shapeRendering="crispEdges" width="24" x="83" y="75" />
        </g>
      </svg>
    </div>
  );
};
