"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Spinner } from "@/components/Spinner";
import { ImageTagEditor } from "@/components/ImageTagEditor";

interface ImageDetail {
  id: string;
  title: string | null;
  description: string | null;
  driveFileId: string | null;
  driveViewUrl: string | null;
  createdAt: string;
}

interface Tag {
  id: string;
  name: string;
}

export default function ImageDetailPage() {
  const params = useParams<{ id: string }>();
  const imageId = params.id;

  const [image, setImage] = useState<ImageDetail | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [imageRes, tagsRes] = await Promise.all([fetch(`/api/images/${imageId}`), fetch("/api/tags")]);
        const imageData = await imageRes.json();
        const tagsData = await tagsRes.json();
        if (!imageRes.ok) {
          throw new Error(imageData?.error?.message ?? "載入圖片失敗");
        }
        if (!tagsRes.ok) {
          throw new Error(tagsData?.error?.message ?? "載入標籤失敗");
        }
        setImage(imageData.image);
        setTitle(imageData.image.title ?? "");
        setDescription(imageData.image.description ?? "");
        setAllTags(tagsData.tags);
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入失敗");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [imageId]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/images/${imageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "儲存失敗");
      }
      setImage(data.image);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main>
        <Spinner label="載入圖片中..." />
      </main>
    );
  }

  if (error || !image) {
    return (
      <main>
        <p role="alert">{error ?? "圖片不存在"}</p>
        <Link href="/app/images">回圖庫</Link>
      </main>
    );
  }

  return (
    <main>
      <Link href="/app/images">← 回圖庫</Link>
      <h1>{image.title ?? "（未命名）"}</h1>

      {image.driveFileId && (
        <div className="detail-image-wrap">
          <img src={`/api/images/${image.id}/content`} alt={image.title ?? ""} />
        </div>
      )}

      <div className="button-row">
        {image.driveFileId && (
          <a href={`/api/images/${image.id}/content`} download className="secondary">
            下載原始圖片
          </a>
        )}
        {image.driveViewUrl && (
          <a href={image.driveViewUrl} target="_blank" rel="noreferrer" className="secondary">
            在 Google Drive 開啟
          </a>
        )}
      </div>

      <form onSubmit={handleSave} className="card">
        <div className="field">
          <label htmlFor="title">標題</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="幫這張圖取個名字" />
        </div>
        <div className="field">
          <label htmlFor="description">敘述</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="補充說明這張圖的內容"
          />
        </div>
        {saveError && <p role="alert">{saveError}</p>}
        <button type="submit" disabled={saving}>
          {saving ? "儲存中..." : "儲存"}
        </button>
      </form>

      <div className="card">
        <h2>標籤</h2>
        <ImageTagEditor imageId={image.id} allTags={allTags} />
      </div>
    </main>
  );
}
