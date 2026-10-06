const MAX_EDGE = 2000;

/**
 * Memory storage signs an absolute APP_URL. The dev app runs on another port,
 * so a cross-origin PUT fails. Keep S3 URLs absolute and send the local
 * storage path through the page origin (Vite proxies `/api`).
 */
export function localStorageUrl(url: string): string {
  try {
    const parsed = new URL(url, "http://localhost");
    if (parsed.pathname === "/api/v1/dev-storage") {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return url;
  }
  return url;
}

/** Shrink photos before upload. HEIC becomes JPG when the browser can decode it. */
export async function prepareUpload(
  file: File,
): Promise<{ blob: Blob; name: string; type: string }> {
  const heic = file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic");
  const image = file.type.startsWith("image/") || heic;
  if (!image) {
    return { blob: file, name: file.name, type: file.type || "application/octet-stream" };
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo could not be read. Save it as a JPG and try again.");
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This photo could not be prepared.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("This photo could not be compressed.")),
      "image/jpeg",
      0.82,
    );
  });
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return { blob, name: `${base}.jpg`, type: "image/jpeg" };
}

export async function putWithRetry(
  url: string,
  body: Blob,
  type: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  let last = new Error("The upload did not finish.");
  for (let tryNumber = 0; tryNumber < 3; tryNumber += 1) {
    try {
      await putOnce(url, body, type, onProgress);
      return;
    } catch (error) {
      last = error instanceof Error ? error : last;
      await new Promise((resolve) => window.setTimeout(resolve, 400 * 2 ** tryNumber));
    }
  }
  throw last;
}

function putOnce(
  url: string,
  body: Blob,
  type: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", localStorageUrl(url));
    request.setRequestHeader("content-type", type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
        return;
      }
      reject(new Error("The upload did not finish."));
    };
    request.onerror = () => reject(new Error("The network dropped the upload."));
    request.send(body);
  });
}
