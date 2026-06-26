import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #4f46e5, #a855f7)",
        }}
      >
        <svg width="110" height="110" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z"
            fill="#fff"
          />
          <circle cx="19" cy="5" r="1.6" fill="#fff" fillOpacity={0.85} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
