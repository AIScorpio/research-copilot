"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"

interface CollectionCalendarProps {
    dailyStats: Record<string, number>
    trigger: React.ReactNode
}

export function CollectionCalendar({ dailyStats, trigger }: CollectionCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date())

    // Calendar logic
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfMonth = new Date(year, month, 1).getDay()

    const monthName = currentDate.toLocaleString('default', { month: 'long' })

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
    const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i)

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-md border-indigo-500/20">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                        <CalendarIcon className="h-5 w-5" />
                        Collection History
                    </DialogTitle>
                </DialogHeader>

                <div className="p-4 bg-muted/30 rounded-xl border border-indigo-500/10">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-sm">{monthName} {year}</h4>
                        <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-tighter">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {blanks.map(b => <div key={`b-${b}`} className="aspect-square" />)}
                        {days.map(day => {
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                            const count = dailyStats[dateStr] || 0
                            const isToday = new Date().toISOString().split('T')[0] === dateStr

                            return (
                                <div
                                    key={day}
                                    className={`relative aspect-square flex flex-col items-center justify-center rounded-md border transition-all
                    ${count > 0 ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-background/20 border-transparent'}
                    ${isToday ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                    ${count > 5 ? 'bg-indigo-500/30' : ''}
                  `}
                                >
                                    <span className="text-[10px] font-medium">{day}</span>
                                    {count > 0 && (
                                        <span className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400 leading-none">
                                            {count}
                                        </span>
                                    )}
                                    {count > 0 && (
                                        <div className="absolute -top-1 -right-1 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="flex justify-center gap-4 text-[10px] text-muted-foreground mt-2">
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm bg-indigo-500/10 border border-indigo-500/30" />
                        <span>1-4 Papers</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm bg-indigo-500/30 border border-indigo-500/30" />
                        <span>5+ Papers</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
