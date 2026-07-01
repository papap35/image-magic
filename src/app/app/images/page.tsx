"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";

interface ImageItem {
  id: string;
  title: string | null;
  driveFileId: string | null;
}

export default function ImagesPage() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/images");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "載入圖片失敗");
      }
      setImages(data.images);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/images/${confirmDeleteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "刪除失敗");
      }
      setImages((prev) => prev.filter((img) => img.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setDeleting(false);
    }
  }

  const confirmTarget = images.find((img) => img.id === confirmDeleteId);

  return (
    <main>
      <h1>我的圖庫</h1>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <Spinner label="載入圖庫中..." />
      ) : images.length === 0 ? (
        <p>尚未有任何圖片。</p>
      ) : (
        <ul className="gallery-grid">
          {images.map((image) => (
            <li className="gallery-grid-item" key={image.id}>
              <Link href={`/app/images/${image.id}`}>
                <div className="gallery-thumb-wrap">
                  {image.driveFileId && (
                    <img src={`/api/images/${image.id}/content`} alt={image.title ?? ""} loading="lazy" />
                  )}
                </div>
                <div className="gallery-caption">{image.title ?? "（未命名）"}</div>
              </Link>
              <button
                type="button"
                className="icon-button gallery-delete-btn"
                aria-label="刪除圖片"
                title="刪除圖片"
                onClick={() => setConfirmDeleteId(image.id)}
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirmDeleteId && (
        <div className="lightbox-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="lightbox-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setConfirmDeleteId(null)} aria-label="取消">✕</button>
            <h2>確認刪除</h2>
            <p>
              確定要刪除「{confirmTarget?.title ?? "（未命名）"}」嗎？<br />
              圖片將從 Google Drive 和圖庫中一併刪除，此操作無法復原。
            </p>
            <div className="confirm-modal-actions">
              <button type="button" onClick={() => setConfirmDeleteId(null)}>取消</button>
              <button type="button" className="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "刪除中..." : "確認刪除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
