"use client"

import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useDebouncedCallback } from "use-debounce"

export function SearchBar() {
    const searchParams = useSearchParams()
    const { replace } = useRouter()
    const pathname = "/papers"

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams)
        if (term) {
            params.set("search", term)
        } else {
            params.delete("search")
        }
        replace(`${pathname}?${params.toString()}`)
    }, 300)

    return (
        <div className="relative flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Search papers..."
                className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
                defaultValue={searchParams.get("search")?.toString()}
                onChange={(e) => handleSearch(e.target.value)}
            />
        </div>
    )
}
