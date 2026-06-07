/**
 * Gmail OAuth service
 * Scopes: gmail.readonly + gmail.labels + gmail.modify
 * Tokens encrypted with AES-256-GCM before TiDB storage
 */
import { encryptToken, decryptToken } from "../_core/db";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export function getGmailAuthUrl(userId: number): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/oauth/gmail/callback`;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID not set");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state: String(userId),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGmailCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
  name: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/oauth/gmail/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Gmail token exchange failed: ${err}`);
  }

  const tokens = await tokenRes.json() as any;

  // Get user email from Google
  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userRes.json() as any;

  return {
    accessToken: encryptToken(tokens.access_token),
    refreshToken: encryptToken(tokens.refresh_token || ""),
    expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
    email: userInfo.email,
    name: userInfo.name || userInfo.email,
  };
}

export async function refreshGmailToken(encryptedRefreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const refreshToken = decryptToken(encryptedRefreshToken);
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("Gmail token refresh failed");
  const data = await res.json() as any;

  return {
    accessToken: encryptToken(data.access_token),
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
  };
}

export async function getGmailThreads(
  accessToken: string,
  maxResults = 500,
  pageToken?: string
): Promise<{ threads: any[]; nextPageToken?: string }> {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: "-category:promotions -category:social -category:updates -in:spam -in:trash",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Gmail threads fetch failed: ${res.status}`);
  const data = await res.json() as any;
  return { threads: data.threads || [], nextPageToken: data.nextPageToken };
}

export async function getGmailThread(accessToken: string, threadId: string): Promise<any> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  return res.json();
}

export function parseGmailThread(thread: any): {
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  snippet: string;
  messageCount: number;
} {
  const firstMsg = thread.messages?.[0];
  const lastMsg = thread.messages?.[thread.messages.length - 1];
  const headers = firstMsg?.payload?.headers || [];

  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  const dateStr = getHeader("Date");
  const date = dateStr ? new Date(dateStr) : new Date();

  return {
    threadId: thread.id,
    subject: getHeader("Subject") || "(no subject)",
    from: getHeader("From"),
    to: getHeader("To"),
    date: isNaN(date.getTime()) ? new Date() : date,
    snippet: lastMsg?.snippet || "",
    messageCount: thread.messages?.length || 1,
  };
}
