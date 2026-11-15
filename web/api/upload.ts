import type { IncomingMessage, ServerResponse } from "node:http";

interface ApiRequest extends IncomingMessage {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

const PINATA_JWT = process.env.PINATA_JWT;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];

// Simple in-memory rate limiter (resets on cold start)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function hasAllowedMultipartPart(body: Buffer): boolean {
  // Inspect multipart part headers (first 2 KB) for Content-Type: image/jpeg | image/png | application/pdf
  const head = body.subarray(0, 2048).toString("latin1");
  const match = /content-type:\s*([a-z0-9/+.-]+)/i.exec(head);
  if (!match?.[1]) return false;
  return ALLOWED_MIME_TYPES.includes(match[1].toLowerCase());
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!PINATA_JWT) {
    return res.status(503).json({
      error: "IPFS upload service is not configured on this deployment. You can paste a pre-pinned CID directly.",
    });
  }

  const forwarded = req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  const ip = firstForwarded?.trim() || req.socket?.remoteAddress || "unknown";

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute and retry." });
  }

  try {
    const rawContentType = req.headers["content-type"];
    const contentType = Array.isArray(rawContentType) ? rawContentType[0] ?? "" : rawContentType ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return res.status(400).json({ error: "Expected multipart/form-data" });
    }

    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalSize += buf.length;
      if (totalSize > MAX_FILE_SIZE) {
        return res.status(413).json({ error: "File too large. Maximum allowed size is 5 MB." });
      }
      chunks.push(buf);
    }

    const body = Buffer.concat(chunks);
    if (!hasAllowedMultipartPart(body)) {
      return res.status(415).json({
        error: "Unsupported file type. Only JPEG, PNG, and PDF files are permitted.",
      });
    }

    const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        "Content-Type": contentType,
      },
      body,
    });

    if (!pinataRes.ok) {
      const text = await pinataRes.text();
      console.error("Pinata upload error:", text);
      return res.status(502).json({ error: "IPFS upload failed at upstream provider." });
    }

    const data = (await pinataRes.json()) as { IpfsHash: string };
    return res.status(200).json({
      cid: `ipfs://${data.IpfsHash}`,
      ipfsHash: data.IpfsHash,
      gateway: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
    });
  } catch (err) {
    console.error("Upload handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
