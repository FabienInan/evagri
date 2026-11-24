/**
 * Result shape returned by every server action. Actions return failures instead of throwing:
 * in production Next.js hides the message of a thrown error from the browser.
 */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string }
