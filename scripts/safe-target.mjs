import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function resolveTarget(target, allowRemote = false) {
  if (/^https?:/i.test(target)) {
    const host = new URL(target).hostname;
    if (!LOCAL_HOSTS.has(host) && !allowRemote) {
      console.error(`Refusing to open ${host}: these scripts drive the page and can run JavaScript in it. Open a local file or a localhost server, or pass --allow-remote if you trust the site.`);
      process.exit(2);
    }
    return { url: target, isFile: false };
  }
  if (/^file:/i.test(target)) return { url: target, isFile: true };
  return { url: pathToFileURL(resolve(target)).href, isFile: true };
}
