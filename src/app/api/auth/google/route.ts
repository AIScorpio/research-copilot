import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/db"
import { handleError, createValidationError, createUnauthorizedError } from "@/lib/error-handler"
import { logger } from "@/lib/logger"
import { generateCSRFToken, setCSRFCookie } from "@/lib/csrf"

// Google JWT token payload structure
interface GoogleJWTPayload {
  iss: string
  azp: string
  aud: string
  sub: string
  email: string
  email_verified: boolean
  name?: string
  picture?: string
  given_name?: string
  family_name?: string
  iat: number
  exp: number
}

// Google's public keys for JWT verification
let googlePublicKeys: Record<string, string> | null = null
let keysExpiry: number = 0

/**
 * Fetch Google's public keys for JWT verification
 * Keys are cached until expiry
 */
async function getGooglePublicKeys(): Promise<Record<string, string>> {
  // Return cached keys if still valid
  if (googlePublicKeys && Date.now() < keysExpiry) {
    return googlePublicKeys
  }

  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch Google public keys: ${response.status}`)
    }

    const data = await response.json()

    // Parse the JWKS response
    const keys: Record<string, string> = {}
    for (const key of data.keys) {
      if (key.kid && key.x5c && key.x5c[0]) {
        // Convert X.509 certificate to PEM format
        const cert = key.x5c[0]
        const pem = `-----BEGIN CERTIFICATE-----\n${cert.match(/.{1,64}/g)?.join("\n")}\n-----END CERTIFICATE-----`
        keys[key.kid] = pem
      }
    }

    googlePublicKeys = keys
    // Cache for 6 hours (Google rotates keys periodically)
    keysExpiry = Date.now() + 6 * 60 * 60 * 1000

    return keys
  } catch (error) {
    logger.error("[Google Auth] Failed to fetch public keys:", error as Record<string, unknown>)
    throw new Error("Failed to fetch Google public keys")
  }
}

/**
 * Verify a Google JWT token
 * Uses Web Crypto API for verification
 */
async function verifyGoogleJWT(credential: string): Promise<GoogleJWTPayload> {
  try {
    // Split the JWT into parts
    const [headerB64, payloadB64, signatureB64] = credential.split(".")

    if (!headerB64 || !payloadB64 || !signatureB64) {
      throw new Error("Invalid JWT format")
    }

    // Decode header to get the key ID
    const headerStr = Buffer.from(headerB64, "base64url").toString()
    const header = JSON.parse(headerStr)
    const kid = header.kid

    if (!kid) {
      throw new Error("JWT header missing key ID")
    }

    // Get Google's public keys
    const publicKeys = await getGooglePublicKeys()
    const publicKeyPem = publicKeys[kid]

    if (!publicKeyPem) {
      throw new Error("Unknown key ID")
    }

    // Import the public key
    const publicKey = await crypto.subtle.importKey(
      "spki",
      pemToArrayBuffer(publicKeyPem),
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["verify"]
    )

    // Verify the signature
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const signature = Buffer.from(signatureB64, "base64url")

    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signature,
      data
    )

    if (!isValid) {
      throw new Error("Invalid JWT signature")
    }

    // Decode and parse the payload
    const payloadStr = Buffer.from(payloadB64, "base64url").toString()
    const payload: GoogleJWTPayload = JSON.parse(payloadStr)

    // Verify the token is not expired
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      throw new Error("Token has expired")
    }

    // Verify the issuer
    if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") {
      throw new Error("Invalid token issuer")
    }

    // Verify the audience (client ID)
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (clientId && payload.aud !== clientId) {
      throw new Error("Invalid token audience")
    }

    // Verify email is verified
    if (!payload.email_verified) {
      throw new Error("Email not verified")
    }

    return payload
  } catch (error) {
    logger.error("[Google Auth] JWT verification failed:", error as Record<string, unknown>)
    throw error
  }
}

/**
 * Convert PEM certificate to ArrayBuffer
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "")

  const binary = Buffer.from(base64, "base64")
  return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength)
}

/**
 * POST /api/auth/google
 * Verify Google JWT and create/link user account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { credential } = body

    if (!credential || typeof credential !== "string") {
      const error = createValidationError("Missing or invalid credential")
      const handled = handleError(error)
      return NextResponse.json(
        { ...handled, success: false },
        { status: handled.statusCode }
      )
    }

    logger.info("[Google Auth] Verifying JWT credential")

    // Verify the Google JWT
    const payload = await verifyGoogleJWT(credential)

    logger.info("[Google Auth] JWT verified for email:", { email: payload.email })

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: payload.email },
    })

    if (user) {
      // User exists - check if they have a Google account linked
      const existingAccount = await prisma.account.findFirst({
        where: {
          userId: user.id,
          provider: "google",
        },
      })

      if (!existingAccount) {
        // Link Google account to existing user
        await prisma.account.create({
          data: {
            userId: user.id,
            type: "oauth",
            provider: "google",
            providerAccountId: payload.sub,
            access_token: credential,
            expires_at: Math.floor(payload.exp),
            token_type: "JWT",
            scope: "openid email profile",
          },
        })
        logger.info("[Google Auth] Linked Google account to existing user:", { userId: user.id })
      } else {
        // Update the access token
        await prisma.account.update({
          where: { id: existingAccount.id },
          data: {
            access_token: credential,
            expires_at: Math.floor(payload.exp),
          },
        })
      }
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          email: payload.email,
          name: payload.name || payload.given_name || null,
          image: payload.picture || null,
          // Generate a random password since it's required
          password: `google_oauth_${Date.now()}_${Math.random().toString(36).substring(2)}`,
          accounts: {
            create: {
              type: "oauth",
              provider: "google",
              providerAccountId: payload.sub,
              access_token: credential,
              expires_at: Math.floor(payload.exp),
              token_type: "JWT",
              scope: "openid email profile",
            },
          },
        },
      })
      logger.info("[Google Auth] Created new user:", { userId: user.id })
    }

    // Set auth cookie
    const cookieStore = await cookies()

    // Generate and set CSRF token
    const csrfToken = await generateCSRFToken()
    setCSRFCookie(cookieStore, csrfToken)

    // Set auth cookie
    cookieStore.set("auth_user", user.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    logger.info("[Google Auth] Authentication successful:", { userId: user.id })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      csrfToken,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("JWT")) {
      const handled = handleError(createUnauthorizedError("Invalid authentication token"))
      return NextResponse.json(
        { ...handled, success: false },
        { status: 401 }
      )
    }

    const handled = handleError(error)
    return NextResponse.json(
      { ...handled, success: false },
      { status: handled.statusCode }
    )
  }
}
