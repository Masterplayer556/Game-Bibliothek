import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverCard, type CardImage } from "./export-image";

const image: CardImage = { file: new File(["png"], "karte.png", { type: "image/png" }), fileName: "karte.png" };

function stubPage(share: (() => Promise<void>) | null) {
  const clicks: string[] = [];
  vi.stubGlobal("navigator", share ? { share: vi.fn(share), canShare: () => true } : {});
  vi.stubGlobal("document", { createElement: () => ({ click() { clicks.push(this.download); }, download: "", href: "" }) });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
  vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
  return clicks;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("deliverCard", () => {
  it("shares the image where the phone can share files", async () => {
    const clicks = stubPage(async () => undefined);
    expect(await deliverCard(image)).toBe("shared");
    expect(clicks).toEqual([]);
  });

  it("asks for another tap when the browser refuses because the tap is too long ago (iPhone)", async () => {
    const clicks = stubPage(async () => {
      throw new DOMException("not allowed", "NotAllowedError");
    });
    expect(await deliverCard(image)).toBe("needs-tap");
    expect(clicks).toEqual([]);
  });

  it("treats a closed share sheet as done and downloads on other errors", async () => {
    stubPage(async () => {
      throw new DOMException("closed", "AbortError");
    });
    expect(await deliverCard(image)).toBe("shared");
    const clicks = stubPage(async () => {
      throw new TypeError("broken");
    });
    expect(await deliverCard(image)).toBe("downloaded");
    expect(clicks).toEqual(["karte.png"]);
  });

  it("downloads where sharing files is not possible", async () => {
    const clicks = stubPage(null);
    expect(await deliverCard(image)).toBe("downloaded");
    expect(clicks).toEqual(["karte.png"]);
  });
});
