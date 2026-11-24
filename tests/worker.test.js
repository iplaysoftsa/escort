import assert from "node:assert/strict";
import test from "node:test";
import { handleProfileImageUpload } from "../worker/index.js";

const publicBaseUrl = "https://pub-db389dd5f7f34f0dba7af1f11313f7e4.r2.dev";

function createRequest(options = {}) {
  return new Request(
    `https://redroomprofiles.xyz/api/profile-images?profileId=${options.profileId || "test-profile"}`,
    {
      method: options.method || "POST",
      headers: {
        Origin: options.origin || "https://redroomprofiles.xyz",
        Authorization: options.authorization === undefined ? "Bearer admin-token" : options.authorization,
        "Content-Type": options.contentType || "image/jpeg",
        ...(options.contentLength ? { "Content-Length": options.contentLength } : {})
      },
      body: options.body === undefined ? new Uint8Array([0xff, 0xd8, 0xff]) : options.body
    }
  );
}

function createEnvironment() {
  const writes = [];
  return {
    writes,
    env: {
      R2_PUBLIC_BASE_URL: publicBaseUrl,
      PROFILE_IMAGES: {
        async put(key, body, options) {
          writes.push({ key, body, options });
        }
      }
    }
  };
}

test("requires an administrator bearer token", async () => {
  const { env, writes } = createEnvironment();
  const response = await handleProfileImageUpload(
    createRequest({ authorization: "" }),
    env,
    async () => false
  );

  assert.equal(response.status, 401);
  assert.equal(writes.length, 0);
});

test("rejects non-administrators without writing to R2", async () => {
  const { env, writes } = createEnvironment();
  const response = await handleProfileImageUpload(createRequest(), env, async () => false);

  assert.equal(response.status, 403);
  assert.equal(writes.length, 0);
});

test("rejects cross-origin upload requests", async () => {
  const { env, writes } = createEnvironment();
  const response = await handleProfileImageUpload(
    createRequest({ origin: "https://attacker.example" }),
    env,
    async () => true
  );

  assert.equal(response.status, 403);
  assert.equal(writes.length, 0);
});

test("stores an authenticated image under the profile prefix and returns its public URL", async () => {
  const { env, writes } = createEnvironment();
  const response = await handleProfileImageUpload(createRequest(), env, async (token) => token === "admin-token");
  const result = await response.json();

  assert.equal(response.status, 201);
  assert.match(result.key, /^escort\/profiles\/test-profile\/[0-9a-f-]+\.jpg$/);
  assert.equal(result.url, `${publicBaseUrl}/${result.key}`);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].options.httpMetadata.contentType, "image/jpeg");
});

test("rejects oversized and unsupported image uploads", async () => {
  const { env, writes } = createEnvironment();
  const oversizedResponse = await handleProfileImageUpload(
    createRequest({ body: new Uint8Array(15 * 1024 * 1024 + 1) }),
    env,
    async () => true
  );
  const unsupportedResponse = await handleProfileImageUpload(
    createRequest({ contentType: "text/html" }),
    env,
    async () => true
  );

  assert.equal(oversizedResponse.status, 413);
  assert.equal(unsupportedResponse.status, 415);
  assert.equal(writes.length, 0);
});

test("rejects invalid profile IDs and image bytes that do not match the MIME type", async () => {
  const { env, writes } = createEnvironment();
  const invalidProfileResponse = await handleProfileImageUpload(
    createRequest({ profileId: "../other-profile" }),
    env,
    async () => true
  );
  const invalidImageResponse = await handleProfileImageUpload(
    createRequest({ body: new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c]) }),
    env,
    async () => true
  );

  assert.equal(invalidProfileResponse.status, 400);
  assert.equal(invalidImageResponse.status, 415);
  assert.equal(writes.length, 0);
});
