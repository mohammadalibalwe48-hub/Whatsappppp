import crypto from "crypto";
import { Router, Request, Response, NextFunction } from "express";
import { McpServer, OAuthError, OAuthErrorCode, type AuthInfo } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import {
  hostHeaderValidation,
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
  originValidation,
  requireBearerAuth
} from "@modelcontextprotocol/express";
import { z } from "zod";
import { env } from "../config/env";
import { generateApiKey, hashApiKey } from "../lib/crypto";
import { getKv } from "../lib/redis";
import { getSupabase, supabaseAvailable } from "../lib/supabase";
import { errorHandler } from "../middleware/errors";
import { requireDashboardAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { lookupOtp, resendOtp, sendOtp, verifyOtp } from "../otp/service";

const ISSUER = env.API_PUBLIC_URL.replace(/\/$/, "");
const RESOURCE = env.MCP_SERVER_URL;
const WEB_ORIGIN = env.CORS_ORIGINS[0] ?? "http://localhost:3000";
const ACCESS_TOKEN_SECONDS = 60 * 60;
const AUTH_CODE_SECONDS = 5 * 60;
const REFRESH_TOKEN_SECONDS = 60 * 60 * 24 * 30;
const CLIENT_REGISTRATION_SECONDS = 60 * 60 * 24 * 365;
const REQUIRED_SCOPE = "otp:manage";
const SUPPORTED_SCOPES = new Set([REQUIRED_SCOPE, "offline_access"]);

interface ApiKeyIdentity {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  defaultOtpLength: number;
  defaultOtpAlphabet: "numeric" | "alphanumeric" | "alphabetic";
}

interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: number;
}

interface OAuthRequest {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string[];
  resource: string;
}

interface AccessClaims {
  iss: string;
  aud: string;
  sub: string;
  api_key_id: string;
  client_id: string;
  scope: string;
  iat: number;
  exp: number;
  jti: string;
}

export const mcpRouter = Router();

