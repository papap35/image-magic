"use client";

import { useEffect, useState, type FormEvent } from "react";
import { buildFinalPrompt, type PromptFieldInput } from "@/lib/prompt";

interface StylePreset {
  id: string;
  name: string;
  basePrompt: string;
}

interface PromptField {
  id: string;
  key: string;
  value: string;
}

interface GenerationJob {
  id: string;
  provider: string;
  promptFinal: string;
  status: "pending" | "success" | "failed";
  resultUrl: string | null;
  error: string | null;
  createdAt: string;
}

const PROVIDER = "openai";

export default function GeneratePage() {
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [presetId, setPresetId] = useState("");
  const [templateFields, setTemplateFields] = useState<PromptField[]>([]);

  const [extraFields, setExtraFields] = useState<PromptFieldInput[]>([]);
  const [extraKey, setExtraKey] = useState("");
  const [extraValue, setExtraValue] = useState("");

  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPresets() {
    const res = await fetch("/api/style-presets");
    const data = await res.json();
    if (res.ok) {
      setPresets(data.presets);
    }
  }

  async function loadJobs() {
    const res = await fetch("/api/generation-jobs");
    const data = await res.json();
    if (res.ok) {
      setJobs(data.jobs);
    }
  }

  useEffect(() => {
    loadPresets();
    loadJobs();
  }, []);

  useEffect(() => {
    if (!presetId) {
      setTemplateFields([]);
      return;
    }
    fetch(`/api/style-presets/${presetId}/fields`)
      .then((res) => res.json())
      .then((data) => setTemplateFields(data.fields ?? []));
  }, [presetId]);

  const basePrompt = presets.find((p) => p.id === presetId)?.basePrompt ?? "";
  const allFields: PromptFieldInput[] = [...templateFields, ...extraFields];
  const finalPrompt = buildFinalPrompt(basePrompt, allFields);

  function addExtraField() {
    if (!extraKey.trim() || !extraValue.trim()) {
      return;
    }
    setExtraFields((prev) => [...prev, { key: extraKey, value: extraValue }]);
    setExtraKey("");
    setExtraValue("");
  }

  function removeExtraField(index: number) {
    setExtraFields((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!finalPrompt.trim()) {
      setError("最終 prompt 不能是空的");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/generation-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: PROVIDER, promptFinal: finalPrompt }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 502) {
        throw new Error(data?.error?.message ?? "建立生成請求失敗");
      }
      if (data.job?.status === "failed") {
        setError(data.job.error ?? "生成失敗");
      }
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立生成請求失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>產生圖片</h1>
      {error && <p role="alert">{error}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="preset-select">套用風格指令（選填）</label>
          <select id="preset-select" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            <option value="">不套用</option>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>

        {templateFields.length > 0 && (
          <div>
            <p>模板欄位（依風格指令固定帶入）：</p>
            <ul>
              {templateFields.map((field) => (
                <li key={field.id}>
                  {field.key}: {field.value}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p>一次性欄位（僅本次使用，不會儲存）：</p>
          <ul>
            {extraFields.map((field, index) => (
              <li key={`${field.key}-${index}`}>
                {field.key}: {field.value}
                <button type="button" onClick={() => removeExtraField(index)}>
                  移除
                </button>
              </li>
            ))}
          </ul>
          <input
            value={extraKey}
            onChange={(e) => setExtraKey(e.target.value)}
            placeholder="key（例如：主體）"
          />
          <input
            value={extraValue}
            onChange={(e) => setExtraValue(e.target.value)}
            placeholder="value（例如：一隻貓）"
          />
          <button type="button" onClick={addExtraField}>
            新增一次性欄位
          </button>
        </div>

        <div>
          <p>最終 Prompt 預覽：</p>
          <p>{finalPrompt || "（尚未輸入任何內容）"}</p>
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "生成中..." : "開始生成"}
        </button>
      </form>

      <h2>生成紀錄</h2>
      {jobs.length === 0 ? (
        <p>尚未有任何生成請求。</p>
      ) : (
        <ul>
          {jobs.map((job) => (
            <li key={job.id}>
              <p>狀態：{job.status}</p>
              <p>Prompt：{job.promptFinal}</p>
              {job.status === "success" && job.resultUrl && (
                <img src={job.resultUrl} alt={job.promptFinal} width={160} />
              )}
              {job.status === "failed" && <p role="alert">錯誤：{job.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
