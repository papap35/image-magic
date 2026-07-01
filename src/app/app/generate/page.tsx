"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { buildFinalPrompt, type PromptFieldInput } from "@/lib/prompt";
import { GeneratingPlaceholder } from "@/components/GeneratingPlaceholder";
import { Spinner } from "@/components/Spinner";

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
  model: string | null;
  promptFinal: string;
  status: "pending" | "success" | "failed";
  resultUrl: string | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ProviderOption {
  id: string;
  label: string;
  authMode: "shared-password" | "byok";
  defaultModel: string;
  modelOptions: string[];
}

const CUSTOM_MODEL_VALUE = "__custom__";

// A reverse proxy or the host platform can reject a request before it
// reaches our API route (e.g. 413 "Request Entity Too Large" for an
// oversized reference image) and respond with a plain-text/HTML body
// instead of JSON. Blindly calling res.json() on that throws a confusing
// "Unexpected token" SyntaxError, so read the body as text first and only
// parse it as JSON if it looks like JSON.
async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`伺服器回應非預期格式 (${res.status})：${text.slice(0, 200)}`);
  }
}

export default function GeneratePage() {
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [presetId, setPresetId] = useState(() => (typeof window !== "undefined" ? (localStorage.getItem("generate:presetId") ?? "") : ""));
  const [templateFields, setTemplateFields] = useState<PromptField[]>([]);

  const [extraFields, setExtraFields] = useState<PromptFieldInput[]>([]);
  const [extraKey, setExtraKey] = useState("");
  const [extraValue, setExtraValue] = useState("");

  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [providerId, setProviderId] = useState(() => (typeof window !== "undefined" ? (localStorage.getItem("generate:providerId") ?? "") : ""));
  const [savedProviders, setSavedProviders] = useState<string[]>([]);
  const [byokKeyInput, setByokKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [deletingKey, setDeletingKey] = useState(false);
  const [confirmingDeleteKey, setConfirmingDeleteKey] = useState(false);
  const [savedModels, setSavedModels] = useState<Record<string, string | null>>({});
  const [modelSelect, setModelSelect] = useState("");
  const [customModelInput, setCustomModelInput] = useState("");
  const [savingModel, setSavingModel] = useState(false);

  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [enhancePassword, setEnhancePassword] = useState("");

  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [referenceImage, setReferenceImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string | null>(null);

  async function loadPresets() {
    const res = await fetch("/api/style-presets");
    const data = await parseJsonResponse(res);
    if (res.ok) {
      setPresets(data.presets);
    }
  }

  async function loadJobs() {
    const res = await fetch("/api/generation-jobs");
    const data = await parseJsonResponse(res);
    if (res.ok) {
      setJobs(data.jobs);
    }
  }

  async function loadProviders() {
    const res = await fetch("/api/providers");
    const data = await parseJsonResponse(res);
    if (res.ok) {
      setProviders(data.providers);
      if (data.providers.length > 0) {
        setProviderId((current) => current || data.providers[0].id);
      }
    }
  }

  async function loadSavedProviders() {
    const res = await fetch("/api/provider-keys");
    const data = await parseJsonResponse(res);
    if (res.ok) {
      setSavedProviders(data.savedProviders);
      setSavedModels(data.models ?? {});
    }
  }

  useEffect(() => {
    Promise.all([loadPresets(), loadJobs(), loadProviders(), loadSavedProviders()]).finally(() => {
      setPageLoading(false);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem("generate:providerId", providerId);
  }, [providerId]);

  useEffect(() => {
    localStorage.setItem("generate:presetId", presetId);
  }, [presetId]);

  useEffect(() => {
    if (!presetId) {
      setTemplateFields([]);
      return;
    }
    fetch(`/api/style-presets/${presetId}/fields`)
      .then((res) => parseJsonResponse(res))
      .then((data) => setTemplateFields(data.fields ?? []));
  }, [presetId]);

  // Clear the stored presetId if the preset no longer exists after loading.
  useEffect(() => {
    if (presets.length > 0 && presetId && !presets.find((p) => p.id === presetId)) {
      setPresetId("");
    }
  }, [presets, presetId]);

  // The generation request is a single blocking fetch with no incremental
  // progress from the provider — this timer is purely so the button shows
  // elapsed time instead of looking stuck on a static "生成中..." label.
  useEffect(() => {
    if (!submitting) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [submitting]);

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

  function handleReferenceImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setReferenceImage(null);
      setReferenceImagePreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [, base64] = dataUrl.split(",");
      setReferenceImage({ base64, mimeType: file.type });
      setReferenceImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function removeReferenceImage() {
    setReferenceImage(null);
    setReferenceImagePreview(null);
  }

  const selectedProvider = providers.find((p) => p.id === providerId);
  const hasSavedKey = savedProviders.includes(providerId);

  useEffect(() => {
    if (!selectedProvider) {
      return;
    }
    const savedModel = savedModels[providerId];
    if (savedModel && selectedProvider.modelOptions.includes(savedModel)) {
      setModelSelect(savedModel);
      setCustomModelInput("");
    } else if (savedModel) {
      setModelSelect(CUSTOM_MODEL_VALUE);
      setCustomModelInput(savedModel);
    } else {
      setModelSelect(selectedProvider.defaultModel);
      setCustomModelInput("");
    }
  }, [providerId, selectedProvider, savedModels]);

  async function handleSaveModel() {
    const model = modelSelect === CUSTOM_MODEL_VALUE ? customModelInput.trim() : modelSelect;
    setSavingModel(true);
    setError(null);
    try {
      const res = await fetch(`/api/provider-keys/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: model || null }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "儲存模型設定失敗");
      }
      await loadSavedProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存模型設定失敗");
    } finally {
      setSavingModel(false);
    }
  }

  async function handleSaveKey() {
    if (!byokKeyInput.trim()) {
      return;
    }
    setSavingKey(true);
    setError(null);
    try {
      const res = await fetch("/api/provider-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: providerId, apiKey: byokKeyInput.trim() }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "儲存 API Key 失敗");
      }
      setByokKeyInput("");
      setEditingKey(false);
      await loadSavedProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存 API Key 失敗");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleDeleteKey() {
    setDeletingKey(true);
    setError(null);
    try {
      const res = await fetch(`/api/provider-keys/${providerId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await parseJsonResponse(res).catch(() => null);
        throw new Error(data?.error?.message ?? "清空 API Key 失敗");
      }
      setEditingKey(false);
      await loadSavedProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空 API Key 失敗");
    } finally {
      setDeletingKey(false);
      setConfirmingDeleteKey(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!finalPrompt.trim()) {
      setError("最終 prompt 不能是空的");
      return;
    }
    if (!hasSavedKey) {
      setError("此 provider 需要先儲存你自己的 API Key");
      return;
    }
    if (enhancePrompt && !enhancePassword.trim()) {
      setError("使用 Claude 改寫 prompt 需要輸入共用密碼");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/generation-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          promptFinal: finalPrompt,
          enhancePrompt,
          password: enhancePrompt ? enhancePassword : undefined,
          referenceImage: referenceImage ?? undefined,
        }),
      });
      const data = await parseJsonResponse(res);
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

      {pageLoading ? (
        <Spinner label="載入中..." />
      ) : (
      <>
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="field">
            <label htmlFor="provider-select">AI Provider</label>
            <select
              id="provider-select"
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                setEditingKey(false);
                setByokKeyInput("");
              }}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>

          {selectedProvider && (
            <div>
              {hasSavedKey && !editingKey ? (
                <div className="field">
                  <p className="hint">已儲存此 provider 的 API Key。</p>
                  <div className="button-row">
                    <button type="button" className="secondary" onClick={() => setEditingKey(true)}>
                      更換 API Key
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => setConfirmingDeleteKey(true)}
                      disabled={deletingKey}
                    >
                      {deletingKey ? "清空中..." : "清空 API Key"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="provider-api-key">
                    {selectedProvider.id === "comfyui" ? "你的 ComfyUI 伺服器網址" : `你的 ${selectedProvider.label} API Key`}
                  </label>
                  {selectedProvider.id === "comfyui" && (
                    <p className="hint">
                      ComfyUI 沒有 API Key，這裡請填伺服器網址（例如
                      http://192.168.1.50:8188）。本網站的伺服器要能連到這個網址才能生成圖片
                      ——同一台機器、同一個區域網路，或是透過 VPN／Tunnel 對外開放都可以。
                    </p>
                  )}
                  <input
                    id="provider-api-key"
                    type={selectedProvider.id === "comfyui" ? "text" : "password"}
                    value={byokKeyInput}
                    onChange={(e) => setByokKeyInput(e.target.value)}
                    placeholder={selectedProvider.id === "comfyui" ? "http://192.168.1.50:8188" : "輸入你自己的 API Key"}
                  />
                  <div className="button-row">
                    <button type="button" onClick={handleSaveKey} disabled={savingKey}>
                      {savingKey ? "儲存中..." : "儲存 API Key"}
                    </button>
                    {hasSavedKey && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          setEditingKey(false);
                          setByokKeyInput("");
                        }}
                      >
                        取消
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedProvider && hasSavedKey && (
          <div className="card">
            <div className="field">
              <label htmlFor="model-select">使用的模型</label>
              {selectedProvider.id === "comfyui" && (
                <p className="hint">
                  這裡填的是 checkpoint 檔名，必須跟你 ComfyUI `models/checkpoints`
                  資料夾裡的檔名完全一致（例如 flux1-dev.safetensors）。
                </p>
              )}
              <select id="model-select" value={modelSelect} onChange={(e) => setModelSelect(e.target.value)}>
                {selectedProvider.modelOptions.map((model) => (
                  <option key={model} value={model}>
                    {model}
                    {model === selectedProvider.defaultModel ? "（預設）" : ""}
                  </option>
                ))}
                <option value={CUSTOM_MODEL_VALUE}>自訂...</option>
              </select>
              {modelSelect === CUSTOM_MODEL_VALUE && (
                <input
                  style={{ marginTop: 8 }}
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder="輸入自訂模型 id，例如 stabilityai/stable-diffusion-2"
                />
              )}
              <p className="hint">
                provider 更新可用模型清單時，可以在這裡直接切換或填入新的模型 id，不需要每次都改程式碼。
              </p>
              <div className="button-row">
                <button type="button" onClick={handleSaveModel} disabled={savingModel}>
                  {savingModel ? "儲存中..." : "儲存模型設定"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <label className="checkbox-label" htmlFor="enhance-prompt-checkbox">
            <input
              id="enhance-prompt-checkbox"
              type="checkbox"
              checked={enhancePrompt}
              onChange={(e) => setEnhancePrompt(e.target.checked)}
            />
            出圖前先用 Claude 改寫 prompt（讓描述更生動詳細；Claude 本身不出圖，只負責改寫文字）
          </label>
          {enhancePrompt && (
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="enhance-password">共用密碼</label>
              <input
                id="enhance-password"
                type="password"
                value={enhancePassword}
                onChange={(e) => setEnhancePassword(e.target.value)}
                placeholder="輸入共用密碼才能使用 Claude 改寫"
              />
            </div>
          )}
        </div>

        <div className="card">
          <div className="field">
            <label htmlFor="reference-image-input">參考圖片（選填，將用於圖生圖）</label>
            <input
              id="reference-image-input"
              type="file"
              accept="image/*"
              onChange={handleReferenceImageChange}
            />
            <p className="hint">上傳後，生成結果會以這張圖片為基礎，依 prompt 進行調整。</p>
            {referenceImagePreview && (
              <div>
                <img className="thumb" src={referenceImagePreview} alt="參考圖片預覽" width={160} />
                <div className="button-row">
                  <button type="button" className="secondary" onClick={removeReferenceImage}>
                    移除參考圖片
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="field">
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
            <div className="field">
              <label>模板欄位（依風格指令固定帶入）</label>
              {templateFields.map((field) => (
                <span className="tag-pill" key={field.id}>
                  {field.key}: {field.value}
                </span>
              ))}
            </div>
          )}

          <div className="field">
            <label>一次性欄位（僅本次使用，不會儲存）</label>
            <div>
              {extraFields.map((field, index) => (
                <span className="tag-pill" key={`${field.key}-${index}`}>
                  {field.key}: {field.value}
                  <button type="button" onClick={() => removeExtraField(index)}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="button-row">
              <input
                value={extraKey}
                onChange={(e) => setExtraKey(e.target.value)}
                placeholder="key（例如：主體）"
                style={{ flex: 1 }}
              />
              <input
                value={extraValue}
                onChange={(e) => setExtraValue(e.target.value)}
                placeholder="value（例如：一隻貓）"
                style={{ flex: 1 }}
              />
              <button type="button" className="secondary" onClick={addExtraField}>
                新增
              </button>
            </div>
          </div>

          <div className="field">
            <label>最終 Prompt 預覽</label>
            <p className="prompt-preview">{finalPrompt || "（尚未輸入任何內容）"}</p>
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? `生成中... 已等待 ${elapsedSeconds} 秒` : "開始生成"}
          </button>
          {submitting && (
            <>
              <GeneratingPlaceholder elapsedSeconds={elapsedSeconds} />
              <p className="hint">圖片生成通常需要數十秒，請耐心等候，畫面不會卡住。</p>
            </>
          )}
        </div>
      </form>

      <h2>生成紀錄</h2>
      {jobs.length === 0 ? <p>尚未有任何生成請求。</p> : <GenerationJobsTable jobs={jobs} onDeleted={loadJobs} />}
      {confirmingDeleteKey && (
        <ConfirmModal
          title="確認清空 API Key？"
          message={`此操作無法復原，清空後需要重新輸入「${selectedProvider?.label ?? providerId}」的 API Key 才能繼續生成。`}
          confirmLabel={deletingKey ? "清空中..." : "確認清空"}
          confirming={deletingKey}
          onCancel={() => setConfirmingDeleteKey(false)}
          onConfirm={handleDeleteKey}
        />
      )}
      </>
      )}
    </main>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirming,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="lightbox-overlay" onClick={onCancel}>
      <div className="prompt-modal" onClick={(event) => event.stopPropagation()}>
        <div className="prompt-modal-header">
          <strong>{title}</strong>
          <button type="button" className="lightbox-close" onClick={onCancel} aria-label="關閉">
            ✕
          </button>
        </div>
        <p className="prompt-modal-text">{message}</p>
        <div className="button-row">
          <button type="button" className="secondary" onClick={onCancel} disabled={confirming}>
            取消
          </button>
          <button type="button" className="danger" onClick={onConfirm} disabled={confirming}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

function GenerationJobsTable({ jobs, onDeleted }: { jobs: GenerationJob[]; onDeleted: () => void }) {
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1]);
  const [page, setPage] = useState(1);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [promptModalText, setPromptModalText] = useState<string | null>(null);
  const [errorModalText, setErrorModalText] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GenerationJob | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pageCount = Math.max(1, Math.ceil(jobs.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageJobs = jobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/generation-jobs/${deleteTarget.id}`, { method: "DELETE" });
      onDeleted();
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <>
      <div className="pagination-controls">
        <label>
          每頁顯示
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} 筆
              </option>
            ))}
          </select>
        </label>
        <div className="pagination-pages">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={pageNumber === currentPage ? "secondary active" : "secondary"}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
        </div>
      </div>
      <div className="jobs-table-wrap">
      <table className="jobs-table">
      <thead>
        <tr>
          <th>狀態</th>
          <th>Provider / Model</th>
          <th>Prompt</th>
          <th>結果</th>
          <th>時間</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {pageJobs.map((job) => {
          return (
            <tr key={job.id}>
              <td>
                <span className={`status-badge ${job.status}`}>{job.status}</span>
              </td>
              <td>
                <div>{job.provider}</div>
                {job.model && <div className="hint">{job.model}</div>}
              </td>
              <td>
                <p className="prompt-cell">{job.promptFinal}</p>
                <button type="button" className="secondary" onClick={() => setPromptModalText(job.promptFinal)}>
                  查看完整 Prompt
                </button>
              </td>
              <td>
                {job.status === "success" && job.resultUrl && (
                  <button
                    type="button"
                    className="job-thumb-button"
                    onClick={() => setLightboxUrl(job.resultUrl)}
                    aria-label="放大檢視圖片"
                  >
                    <img className="job-thumb" src={job.resultUrl} alt={job.promptFinal} />
                  </button>
                )}
                {job.status === "failed" && (
                  <>
                    <p role="alert" className="error-cell">錯誤：{job.error}</p>
                    {job.error && (
                      <button type="button" className="secondary" onClick={() => setErrorModalText(job.error)}>
                        查看完整錯誤
                      </button>
                    )}
                    {job.resultUrl && (
                      <>
                        <p className="hint">圖片已生成成功，僅上傳雲端硬碟失敗，可以自行下載：</p>
                        <button
                          type="button"
                          className="job-thumb-button"
                          onClick={() => setLightboxUrl(job.resultUrl)}
                          aria-label="放大檢視圖片"
                        >
                          <img className="job-thumb" src={job.resultUrl} alt={job.promptFinal} />
                        </button>
                        <div>
                          <a href={job.resultUrl} download={`image-magic-${job.id}.png`}>
                            下載圖片
                          </a>
                        </div>
                      </>
                    )}
                  </>
                )}
                {job.status === "pending" && <span className="hint">處理中...</span>}
              </td>
              <td className="hint">
                {new Date(job.createdAt).toLocaleDateString()}
                <br />
                {new Date(job.createdAt).toLocaleTimeString()}
              </td>
              <td>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setDeleteTarget(job)}
                  aria-label="刪除這筆生成紀錄"
                  title="刪除"
                >
                  🗑️
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
      </table>
      </div>
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
      {promptModalText && <PromptModal text={promptModalText} onClose={() => setPromptModalText(null)} />}
      {errorModalText && (
        <PromptModal title="完整錯誤訊息" text={errorModalText} onClose={() => setErrorModalText(null)} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          job={deleteTarget}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}

function DeleteConfirmModal({
  job,
  deleting,
  onCancel,
  onConfirm,
}: {
  job: GenerationJob;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="lightbox-overlay" onClick={onCancel}>
      <div className="prompt-modal" onClick={(event) => event.stopPropagation()}>
        <div className="prompt-modal-header">
          <strong>確認刪除這筆生成紀錄？</strong>
          <button type="button" className="lightbox-close" onClick={onCancel} aria-label="關閉">
            ✕
          </button>
        </div>
        <p className="prompt-modal-text">{job.promptFinal}</p>
        <p role="alert">此操作無法復原，圖片本身（已上傳至 Drive）不會被刪除，僅刪除這筆紀錄。</p>
        <div className="button-row">
          <button type="button" className="secondary" onClick={onCancel} disabled={deleting}>
            取消
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting}>
            {deleting ? "刪除中..." : "確認刪除"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PromptModal({
  title = "完整 Prompt",
  text,
  onClose,
}: {
  title?: string;
  text: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable (e.g. insecure context) — silently ignore
    }
  }

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="prompt-modal" onClick={(event) => event.stopPropagation()}>
        <div className="prompt-modal-header">
          <strong>{title}</strong>
          <button type="button" className="lightbox-close" onClick={onClose} aria-label="關閉">
            ✕
          </button>
        </div>
        <p className="prompt-modal-text">{text}</p>
        <div className="button-row">
          <button type="button" className="secondary" onClick={handleCopy}>
            {copied ? "已複製！" : "複製"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="關閉">
        ✕
      </button>
      <img
        className="lightbox-image"
        src={url}
        alt="放大檢視"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
