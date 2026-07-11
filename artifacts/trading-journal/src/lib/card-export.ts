/**
 * Shared PNG-capture helpers for the "stats card" export flow.
 * Used by both the single "Download Statistics Card" button (Stats page)
 * and the bulk "Download Year" ZIP export (Archive page) — keep both in
 * sync by editing this file rather than duplicating capture logic.
 */
import domtoimage from "dom-to-image-more";

/** Zero out every inline letter-spacing inside `root`; returns a restore fn. */
export function stripLetterSpacing(root: HTMLElement): () => void {
  const saved: Array<[HTMLElement, string]> = [];
  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if (el.style.letterSpacing) {
      saved.push([el, el.style.letterSpacing]);
      el.style.letterSpacing = "normal";
    }
  });
  return () => saved.forEach(([el, v]) => { el.style.letterSpacing = v; });
}

/**
 * Captures `node` as a PNG data-URL at the given logical width + scale.
 * `bgColor` should be the theme's `pageBg` so transparent edges render correctly.
 */
export async function captureCardPng(
  node: HTMLElement,
  bgColor: string,
  logicalWidth: number,
  scale: number,
): Promise<string> {
  const origWidth    = node.style.width;
  const origMaxWidth = node.style.maxWidth;

  node.style.width    = `${logicalWidth}px`;
  node.style.maxWidth = "none";
  node.style.setProperty("-webkit-font-smoothing", "antialiased");
  node.style.setProperty("-moz-osx-font-smoothing", "grayscale");

  const restoreLetterSpacing = stripLetterSpacing(node);

  // Reflow happens when we read scroll dimensions
  const w = node.scrollWidth;
  const h = node.scrollHeight;

  try {
    return await domtoimage.toPng(node, {
      bgcolor: bgColor,
      width:   w,
      height:  h,
      scale,
      ignoreCSSRuleErrors: true,
      onImageError: (info: unknown) => console.warn("[dom-to-image-more] resource failed:", info),
    });
  } finally {
    restoreLetterSpacing();
    node.style.width    = origWidth;
    node.style.maxWidth = origMaxWidth;
    node.style.removeProperty("-webkit-font-smoothing");
    node.style.removeProperty("-moz-osx-font-smoothing");
  }
}

/** Converts a PNG data-URL to a Blob (for bundling into a ZIP). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta?.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const bin = atob(b64 ?? "");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function triggerDownload(dataUrlOrBlob: string | Blob, filename: string) {
  const url = typeof dataUrlOrBlob === "string" ? dataUrlOrBlob : URL.createObjectURL(dataUrlOrBlob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof dataUrlOrBlob !== "string") URL.revokeObjectURL(url);
}
