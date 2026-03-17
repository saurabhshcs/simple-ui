export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-accent flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
        AI
      </div>
      <div className="bg-ai-bubble rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-5">
          <span className="w-2 h-2 rounded-full bg-text-secondary animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 rounded-full bg-text-secondary animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 rounded-full bg-text-secondary animate-bounce" />
        </div>
      </div>
    </div>
  );
}
