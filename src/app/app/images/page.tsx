"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Spinner } from "@/components/Spinner";

interface ImageItem {
  id: string;
  title: string | null;
  driveFileId: string | null;
}

interface Tag {
  id: string;
  name: string;
}

function ImageTagEditor({ imageId, allTags }: { imageId: string; allTags: Tag[] }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");

  async function loadTags() {
    setLoading(true);
    try {
      const res = await fetch(`/api/images/${imageId}/tags`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "載入標籤失敗");
      }
      setTags(data.tags);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入標籤失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageId]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const name = input.trim();
    if (!name) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/images/${imageId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "新增標籤失敗");
      }
      setInput("");
      await loadTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增標籤失敗");
    }
  }

  async function handleRemove(tagId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/images/${imageId}/tags/${tagId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "移除標籤失敗");
      }
      await loadTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除標籤失敗");
    }
  }

  const suggestions = allTags.filter(
    (tag) => !tags.some((t) => t.id === tag.id) && tag.name.includes(input.trim()) && input.trim().length > 0,
  );

  return (
    <div>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <Spinner label="載入標籤中..." />
      ) : (
        <div>
          {tags.map((tag) => (
            <span className="tag-pill" key={tag.id}>
              {tag.name}
              <button type="button" onClick={() => handleRemove(tag.id)}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={handleAdd} className="button-row" style={{ marginTop: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="新增標籤"
          list={`tag-suggestions-${imageId}`}
          style={{ flex: 1 }}
        />
        <datalist id={`tag-suggestions-${imageId}`}>
          {suggestions.map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
        </datalist>
        <button type="submit" className="secondary">
          新增
        </button>
      </form>
    </div>
  );
}

export default function ImagesPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [imagesRes, tagsRes] = await Promise.all([fetch("/api/images"), fetch("/api/tags")]);
        const imagesData = await imagesRes.json();
        const tagsData = await tagsRes.json();
        if (!imagesRes.ok) {
          throw new Error(imagesData?.error?.message ?? "載入圖片失敗");
        }
        if (!tagsRes.ok) {
          throw new Error(tagsData?.error?.message ?? "載入標籤失敗");
        }
        setImages(imagesData.images);
        setAllTags(tagsData.tags);
      } catch (err) {
        setError(err instanceof Error ? err.message : "載入失敗");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main>
      <h1>我的圖庫</h1>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <Spinner label="載入圖庫中..." />
      ) : images.length === 0 ? (
        <p>尚未有任何圖片。</p>
      ) : (
        <ul className="card-list">
          {images.map((image) => (
            <li className="card-list-item" key={image.id}>
              <strong>{image.title ?? "（未命名）"}</strong>
              {image.driveFileId && (
                <img className="thumb" src={`/api/images/${image.id}/content`} alt={image.title ?? ""} width={160} />
              )}
              <ImageTagEditor imageId={image.id} allTags={allTags} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
