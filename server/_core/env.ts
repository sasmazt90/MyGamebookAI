export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // Text LLM (primary: OpenAI-compatible)
  textApiUrl:
    process.env.TEXT_LLM_API_URL ??
    process.env.OPENAI_BASE_URL ??
    "https://api.openai.com",
  textApiKey:
    process.env.TEXT_LLM_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.LLM_API_KEY ??
    "",
  textModel: process.env.TEXT_LLM_MODEL ?? "gpt-4o-mini",
  textMaxTokens: (() => {
    const raw = process.env.TEXT_LLM_MAX_TOKENS;
    if (!raw) return 4096;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 4096;
  })(),

  // Image generation provider
  imageProvider: (process.env.IMAGE_PROVIDER ?? "google").toLowerCase(),
  googleApiKey: process.env.GOOGLE_API_KEY ?? "",
  googleImageModel:
    process.env.GOOGLE_IMAGE_MODEL ??
    "gemini-2.0-flash-preview-image-generation",

  // Legacy Forge-compatible services (kept for backward compatibility)
  forgeApiUrl:
    process.env.BUILT_IN_FORGE_API_URL ??
    process.env.LLM_API_URL ??
    "",
  forgeApiKey:
    process.env.BUILT_IN_FORGE_API_KEY ??
    process.env.LLM_API_KEY ??
    "",

  // Object storage (preferred: Cloudflare R2 via S3-compatible API)
  storageProvider: (process.env.STORAGE_PROVIDER ?? "r2").toLowerCase(),
  r2AccountId: process.env.R2_ACCOUNT_ID ?? "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  r2BucketName: process.env.R2_BUCKET_NAME ?? "",
  r2Endpoint:
    process.env.R2_ENDPOINT ??
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : ""),
  r2PublicBaseUrl:
    process.env.R2_PUBLIC_BASE_URL ??
    process.env.R2_PUBLIC_URL ??
    "",
};
