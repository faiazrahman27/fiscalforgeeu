import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Invoice Lantern",
    short_name: "Lantern",
    description:
      "Independent e-invoice validation and ViDA-readiness sandbox for technical, educational, non-official review workflows.",
    start_url: "/workspace",
    scope: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#0f172a",
    categories: ["business", "finance", "productivity", "utilities"],
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
