"use client";

import { useEffect, useState, type FormEvent } from "react";

interface StylePreset {
  id: string;
  name: string;
  basePrompt: string;
}

export default function StylePresetsPage() {
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadPresets() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/style-presets");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "載入失敗");
      }
      setPresets(data.presets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPresets();
  }, []);

  function startCreate() {
    setEditingId(null);
    setName("");
    setBasePrompt("");
  }

  function startEdit(preset: StylePreset) {
    setEditingId(preset.id);
    setName(preset.name);
    setBasePrompt(preset.basePrompt);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const isEditing = editingId !== null;
      const res = await fetch(isEditing ? `/api/style-presets/${editingId}` : "/api/style-presets", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, basePrompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "儲存失敗");
      }
      startCreate();
      await loadPresets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("確定要刪除這個風格指令嗎？")) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/style-presets/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "刪除失敗");
      }
      if (editingId === id) {
        startCreate();
      }
      await loadPresets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    }
  }

  return (
    <main>
      <h1>風格指令</h1>
      {error && <p role="alert">{error}</p>}

      <form onSubmit={handleSubmit} className="card">
        <h2 style={{ marginTop: 0 }}>{editingId ? "編輯風格指令" : "新增風格指令"}</h2>
        <div className="field">
          <label htmlFor="preset-name">名稱</label>
          <input id="preset-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="preset-base-prompt">基礎 Prompt</label>
          <textarea
            id="preset-base-prompt"
            value={basePrompt}
            onChange={(e) => setBasePrompt(e.target.value)}
            required
          />
        </div>
        <div className="button-row">
          <button type="submit" disabled={saving}>
            {editingId ? "儲存變更" : "新增"}
          </button>
          {editingId && (
            <button type="button" className="secondary" onClick={startCreate} disabled={saving}>
              取消編輯
            </button>
          )}
        </div>
      </form>

      <h2>已建立的風格指令</h2>
      {loading ? (
        <p>載入中...</p>
      ) : presets.length === 0 ? (
        <p>尚未建立任何風格指令。</p>
      ) : (
        <ul className="card-list">
          {presets.map((preset) => (
            <li className="card-list-item" key={preset.id}>
              <strong>{preset.name}</strong>
              <p>{preset.basePrompt}</p>
              <div className="button-row">
                <button type="button" className="secondary" onClick={() => startEdit(preset)}>
                  編輯
                </button>
                <button type="button" className="danger" onClick={() => handleDelete(preset.id)}>
                  刪除
                </button>
                <a href={`/app/style-presets/${preset.id}/fields`}>
                  <button type="button" className="secondary">
                    管理動態欄位
                  </button>
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
