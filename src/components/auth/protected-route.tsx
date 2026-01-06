"use client"

import { useAuthContext } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuthContext()
    const router = useRouter()

    useEffect(() => {
        if (!loading && !user) {
            router.push("/auth")
        }
    }, [user, loading, router])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!user) {
        return null // Will redirect via effect
    }

    return <>{children}</>
}
