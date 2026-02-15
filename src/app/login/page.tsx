"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

// Social login disabled - will be enabled when app is published
// import { GoogleSignIn } from "@/components/auth/google-signin"

function LoginForm() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()

    // Handle errors from URL
    useEffect(() => {
        const errorParam = searchParams.get('error')
        if (errorParam) {
            setError(decodeURIComponent(errorParam))
        }
    }, [searchParams])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")
        
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (res.ok) {
                // Dispatch auth state change event to refresh sidebar
                window.dispatchEvent(new CustomEvent('auth-state-changed'));
                router.push('/');
            } else {
                const data = await res.json()
                setError(data.error || 'Invalid credentials');
            }
        } catch {
            setError('Something went wrong');
        } finally {
            setIsLoading(false)
        }
    }

    // Social login disabled - will be enabled when app is published
    /*
    const handleGitHubLogin = async () => {
        setIsLoading(true)
        setError("")
        
        try {
            const res = await fetch('/api/auth/oauth', {
                method: 'POST',
                body: JSON.stringify({ provider: 'github', redirectUrl: '/' }),
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await res.json()
            
            if (data.success && data.authUrl) {
                window.location.href = data.authUrl
            } else {
                setError(data.error || 'Failed to initialize GitHub login')
                setIsLoading(false)
            }
        } catch {
            setError('Failed to connect to GitHub')
            setIsLoading(false)
        }
    }
    */

    return (
        <div className="flex h-screen w-full items-center justify-center bg-muted/40 px-4">
            <Card className="w-full max-w-sm">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl">Login</CardTitle>
                    <CardDescription>
                        Enter your email below to login to your account.
                    </CardDescription>
                </CardHeader>
                
                <CardContent className="grid gap-4">
                    {/* Social login disabled - will be enabled when app is published */}
                    {/*
                    <GoogleSignIn onError={(msg) => { setError(msg); setIsLoading(false); }} />
                    
                    <Button 
                        variant="outline" 
                        onClick={handleGitHubLogin}
                        disabled={isLoading}
                        className="w-full"
                    >
                        <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        Continue with GitHub
                    </Button>
                    
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">
                                Or continue with
                            </span>
                        </div>
                    </div>
                    */}
                    
                    <form onSubmit={handleLogin} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input 
                                id="email" 
                                type="email" 
                                placeholder="m@example.com" 
                                required 
                                value={email} 
                                onChange={e => setEmail(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input 
                                id="password" 
                                type="password" 
                                required 
                                value={password} 
                                onChange={e => setPassword(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        {error && (
                            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}
                        <Button 
                            className="w-full" 
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in...' : 'Sign in'}
                        </Button>
                    </form>
                </CardContent>
                
                <CardFooter className="flex flex-col gap-2">
                    <div className="text-center text-sm text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="underline underline-offset-4 hover:text-primary">
                            Sign up
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center bg-muted/40 px-4">
                <Card className="w-full max-w-sm">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl">Login</CardTitle>
                        <CardDescription>Loading...</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="flex h-10 w-full items-center justify-center">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        }>
            <LoginForm />
        </Suspense>
    )
}
