import { timingSafeEqual } from "node:crypto";
import { getHeader } from "./request.mjs";

export function isAdminAuthorized(headers, expectedToken) {
  const authorization = getHeader(headers, "authorization");
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expectedToken || !supplied) {
    return false;
  }
  const actualBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expectedToken);
  return actualBuffer.length === expectedBuffer.length
    && timingSafeEqual(actualBuffer, expectedBuffer);
}
