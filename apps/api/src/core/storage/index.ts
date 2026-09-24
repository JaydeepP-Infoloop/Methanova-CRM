import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const root = path.join(process.cwd(), "uploads");

export async function storeBuffer(filename: string, data: Buffer): Promise<string> {
  await mkdir(root, { recursive: true });
  const dest = path.join(root, filename);
  await writeFile(dest, data);
  return dest;
}

/** Writes under `uploads/<kind>/` with a generated name so a replace cannot overwrite an old blob still referenced by audit. */
export async function storeOwnedBuffer(kind: string, data: Buffer, extension: string): Promise<string> {
  const dir = path.join(root, kind.toLowerCase());
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, `${randomUUID()}${extension}`);
  await writeFile(dest, data);
  return dest;
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  const resolved = path.resolve(storageKey);
  const allowed = path.resolve(root);
  if (!resolved.startsWith(allowed)) {
    throw new Error("Refusing to read a path outside uploads");
  }
  return readFile(resolved);
}
