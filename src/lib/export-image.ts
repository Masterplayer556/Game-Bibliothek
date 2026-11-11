// Saves a card as PNG: shares it where the phone supports it, otherwise downloads it.
import { toPng } from "html-to-image";

export async function exportCard(node: HTMLElement, fileName: string): Promise<"shared" | "downloaded"> {
  const background = getComputedStyle(document.body).backgroundColor;
  // 3× the CSS size: a 360×640 card becomes 1080×1920, the size of a story.
  const dataUrl = await toPng(node, { pixelRatio: 3, backgroundColor: background, cacheBust: true });
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], fileName, { type: "image/png" });

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return "shared";
    } catch (error) {
      // Closing the share sheet is not an error worth reporting; fall back to a download.
      if (error instanceof DOMException && error.name === "AbortError") return "shared";
    }
  }
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
  return "downloaded";
}
