/**
 * Outlook / Microsoft 365 OAuth service
 * Uses Microsoft Identity Platform (MSAL-compatible manual flow)
 * Scopes: Mail.Read, Mail.ReadWrite, User.Read
 */
import { encryptToken, decryptToken } from "./_core/db";

const OUTLOOK_SCOPES = [
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/User.Read",
  "offline_access",
].join(" ");

const MS_TENANT = "common"; // allows personal + work accounts

export function getOutlookAuthUrl(userId: number): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${process.env.APP_URL}/api/oauth/outlook/callback`;
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID not set");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: OUTLOOK_SCOPES,
    response_mode: "query",
    state: String(userId),
  });

  return `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeOutlookCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
  name: string;
}> {
  const clientId = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || `${process.env.APP_URL}/api/oauth/outlook/callback`;

  const tokenRes = await fetch(`https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: OUTLOOK_SCOPES,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Outlook token exchange failed: ${err}`);
  }

  const tokens = await tokenRes.json() as any;

  // Get user profile from Microsoft Graph
  const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userRes.json() as any;

  return {
    accessToken: encryptToken(tokens.access_token),
    refreshToken: encryptToken(tokens.refresh_token || ""),
    expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
    email: userInfo.mail || userInfo.userPrincipalName,
    name: userInfo.displayName || userInfo.mail,
  };
}

export async function refreshOutlookToken(encryptedRefreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const refreshToken = decryptToken(encryptedRefreshToken);
  const clientId = process.env.MICROSOFT_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!;

  const res = await fetch(`https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      scope: OUTLOOK_SCOPES,
    }),
  });

  if (!res.ok) throw new Error("Outlook token refresh failed");
  const data = await res.json() as any;

  return {
    accessToken: encryptToken(data.access_token),
    expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
  };
}

export async function getOutlookMessages(
  accessToken: string,
  maxResults = 500,
  skipToken?: string
): Promise<{ messages: any[]; nextLink?: string }> {
  const params = new URLSearchParams({
    $top: String(Math.min(maxResults, 100)),
    $select: "id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview",
    $filter: "isDraft eq false",
    $orderby: "receivedDateTime desc",
  });

  const url = skipToken ||
    `https://graph.microsoft.com/v1.0/me/messages?${params}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Outlook messages fetch failed: ${res.status}`);
  const data = await res.json() as any;

  return {
    messages: data.value || [],
    nextLink: data["@odata.nextLink"],
  };
}

export function parseOutlookMessage(msg: any): {
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  snippet: string;
  messageCount: number;
} {
  return {
    threadId: msg.conversationId || msg.id,
    subject: msg.subject || "(no subject)",
    from: msg.from?.emailAddress?.address || "",
    to: (msg.toRecipients || []).map((r: any) => r.emailAddress?.address).join(", "),
    date: msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date(),
    snippet: msg.bodyPreview || "",
    messageCount: 1,
  };
}
