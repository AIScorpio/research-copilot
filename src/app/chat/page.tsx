"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, Send, User } from "lucide-react"

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! I'm your Research Copilot. Ask me questions about your collected papers, methodologies, or specific topics." }
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                body: JSON.stringify({ messages: [...messages, userMsg] }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error answering that." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] max-w-4xl mx-auto">
            <div className="mb-4">
                <h1 className="text-3xl font-bold tracking-tight">Research Copilot</h1>
                <p className="text-muted-foreground">Chat with your repository</p>
            </div>

            <div className="flex-1 border rounded-lg bg-card shadow-sm overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {m.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Bot className="h-5 w-5 text-primary" />
                                    </div>
                                )}
                                <div className={`px-4 py-2 rounded-lg max-w-[80%] text-sm whitespace-pre-wrap ${m.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                    }`}>
                                    {m.content}
                                </div>
                                {m.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                        <User className="h-5 w-5" />
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={scrollRef} />
                        {isLoading && (
                            <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Bot className="h-5 w-5 text-primary" />
                                </div>
                                <div className="bg-muted px-4 py-2 rounded-lg">
                                    <span className="animate-pulse">Thinking...</span>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t bg-background">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Ask about methodologies, specific papers, or trends..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            disabled={isLoading}
                        />
                        <Button onClick={handleSend} disabled={isLoading} size="icon">
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
