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
};
