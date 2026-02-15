"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
            context?: string
            use_fedcm_for_prompt?: boolean
          }) => void
          renderButton: (
            element: HTMLElement,
            config: {
              type?: "standard" | "icon"
              theme?: "outline" | "filled_blue" | "filled_black"
              size?: "large" | "medium" | "small"
              text?: "signin_with" | "signup_with" | "continue_with" | "signin"
              shape?: "rectangular" | "pill" | "circle" | "square"
              logo_alignment?: "left" | "center"
              width?: string
              locale?: string
            }
          ) => void
          prompt: () => void
        }
      }
    }
  }
}

interface GoogleSignInProps {
  onError?: (error: string) => void
}

export function GoogleSignIn({ onError }: GoogleSignInProps) {
  const router = useRouter()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

    if (!clientId) {
      console.error("[Google Sign-In] NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set")
      onError?.("Google Sign-In is not configured")
      setIsLoading(false)
      return
    }

    // Load Google Identity Services script
    const existingScript = document.getElementById("google-identity-script")
    if (!existingScript) {
      const script = document.createElement("script")
      script.id = "google-identity-script"
      script.src = "https://accounts.google.com/gsi/client"
      script.async = true
      script.defer = true
      script.onload = () => setScriptLoaded(true)
      script.onerror = () => {
        console.error("[Google Sign-In] Failed to load Google script")
        onError?.("Failed to load Google Sign-In")
        setIsLoading(false)
      }
      document.body.appendChild(script)
    } else {
      setScriptLoaded(true)
    }
  }, [onError])

  useEffect(() => {
    if (!scriptLoaded || !buttonRef.current) return

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) return

    const handleCredentialResponse = async (response: { credential: string }) => {
      setIsLoading(true)

      try {
        // Send the JWT credential to the server for verification
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credential: response.credential,
          }),
        })

        const data = await res.json()

        if (res.ok && data.success) {
          // Redirect to home page on success
          router.push("/")
          router.refresh()
        } else {
          const errorMessage = data.error || "Authentication failed"
          console.error("[Google Sign-In] Server error:", errorMessage)
          onError?.(errorMessage)
        }
      } catch (error) {
        console.error("[Google Sign-In] Network error:", error)
        onError?.("Network error. Please try again.")
      } finally {
        setIsLoading(false)
      }
    }

    // Initialize Google Identity Services
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        context: "signin",
        use_fedcm_for_prompt: true,
      })

      // Render the Google Sign-In button
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "center",
        width: "100%",
        locale: "en",
      })

      setIsLoading(false)
    }
  }, [scriptLoaded, router, onError])

  return (
    <div className="w-full">
      {isLoading && (
        <div className="flex h-10 w-full items-center justify-center rounded-md border border-input bg-background">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      <div
        ref={buttonRef}
        className={`w-full ${isLoading ? "hidden" : "block"}`}
        style={{ minHeight: "40px" }}
      />
    </div>
  )
}
