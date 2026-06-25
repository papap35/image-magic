"use client";

import { useEffect, useState, type FormEvent } from "react";

interface PromptField {
  id: string;
  key: string;
  value: string;
  order: number;
}

export default function PromptFieldsPage({ params }: { params: { id: string } }) {
  const stylePresetId = params.id;

  const [fields, setFields] = useState<PromptField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadFields() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/style-presets/${stylePresetId}/fields`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "載入失敗");
      }
      setFields(data.fields);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFields();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stylePresetId]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/style-presets/${stylePresetId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, order: fields.length }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "新增失敗");
      }
      setKey("");
      setValue("");
      await loadFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(fieldId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/style-presets/${stylePresetId}/fields/${fieldId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "刪除失敗");
      }
      await loadFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= fields.length) {
      return;
    }
    const current = fields[index];
    const target = fields[targetIndex];
    setError(null);
    try {
      await Promise.all([
        fetch(`/api/style-presets/${stylePresetId}/fields/${current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: target.order }),
        }),
        fetch(`/api/style-presets/${stylePresetId}/fields/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: current.order }),
        }),
      ]);
      await loadFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : "排序失敗");
    }
  }

  if (notFound) {
    return (
      <main>
        <h1>動態欄位</h1>
        <p>找不到這個風格指令。</p>
      </main>
    );
  }

  return (
    <main>
      <h1>動態欄位</h1>
      <p>在基礎風格之外，新增任意數量的 key:value 描述欄位，依順序串接進最終 prompt。</p>
      {error && <p role="alert">{error}</p>}

      <form onSubmit={handleAdd}>
        <div>
          <label htmlFor="field-key">Key</label>
          <input id="field-key" value={key} onChange={(e) => setKey(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="field-value">Value</label>
          <input id="field-value" value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
        <button type="submit" disabled={saving}>
          新增欄位
        </button>
      </form>

      {loading ? (
        <p>載入中...</p>
      ) : fields.length === 0 ? (
        <p>尚未新增任何欄位。</p>
      ) : (
        <ol>
          {fields.map((field, index) => (
            <li key={field.id}>
              <strong>{field.key}</strong>: {field.value}
              <button type="button" onClick={() => handleMove(index, -1)} disabled={index === 0}>
                上移
              </button>
              <button type="button" onClick={() => handleMove(index, 1)} disabled={index === fields.length - 1}>
                下移
              </button>
              <button type="button" onClick={() => handleDelete(field.id)}>
                刪除
              </button>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
