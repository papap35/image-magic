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

  useEffect(() => {
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
