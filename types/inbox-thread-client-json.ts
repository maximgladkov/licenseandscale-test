export type InboxThreadClientJson = {
  id: string;
  senderHandle: string;
  intent: string | null;
  temperature: string | null;
  isResolved: boolean;
  messages: { id: string; direction: string; content: string }[];
};
