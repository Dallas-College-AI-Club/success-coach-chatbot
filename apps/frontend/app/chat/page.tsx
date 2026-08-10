import { ChatScreen } from "@/features/chat/chat-screen";

// The planning chat. The onboarding recap arrives as the coach's first turn
// (features/chat/seed.ts), so this page keeps the promise the hand-off copy
// makes rather than restating it: the student's answers really do carry over.
export default function ChatPage() {
  return <ChatScreen />;
}
