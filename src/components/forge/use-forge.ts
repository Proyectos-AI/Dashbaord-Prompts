"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ForgeEvent } from "@/app/api/forge/route";
import { SPINNER_VERBS, type Attachment } from "@/lib/catalog";

export interface ForgeSearch {
  id: string;
  kind: "search" | "fetch";
  query: string;
  results?: { title: string; url: string; age: string | null }[];
  error?: string;
}

export type ForgeRunStatus = "working" | "done" | "error" | "interrupted";

export interface ForgeRun {
  id: string;
  prompt: string;
  refining: boolean;
  files: string[];
  target: string;
  effort: string;
  status: ForgeRunStatus;
  thinking: string;
  searches: ForgeSearch[];
  text: string;
  error?: string;
  startedAt: number;
  durationMs?: number;
  tokens?: number;
  verb: string;
}

export interface ForgeParams {
  prompt: string;
  provider: string;
  model: string;
  customModel?: string;
  effort: string;
  task: string;
  previous?: string;
  attachments: Attachment[];
  target: string;
}

export const useForge = () => {
  const [runs, setRuns] = useState<ForgeRun[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const busy = runs.some((run) => run.status === "working");

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [busy]);

  const patch = useCallback(
    (id: string, update: (run: ForgeRun) => Partial<ForgeRun>) =>
      setRuns((current) =>
        current.map((run) => (run.id === id ? { ...run, ...update(run) } : run))
      ),
    []
  );

  const forge = useCallback(
    async ({ target, ...params }: ForgeParams) => {
      const id = crypto.randomUUID();
      const startedAt = Date.now();
      const controller = new AbortController();
      abortRef.current = controller;
      setNow(startedAt);
      setRuns((current) => [
        ...current,
        {
          id,
          prompt: params.prompt,
          refining: Boolean(params.previous),
          files: params.attachments.map((file) => file.name),
          target,
          effort: params.effort,
          status: "working",
          thinking: "",
          searches: [],
          text: "",
          startedAt,
          verb: SPINNER_VERBS[Math.floor(Math.random() * SPINNER_VERBS.length)],
        },
      ]);

      const finish = (update: Partial<ForgeRun>) =>
        patch(id, () => ({ durationMs: Date.now() - startedAt, ...update }));

      try {
        const response = await fetch("/api/forge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const data = await response.json().catch(() => ({}));
          finish({
            status: "error",
            error: data.error ?? `Error ${response.status}`,
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let ended = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as ForgeEvent;
            switch (event.type) {
              case "thinking":
                patch(id, (run) => ({ thinking: run.thinking + event.delta }));
                break;
              case "text":
                patch(id, (run) => ({ text: run.text + event.delta }));
                break;
              case "tool":
                patch(id, (run) => ({
                  searches: [
                    ...run.searches.filter((s) => s.id !== event.id),
                    {
                      ...run.searches.find((s) => s.id === event.id),
                      id: event.id,
                      kind: event.kind,
                      query: event.arg,
                    },
                  ],
                }));
                break;
              case "results":
                patch(id, (run) => {
                  const known = run.searches.some((s) => s.id === event.id);
                  const update = { results: event.items, error: event.error };
                  return {
                    searches: known
                      ? run.searches.map((s) =>
                          s.id === event.id ? { ...s, ...update } : s
                        )
                      : [
                          ...run.searches,
                          { id: event.id, kind: "search", query: "", ...update },
                        ],
                  };
                });
                break;
              case "done":
                ended = true;
                finish({
                  status: "done",
                  tokens: event.inputTokens + event.outputTokens,
                });
                break;
              case "error":
                ended = true;
                finish({ status: "error", error: event.message });
                break;
            }
          }
        }
        if (!ended) {
          finish({ status: "error", error: "La conexión se cortó a mitad." });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          finish({ status: "interrupted" });
        } else {
          finish({
            status: "error",
            error: error instanceof Error ? error.message : "Error de red.",
          });
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [patch]
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const clear = useCallback(() => {
    abortRef.current?.abort();
    setRuns([]);
  }, []);

  return { runs, busy, now, forge, stop, clear };
};
