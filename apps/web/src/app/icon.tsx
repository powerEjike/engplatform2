import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(145deg, #0d3564, #031b37)",
          borderRadius: 14,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        <div style={{ background: "#ff6b20", height: 32, left: 18, position: "absolute", top: 19, width: 7 }} />
        <div style={{ color: "white", fontFamily: "Arial", fontSize: 43, fontWeight: 800, lineHeight: 1, marginLeft: 7 }}>B</div>
      </div>
    ),
    size
  );
}
