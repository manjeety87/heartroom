/**
 * A random id for things saved on this device (e.g. a finished game). Uses getRandomValues, not
 * crypto.randomUUID: randomUUID exists only in secure contexts, and a phone testing the app at
 * http://<laptop-ip>:3000 is not one, so randomUUID there is undefined and the call throws.
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
