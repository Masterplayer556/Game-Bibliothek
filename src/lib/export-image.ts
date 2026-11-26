// Saves a card as PNG: shares it where the phone supports it, otherwise downloads it.
import { toPng } from "html-to-image";

const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/** A rendered card, ready to be shared or downloaded. */
export interface CardImage {
  file: File;
  fileName: string;
}

/**
 * «shared» / «downloaded»: done. «needs-tap»: the browser refused to share because making the
 * image took too long after the tap (Safari on iPhone allows sharing only right after a tap):
 * the image is ready, a second tap on «Teilen» shares it (deliverCard again).
 */
export type DeliverResult = "shared" | "downloaded" | "needs-tap";

export async function renderCard(node: HTMLElement, fileName: string): Promise<CardImage> {
  const background = getComputedStyle(document.body).backgroundColor;
  // 3× the CSS size: a 360×640 card becomes 1080×1920, the size of a story.
  const dataUrl = await toPng(node, {
    pixelRatio: 3,
    backgroundColor: background,
    cacheBust: true,
    // A cover whose host refuses the download is left out; the card is still saved.
    imagePlaceholder: EMPTY_IMAGE,
  });
  const blob = await (await fetch(dataUrl)).blob();
  return { file: new File([blob], fileName, { type: "image/png" }), fileName };
}

function canShare(file: File): boolean {
  return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

function download(image: CardImage): "downloaded" {
  // A blob address, not a data URL: a story-sized PNG is several MB, too long for some browsers.
  const url = URL.createObjectURL(image.file);
  const link = document.createElement("a");
  link.href = url;
  link.download = image.fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}

/**
 * Shares the image, or downloads it where sharing files is not possible. navigator.share is
 * called first thing, so when this runs straight from a tap the tap still counts.
 */
export async function deliverCard(image: CardImage): Promise<DeliverResult> {
  if (!canShare(image.file)) return download(image);
  try {
    await navigator.share({ files: [image.file], title: image.fileName });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException) {
      // Closing the share sheet is not an error worth reporting.
      if (error.name === "AbortError") return "shared";
      // Too long since the tap: ask for another one instead of downloading behind its back.
      if (error.name === "NotAllowedError") return "needs-tap";
    }
    return download(image);
  }
}
