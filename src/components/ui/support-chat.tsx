import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useSupportMessages, useSendSupportMessage } from "@/hooks/use-support-chat";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Loader2, Headphones, LogIn } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export function SupportChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: messages, isLoading: messagesLoading } = useSupportMessages(!!user);
  const sendMutation = useSendSupportMessage();

  // Count unread admin replies (messages since last user message)
  const unreadCount = (() => {
    if (!messages?.length) return 0;
    let count = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].isAdminReply) count++;
      else break;
    }
    return isOpen ? 0 : count;
  })();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || sendMutation.isPending) return;

    sendMutation.mutate(trimmed, {
      onSuccess: () => setMessage(""),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Show limited UI for non-logged-in users
  if (!user) {
    return (
      <>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg transition-all duration-300 hover:scale-105 hover:bg-primary/90`}
          aria-label="Buka bantuan"
        >
          {isOpen ? (
            <X className="h-5 w-5 text-white" />
          ) : (
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
          )}
        </button>

        {isOpen && (
          <div className="fixed bottom-24 right-6 z-50 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
            <div className="flex items-center gap-3 bg-primary px-4 py-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20">
                <Headphones className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-primary-foreground">Bantuan SWAPPY</h3>
                <p className="text-xs text-primary-foreground/70">Tim support siap membantu Anda</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <LogIn className="h-7 w-7 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Login untuk mengakses bantuan</p>
              <p className="text-xs text-muted-foreground mb-5">Silakan login terlebih dahulu agar tim support bisa membantu Anda.</p>
              <Link href="/login">
                <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => setIsOpen(false)}>
                  <LogIn className="mr-2 h-4 w-4" /> Masuk / Daftar
                </Button>
              </Link>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105 ${
          isOpen
            ? "h-12 w-12 bg-gray-600 hover:bg-gray-700"
            : "h-14 w-14 bg-primary hover:bg-primary/90"
        }`}
        aria-label={isOpen ? "Tutup bantuan" : "Buka bantuan"}
      >
        {isOpen ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6 text-primary-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Popup */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl sm:w-[400px]">
          {/* Header */}
          <div className="flex items-center gap-3 bg-primary px-4 py-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20">
              <Headphones className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-primary-foreground">
                Bantuan SWAPPY
              </h3>
              <p className="text-xs text-primary-foreground/70">
                Tim support siap membantu Anda
              </p>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex h-[350px] flex-col overflow-y-auto bg-gray-50 p-4">
            {messagesLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !messages?.length ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <MessageCircle className="h-7 w-7 text-primary/50" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  Butuh bantuan?
                </p>
                <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                  Kirim pesan ke tim support SWAPPY. Kami akan membalas secepat
                  mungkin.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isMe = !msg.isAdminReply;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                          isMe
                            ? "rounded-br-sm bg-primary text-primary-foreground"
                            : "rounded-bl-sm border border-border bg-white text-foreground shadow-sm"
                        }`}
                      >
                        {!isMe && (
                          <span className="mb-0.5 block text-[10px] font-semibold text-primary">
                            Admin SWAPPY
                          </span>
                        )}
                        <p className="text-sm break-words">{msg.content}</p>
                        <span
                          className={`mt-1 block text-[10px] ${
                            isMe
                              ? "text-right text-primary-foreground/60"
                              : "text-muted-foreground"
                          }`}
                        >
                          {format(new Date(msg.createdAt), "HH:mm")}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-border bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik pesan bantuan..."
                className="h-10 flex-1 rounded-full border border-border bg-gray-50 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40 focus:bg-white focus:ring-1 focus:ring-primary/20"
                disabled={sendMutation.isPending}
              />
              <Button
                onClick={handleSend}
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full bg-primary shadow-sm hover:bg-primary/90"
                disabled={!message.trim() || sendMutation.isPending}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {sendMutation.isError && (
              <p className="mt-2 text-center text-xs text-red-500">
                Gagal mengirim. Coba lagi.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