const oauthMetadata = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/oauth/authorize`,
  token_endpoint: `${ISSUER}/oauth/token`,
  registration_endpoint: `${ISSUER}/oauth/register`,
  revocation_endpoint: `${ISSUER}/oauth/revoke`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  token_endpoint_auth_methods_supported: ["none"],
  revocation_endpoint_auth_methods_supported: ["none"],
  code_challenge_methods_supported: ["S256"],
  scopes_supported: [...SUPPORTED_SCOPES],
  client_id_metadata_document_supported: false,
  authorization_response_iss_parameter_supported: true
};

mcpRouter.use(
  mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: new URL(RESOURCE),
    scopesSupported: [...SUPPORTED_SCOPES],
    resourceName: "OtpWave WhatsApp OTP API"
  })
);

// Also publish origin-level metadata for clients that use the base URL rather
// than the path-aware Streamable HTTP resource URL.
mcpRouter.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: ISSUER,
    authorization_servers: [ISSUER],
    scopes_supported: [...SUPPORTED_SCOPES],
    bearer_methods_supported: ["header"] as const,
    resource_name: "OtpWave WhatsApp OTP API"
  });
});

function oauthError(res: Response, status: number, error: string, description: string) {
  res
    .status(status)
    .set({ "cache-control": "no-store", pragma: "no-cache" })
    .json({ error, error_description: description });
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sanitizeClientName(value: string): string {
  return [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .trim();
}

function getSigningKey(): Buffer {
  return crypto
    .createHmac("sha256", env.WEBHOOK_SIGNING_PEPPER)
    .update("otpwave:mcp-access-token:v1")
    .digest();
}

function encodeBase64Url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function signAccessToken(claims: AccessClaims): string {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT", kid: "mcp-v1" }));
  const payload = encodeBase64Url(JSON.stringify(claims));
  const input = `${header}.${payload}`;
  const signature = crypto.createHmac("sha256", getSigningKey()).update(input).digest("base64url");
  return `${input}.${signature}`;
}

function verifyAccessToken(token: string): AccessClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signature] = parts;
  let header: { alg?: string; kid?: string };
  let claims: AccessClaims;
  try {
    header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (header.alg !== "HS256" || header.kid !== "mcp-v1") return null;
  const expected = crypto.createHmac("sha256", getSigningKey()).update(`${headerPart}.${payloadPart}`).digest("base64url");
  if (!constantTimeEqual(signature, expected)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iss !== ISSUER ||
    ![RESOURCE, ISSUER].includes(claims.aud) ||
    !claims.sub ||
    !claims.api_key_id ||
    !claims.client_id ||
    !claims.jti ||
    !Number.isInteger(claims.iat) ||
    !Number.isInteger(claims.exp) ||
    claims.exp <= now ||
    claims.iat > now + 60 ||
    typeof claims.scope !== "string"
  ) {
    return null;
  }
  return claims;
}

function isAlphabet(value: unknown): value is ApiKeyIdentity["defaultOtpAlphabet"] {
  return value === "numeric" || value === "alphanumeric" || value === "alphabetic";
}

function identityFromRow(row: Record<string, unknown>): ApiKeyIdentity {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name ?? "API key"),
    prefix: String(row.prefix ?? ""),
    defaultOtpLength: typeof row.default_otp_length === "number" ? row.default_otp_length : 6,
    defaultOtpAlphabet: isAlphabet(row.default_otp_alphabet) ? row.default_otp_alphabet : "numeric"
  };
}

async function findApiKeyBySecret(raw: string): Promise<ApiKeyIdentity | null> {
  if (!supabaseAvailable()) throw new Error("Supabase is not configured");
  const { data, error } = await getSupabase()
    .from("api_keys")
    .select("id,user_id,name,prefix,revoked_at,default_otp_length,default_otp_alphabet")
    .eq("key_hash", hashApiKey(raw))
    .maybeSingle();
  if (error) throw new Error("Could not validate API key");
  if (!data || data.revoked_at) return null;
  const identity = identityFromRow(data as Record<string, unknown>);
  getSupabase().from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", identity.id).then(() => undefined);
  return identity;
}

async function findActiveApiKeyById(id: string, userId: string): Promise<ApiKeyIdentity | null> {
  if (!supabaseAvailable()) throw new Error("Supabase is not configured");
  const { data, error } = await getSupabase()
    .from("api_keys")
    .select("id,user_id,name,prefix,revoked_at,default_otp_length,default_otp_alphabet")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Could not validate API key");
  if (!data || data.revoked_at) return null;
  const identity = identityFromRow(data as Record<string, unknown>);
  getSupabase().from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", identity.id).then(() => undefined);
  return identity;
}

function authInfo(token: string, identity: ApiKeyIdentity, clientId: string, exp?: number): AuthInfo {
  return {
    token,
    clientId,
    scopes: [REQUIRED_SCOPE],
    expiresAt: exp ?? Math.floor(Date.now() / 1000) + ACCESS_TOKEN_SECONDS,
    resource: new URL(RESOURCE),
    extra: { userId: identity.userId, apiKey: identity }
  };
}

const tokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (token.length > 4096) throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid access token");
    if (token.split(".").length !== 3) {
      const apiKeyIdentity = await findApiKeyBySecret(token);
      if (apiKeyIdentity) return authInfo(token, apiKeyIdentity, "otpwave-api-key");
      throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid access token");
    }

    const claims = verifyAccessToken(token);
    if (!claims) throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid access token");
    const identity = await findActiveApiKeyById(claims.api_key_id, claims.sub);
    if (!identity) throw new OAuthError(OAuthErrorCode.InvalidToken, "Access token revoked");
    return authInfo(token, identity, claims.client_id, claims.exp);
  }
};

const oauthRateLimit = rateLimit({ bucket: "mcp_oauth", windowSeconds: 60, limit: 30 });
const registrationRateLimit = rateLimit({ bucket: "mcp_oauth_register", windowSeconds: 60 * 60, limit: 10 });

function storedKey(key: string): string {
  return `mcp:oauth:${key}`;
}

async function readClient(clientId: string): Promise<OAuthClient | null> {
  const raw = await getKv().get(storedKey(`client:${sha256(clientId)}`));
  if (!raw) return null;
  try {
    const client = JSON.parse(raw) as OAuthClient;
    return client.clientId === clientId ? client : null;
  } catch {
    return null;
  }
}

function isAllowedRedirectUri(value: string): boolean {
  try {
    const uri = new URL(value);
    if (uri.hash || uri.username || uri.password) return false;
    return uri.protocol === "https:" || (uri.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(uri.hostname));
  } catch {
    return false;
  }
}

function parseScopes(scope?: string): string[] | null {
  const scopes = [...new Set((scope ?? `${REQUIRED_SCOPE} offline_access`).split(/\s+/).filter(Boolean))];
  if (!scopes.includes(REQUIRED_SCOPE) || scopes.some((item) => !SUPPORTED_SCOPES.has(item))) return null;
  return scopes;
}

const authorizationRequestSchema = z.object({
  client_id: z.string().min(1).max(512),
  redirect_uri: z.string().url().max(2048),
  response_type: z.literal("code"),
  state: z.string().min(1).max(1024),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  scope: z.string().optional(),
  resource: z.string().url().optional()
});

function parseAuthorizationRequest(input: unknown): { request?: OAuthRequest; error?: string } {
  const parsed = authorizationRequestSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid OAuth authorization request" };
  const scopes = parseScopes(parsed.data.scope);
  if (!scopes) return { error: "Unsupported scope requested" };
  const resource = parsed.data.resource ?? RESOURCE;
  if (![RESOURCE, ISSUER].includes(resource)) return { error: "The requested resource is not this OtpWave server" };
  return {
    request: {
      clientId: parsed.data.client_id,
      redirectUri: parsed.data.redirect_uri,
      state: parsed.data.state,
      codeChallenge: parsed.data.code_challenge,
      scope: scopes,
      resource
    }
  };
}

function authorizeUrl(req: Request, res: Response, next: NextFunction) {
  void (async () => {
    const result = parseAuthorizationRequest(req.query);
    if (!result.request) return oauthError(res, 400, "invalid_request", result.error ?? "Invalid request");
    const client = await readClient(result.request.clientId);
    if (!client) return oauthError(res, 400, "invalid_client", "The OAuth client is not registered");
    if (!client.redirectUris.includes(result.request.redirectUri)) {
      return oauthError(res, 400, "invalid_request", "The redirect URI is not registered for this client");
    }

    const webUrl = new URL("/mcp/authorize", WEB_ORIGIN);
    for (const [key, value] of Object.entries({
      client_id: result.request.clientId,
      redirect_uri: result.request.redirectUri,
      response_type: "code",
      state: result.request.state,
      code_challenge: result.request.codeChallenge,
      code_challenge_method: "S256",
      scope: result.request.scope.join(" "),
      resource: result.request.resource
    })) {
      webUrl.searchParams.set(key, value);
    }
    res.redirect(302, webUrl.toString());
  })().catch(next);
}

function issueAuthorizationCode(request: OAuthRequest, userId: string): Promise<string> {
  const code = crypto.randomBytes(32).toString("base64url");
  const record = {
    ...request,
    userId,
    createdAt: Date.now()
  };
  return getKv().set(storedKey(`code:${sha256(code)}`), JSON.stringify(record), AUTH_CODE_SECONDS).then(() => code);
}

async function createMcpApiKey(userId: string, clientName: string): Promise<ApiKeyIdentity> {
  if (!supabaseAvailable()) throw new Error("Supabase is not configured");
  const generated = generateApiKey();
  const safeName = sanitizeClientName(clientName).slice(0, 64) || "MCP client";
  const { data, error } = await getSupabase()
    .from("api_keys")
    .insert({
      user_id: userId,
      name: `MCP · ${safeName}`.slice(0, 80),
      prefix: generated.prefix,
      key_hash: generated.hash,
      default_otp_length: 6,
      default_otp_alphabet: "numeric"
    })
    .select("id,user_id,name,prefix,default_otp_length,default_otp_alphabet")
    .single();
  if (error || !data) throw new Error("Could not create MCP access key");
  return identityFromRow(data as Record<string, unknown>);
}

function makeTokens(identity: ApiKeyIdentity, clientId: string, resource: string, scopes: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const claims: AccessClaims = {
    iss: ISSUER,
    aud: resource,
    sub: identity.userId,
    api_key_id: identity.id,
    client_id: clientId,
    scope: scopes.join(" "),
    iat: now,
    exp: now + ACCESS_TOKEN_SECONDS,
    jti: crypto.randomUUID()
  };
  const accessToken = signAccessToken(claims);
  const refreshToken = `otpr_${crypto.randomBytes(32).toString("base64url")}`;
  return {
    accessToken,
    refreshToken,
    claims,
    refreshRecord: {
      userId: identity.userId,
      apiKeyId: identity.id,
      clientId,
      resource,
      scopes
    }
  };
}

async function saveRefreshToken(refreshToken: string, record: unknown) {
  await getKv().set(storedKey(`refresh:${sha256(refreshToken)}`), JSON.stringify(record), REFRESH_TOKEN_SECONDS);
}

function tokenResponse(res: Response, tokens: ReturnType<typeof makeTokens>) {
  res
    .set({ "cache-control": "no-store", pragma: "no-cache" })
    .json({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_SECONDS,
      refresh_token: tokens.refreshToken,
      scope: tokens.claims.scope
    });
}

async function tokenEndpoint(req: Request, res: Response) {
  const form = req.body ?? {};
  const clientId = typeof form.client_id === "string" ? form.client_id : "";
  if (!clientId || typeof form.grant_type !== "string") return oauthError(res, 400, "invalid_request", "client_id and grant_type are required");
  const client = await readClient(clientId);
  if (!client) return oauthError(res, 400, "invalid_client", "The OAuth client is not registered");

  if (form.grant_type === "authorization_code") {
    if (typeof form.code !== "string" || typeof form.redirect_uri !== "string" || typeof form.code_verifier !== "string") {
      return oauthError(res, 400, "invalid_request", "code, redirect_uri, and code_verifier are required");
    }
    const rawCode = await getKv().getdel(storedKey(`code:${sha256(form.code)}`));
    if (!rawCode) return oauthError(res, 400, "invalid_grant", "The authorization code is invalid or expired");
    let record: OAuthRequest & { userId: string };
    try {
      record = JSON.parse(rawCode) as OAuthRequest & { userId: string };
    } catch {
      return oauthError(res, 400, "invalid_grant", "The authorization code is invalid");
    }
    const verifier = form.code_verifier;
    if (
      record.clientId !== clientId ||
      record.redirectUri !== form.redirect_uri ||
      !client.redirectUris.includes(form.redirect_uri) ||
      !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) ||
      !constantTimeEqual(encodeBase64Url(crypto.createHash("sha256").update(verifier).digest()), record.codeChallenge)
    ) {
      return oauthError(res, 400, "invalid_grant", "The authorization code or PKCE verifier is invalid");
    }
    if (form.resource && form.resource !== record.resource) return oauthError(res, 400, "invalid_target", "The resource does not match the authorization request");

    const identity = await createMcpApiKey(record.userId, client.clientName);
    const tokens = makeTokens(identity, clientId, record.resource, record.scope);
    await saveRefreshToken(tokens.refreshToken, tokens.refreshRecord);
    return tokenResponse(res, tokens);
  }

  if (form.grant_type === "refresh_token") {
    if (typeof form.refresh_token !== "string") return oauthError(res, 400, "invalid_request", "refresh_token is required");
    const rawRecord = await getKv().getdel(storedKey(`refresh:${sha256(form.refresh_token)}`));
    if (!rawRecord) return oauthError(res, 400, "invalid_grant", "The refresh token is invalid or expired");
    let record: { userId: string; apiKeyId: string; clientId: string; resource: string; scopes: string[] };
    try {
      record = JSON.parse(rawRecord);
    } catch {
      return oauthError(res, 400, "invalid_grant", "The refresh token is invalid");
    }
    if (record.clientId !== clientId || (form.resource && form.resource !== record.resource)) {
      return oauthError(res, 400, "invalid_grant", "The refresh token does not match this client or resource");
    }
    const requestedScopes = form.scope ? parseScopes(form.scope) : record.scopes;
    if (!requestedScopes || requestedScopes.some((scope) => !record.scopes.includes(scope))) {
      return oauthError(res, 400, "invalid_scope", "The refresh request cannot add scopes");
    }
    const identity = await findActiveApiKeyById(record.apiKeyId, record.userId);
    if (!identity) return oauthError(res, 400, "invalid_grant", "The OtpWave access key has been revoked");
    const tokens = makeTokens(identity, clientId, record.resource, requestedScopes);
    await saveRefreshToken(tokens.refreshToken, tokens.refreshRecord);
    return tokenResponse(res, tokens);
  }

  return oauthError(res, 400, "unsupported_grant_type", "Only authorization_code and refresh_token are supported");
}

async function revokeToken(req: Request, res: Response) {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!token) return res.status(200).end();

  let userId: string | undefined;
  let apiKeyId: string | undefined;
  if (token.startsWith("otpr_")) {
    const raw = await getKv().getdel(storedKey(`refresh:${sha256(token)}`));
    if (raw) {
      try {
        const record = JSON.parse(raw) as { userId: string; apiKeyId: string };
        userId = record.userId;
        apiKeyId = record.apiKeyId;
      } catch {
        // An unreadable token is treated as already revoked.
      }
    }
  } else {
    const claims = verifyAccessToken(token);
    userId = claims?.sub;
    apiKeyId = claims?.api_key_id;
  }
  if (userId && apiKeyId && supabaseAvailable()) {
    await getSupabase()
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", apiKeyId)
      .eq("user_id", userId)
      .is("revoked_at", null);
  }
  res.status(200).end();
}

const mcpAuth = requireBearerAuth({
  verifier: tokenVerifier,
  requiredScopes: [REQUIRED_SCOPE],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(RESOURCE))
});

const mcpHostValidation = hostHeaderValidation([...new Set([new URL(ISSUER).hostname])]);
const mcpOriginValidation = originValidation([
  ...new Set([
    ...env.CORS_ORIGINS.map((origin) => new URL(origin).hostname),
    "chatgpt.com",
    "chat.openai.com"
  ])
]);

function getIdentityFromAuth(auth: AuthInfo | undefined): ApiKeyIdentity {
  const identity = auth?.extra?.apiKey;
  if (!identity || typeof identity !== "object") throw new Error("MCP authorization context is missing");
  return identity as ApiKeyIdentity;
}

function toolResult(value: unknown, isError = false) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }], isError };
}

async function enforceOtpToolLimit(bucket: "otp_send" | "otp_verify", identity: ApiKeyIdentity) {
  const limit = bucket === "otp_send" ? env.RATE_LIMIT_SEND_PER_MIN : env.RATE_LIMIT_VERIFY_PER_MIN;
  const key = `rl:${bucket}:${identity.id}`;
  const count = await getKv().incr(key, 60);
  if (count > limit) {
    const retryAfter = Math.max(1, await getKv().ttl(key));
    throw new Error(`Rate limit exceeded. Retry in ${retryAfter} seconds.`);
  }
}

function createOtpMcpServer() {
  const server = new McpServer({
    name: "OtpWave",
    version: "1.0.0",
    title: "OtpWave WhatsApp OTP API",
    description: "Tools for sending and verifying WhatsApp one-time passcodes through OtpWave. Ask the user before sending a code."
  });

  server.registerTool(
    "send_otp",
    {
      title: "Send a WhatsApp OTP",
      description: "Send a one-time verification code to a phone number through the connected OtpWave WhatsApp account. Ask the user for confirmation before sending. Do not send repeated codes unless requested.",
      inputSchema: {
        phoneNumber: z.string().min(6).max(20).regex(/^[+\d][\d\s\-()]*$/).describe("Recipient phone number, including country code."),
        appName: z.string().max(60).optional().describe("Optional service name shown in the OTP message."),
        length: z.number().int().min(4).max(10).optional().describe("Code length, from 4 to 10 digits or characters."),
        alphabet: z.enum(["numeric", "alphanumeric", "alphabetic"]).optional(),
        ttlSeconds: z.number().int().min(30).max(3600).optional().describe("Code lifetime in seconds.")
      }
    },
    async (args, context) => {
      try {
        const identity = getIdentityFromAuth(context.http?.authInfo);
        await enforceOtpToolLimit("otp_send", identity);
        const result = await sendOtp({
          userId: identity.userId,
          apiKeyId: identity.id,
          phoneNumber: args.phoneNumber,
          appName: args.appName,
          length: args.length ?? identity.defaultOtpLength,
          alphabet: args.alphabet ?? identity.defaultOtpAlphabet,
          ttlSeconds: args.ttlSeconds
        });
        return toolResult(result);
      } catch (error) {
        return toolResult({ error: (error as Error).message || "Could not send the OTP." }, true);
      }
    }
  );

  server.registerTool(
    "verify_otp",
    {
      title: "Verify a WhatsApp OTP",
      description: "Check a one-time code that was sent by OtpWave. Provide the OTP ID or the phone number and the code.",
      inputSchema: {
        otpId: z.string().optional().describe("OTP ID returned by send_otp."),
        phoneNumber: z.string().min(6).max(20).regex(/^[+\d][\d\s\-()]*$/).optional(),
        code: z.string().min(4).max(10)
      }
    },
    async (args, context) => {
      try {
        if (!args.otpId && !args.phoneNumber) return toolResult({ error: "Provide otpId or phoneNumber." }, true);
        const identity = getIdentityFromAuth(context.http?.authInfo);
        await enforceOtpToolLimit("otp_verify", identity);
        return toolResult(await verifyOtp({
          userId: identity.userId,
          apiKeyId: identity.id,
          otpId: args.otpId,
          phoneNumber: args.phoneNumber,
          code: args.code
        }));
      } catch (error) {
        return toolResult({ error: (error as Error).message || "Could not verify the OTP." }, true);
      }
    }
  );

  server.registerTool(
    "resend_otp",
    {
      title: "Resend a WhatsApp OTP",
      description: "Send a replacement for an active OtpWave code. The server enforces a resend cooldown. Use only when the user asks for a resend.",
      inputSchema: {
        otpId: z.string().optional(),
        phoneNumber: z.string().min(6).max(20).regex(/^[+\d][\d\s\-()]*$/).optional()
      }
    },
    async (args, context) => {
      try {
        if (!args.otpId && !args.phoneNumber) return toolResult({ error: "Provide otpId or phoneNumber." }, true);
        const identity = getIdentityFromAuth(context.http?.authInfo);
        await enforceOtpToolLimit("otp_send", identity);
        return toolResult(await resendOtp({
          userId: identity.userId,
          apiKeyId: identity.id,
          otpId: args.otpId,
          phoneNumber: args.phoneNumber
        }));
      } catch (error) {
        return toolResult({ error: (error as Error).message || "Could not resend the OTP." }, true);
      }
    }
  );

  server.registerTool(
    "get_otp_status",
    {
      title: "Get OTP status",
      description: "Look up the status, expiration, and attempt count for an OTP created by the authenticated OtpWave account.",
      inputSchema: { otpId: z.string().min(1).describe("OTP ID returned by send_otp.") }
    },
    async ({ otpId }, context) => {
      try {
        const identity = getIdentityFromAuth(context.http?.authInfo);
        const record = await lookupOtp({ userId: identity.userId, otpId });
        return record ? toolResult(record) : toolResult({ error: "OTP not found." }, true);
      } catch (error) {
        return toolResult({ error: (error as Error).message || "Could not retrieve the OTP status." }, true);
      }
    }
  );

  return server;
}

const registrationSchema = z.object({
  redirect_uris: z.array(z.string().url().max(2048)).min(1).max(10),
  client_name: z.string().max(128).optional(),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  token_endpoint_auth_method: z.string().optional()
});

mcpRouter.post("/oauth/register", registrationRateLimit, (req, res, next) => {
  void (async () => {
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) return oauthError(res, 400, "invalid_client_metadata", "Provide one or more valid HTTPS redirect_uris");
    if (parsed.data.redirect_uris.some((uri) => !isAllowedRedirectUri(uri))) {
      return oauthError(res, 400, "invalid_redirect_uri", "Redirect URIs must use HTTPS, or HTTP on localhost, and cannot include fragments");
    }
    if (parsed.data.grant_types?.some((grant) => grant !== "authorization_code" && grant !== "refresh_token")) {
      return oauthError(res, 400, "invalid_client_metadata", "Only authorization_code and refresh_token grants are supported");
    }
    if (parsed.data.response_types?.some((type) => type !== "code")) {
      return oauthError(res, 400, "invalid_client_metadata", "Only the code response type is supported");
    }
    if (parsed.data.token_endpoint_auth_method && parsed.data.token_endpoint_auth_method !== "none") {
      return oauthError(res, 400, "invalid_client_metadata", "Only public OAuth clients using PKCE are supported");
    }
    const clientId = `otpwave_${crypto.randomBytes(24).toString("base64url")}`;
    const client: OAuthClient = {
      clientId,
      clientName: sanitizeClientName(parsed.data.client_name ?? "MCP client").slice(0, 128) || "MCP client",
      redirectUris: [...new Set(parsed.data.redirect_uris)],
      createdAt: Math.floor(Date.now() / 1000)
    };
    await getKv().set(storedKey(`client:${sha256(clientId)}`), JSON.stringify(client), CLIENT_REGISTRATION_SECONDS);
    res.status(201).set("cache-control", "no-store").json({
      client_id: clientId,
      client_id_issued_at: client.createdAt,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none"
    });
  })().catch(next);
});

mcpRouter.get("/oauth/clients/:clientId", oauthRateLimit, (req, res, next) => {
  const redirectUri = typeof req.query.redirect_uri === "string" ? req.query.redirect_uri : "";
  void readClient(req.params.clientId)
    .then((client) => {
      if (!client || !client.redirectUris.includes(redirectUri)) {
        return oauthError(res, 404, "invalid_client", "OAuth client or callback not found");
      }
      res.json({ clientName: client.clientName, callbackHost: new URL(redirectUri).host });
    })
    .catch(next);
});

mcpRouter.get("/oauth/authorize", oauthRateLimit, authorizeUrl);

mcpRouter.post("/oauth/authorize/complete", oauthRateLimit, requireDashboardAuth(), (req, res, next) => {
  void (async () => {
    const result = parseAuthorizationRequest(req.body);
    if (!result.request) return oauthError(res, 400, "invalid_request", result.error ?? "Invalid request");
    const client = await readClient(result.request.clientId);
    if (!client) return oauthError(res, 400, "invalid_client", "The OAuth client is not registered");
    if (!client.redirectUris.includes(result.request.redirectUri)) {
      return oauthError(res, 400, "invalid_request", "The redirect URI is not registered for this client");
    }
    const code = await issueAuthorizationCode(result.request, req.userId!);
    const callback = new URL(result.request.redirectUri);
    callback.searchParams.set("code", code);
    callback.searchParams.set("state", result.request.state);
    callback.searchParams.set("iss", ISSUER);
    res.set({ "cache-control": "no-store", pragma: "no-cache" }).json({ redirectUrl: callback.toString() });
  })().catch(next);
});

mcpRouter.post("/oauth/token", oauthRateLimit, (req, res, next) => {
  void tokenEndpoint(req, res).catch(next);
});

mcpRouter.post("/oauth/revoke", oauthRateLimit, (req, res, next) => {
  void revokeToken(req, res).catch(next);
});

const attachIdentity = (req: Request, _res: Response, next: NextFunction) => {
  const identity = req.auth?.extra?.apiKey as ApiKeyIdentity | undefined;
  if (identity) {
    req.userId = identity.userId;
    req.apiKey = identity;
  }
  next();
};

const mcpRateLimit = rateLimit({ bucket: "mcp", windowSeconds: 60, limit: 120 });

mcpRouter.all("/mcp", mcpHostValidation, mcpOriginValidation, mcpAuth, attachIdentity, mcpRateLimit, (req, res, next) => {
  void (async () => {
    const server = createOtpMcpServer();
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  })().catch(next);
});

mcpRouter.use(errorHandler);
