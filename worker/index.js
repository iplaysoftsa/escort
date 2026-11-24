import { createRemoteJWKSet, errors, jwtVerify } from "jose";
import firebaseConfig, { adminUid } from "../firebase-config.js";

const PROFILE_PREFIX = "escort/profiles";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
  ["image/gif", "gif"]
]);
const firebaseKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function startsWithAscii(bytes, start, value) {
  return [...value].every((character, index) => bytes[start + index] === character.charCodeAt(0));
}

function matchesImageSignature(contentType, image) {
  const bytes = image;
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === "image/png") return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (contentType === "image/gif") return bytes.length >= 6 && (startsWithAscii(bytes, 0, "GIF87a") || startsWithAscii(bytes, 0, "GIF89a"));
  if (contentType === "image/webp") return bytes.length >= 12 && startsWithAscii(bytes, 0, "RIFF") && startsWithAscii(bytes, 8, "WEBP");
  if (contentType === "image/avif") return bytes.length >= 12 && startsWithAscii(bytes, 4, "ftyp") && (startsWithAscii(bytes, 8, "avif") || startsWithAscii(bytes, 8, "avis"));
  return false;
}

async function readImageBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return { image: new Uint8Array(0), tooLarge: false };

  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return { image: null, tooLarge: true };
    }
    chunks.push(value);
  }

  const image = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    image.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { image, tooLarge: false };
}

async function verifyFirebaseAdminToken(token) {
  const { payload } = await jwtVerify(token, firebaseKeys, {
    algorithms: ["RS256"],
    audience: firebaseConfig.projectId,
    issuer: `https://securetoken.google.com/${firebaseConfig.projectId}`
  });
  return payload.sub === adminUid || payload.admin === true;
}

export async function handleProfileImageUpload(request, env, verifyAdminToken = verifyFirebaseAdminToken) {
  const requestUrl = new URL(request.url);
  if (request.method !== "POST") return jsonResponse(405, { error: "Use POST to upload an image." });
  if (request.headers.get("Origin") !== requestUrl.origin) {
    return jsonResponse(403, { error: "Uploads must come from this site." });
  }

  const authorization = request.headers.get("Authorization") || "";
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!tokenMatch) return jsonResponse(401, { error: "Sign in as an administrator to upload images." });

  let authorized;
  try {
    authorized = await verifyAdminToken(tokenMatch[1]);
  } catch (error) {
    if (error instanceof errors.JWKSTimeout) {
      console.error("Firebase signing-key verification timed out:", error);
      return jsonResponse(503, { error: "Administrator verification is temporarily unavailable." });
    }
    if (error instanceof errors.JOSEError) {
      return jsonResponse(401, { error: "Your administrator session is invalid or expired. Sign in again." });
    }
    console.error("Could not verify the Firebase administrator token:", error);
    return jsonResponse(503, { error: "Administrator verification is temporarily unavailable." });
  }
  if (!authorized) return jsonResponse(403, { error: "Administrator access is required to upload images." });

  const profileId = requestUrl.searchParams.get("profileId") || "";
  if (!/^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/.test(profileId)) {
    return jsonResponse(400, { error: "A valid profile ID is required." });
  }

  const contentType = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  const extension = IMAGE_EXTENSIONS.get(contentType);
  if (!extension) return jsonResponse(415, { error: "Upload a JPEG, PNG, WebP, AVIF, or GIF image." });

  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength !== null) {
    const size = Number(declaredLength);
    if (!Number.isSafeInteger(size) || size < 0) return jsonResponse(400, { error: "The image size is invalid." });
    if (size > MAX_IMAGE_BYTES) return jsonResponse(413, { error: "Each image must be 15 MB or smaller." });
  }

  let imageBody;
  try {
    imageBody = await readImageBody(request);
  } catch (error) {
    console.error("Could not read the uploaded image:", error);
    return jsonResponse(400, { error: "The uploaded image could not be read." });
  }
  if (imageBody.tooLarge) return jsonResponse(413, { error: "Each image must be 15 MB or smaller." });
  const image = imageBody.image;
  if (image.byteLength === 0) return jsonResponse(400, { error: "The uploaded image is empty." });
  if (!matchesImageSignature(contentType, image)) {
    return jsonResponse(415, { error: "The image contents do not match the declared image type." });
  }

  if (!env.PROFILE_IMAGES || typeof env.PROFILE_IMAGES.put !== "function" || !env.R2_PUBLIC_BASE_URL) {
    console.error("The profile-image R2 binding or public URL is not configured.");
    return jsonResponse(500, { error: "Image storage is not configured. Contact the site administrator." });
  }

  const key = `${PROFILE_PREFIX}/${profileId}/${crypto.randomUUID()}.${extension}`;
  try {
    await env.PROFILE_IMAGES.put(key, image, {
      httpMetadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable"
      }
    });
  } catch (error) {
    console.error("R2 rejected the profile image upload:", error);
    return jsonResponse(502, { error: "The image could not be saved to R2. Please try again." });
  }

  const publicBaseUrl = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "");
  return jsonResponse(201, { key, url: `${publicBaseUrl}/${key}` });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/profile-images") return handleProfileImageUpload(request, env);
    if (pathname.startsWith("/api/")) return jsonResponse(404, { error: "API route not found." });
    return env.ASSETS.fetch(request);
  }
};
