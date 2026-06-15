interface SupportMessage {
  id: number;
  userId: number;
  content: string;
  isAdminReply: boolean;
  createdAt: string;
}

export function useSupportMessages(enabled: boolean = true) {
  return { data: [], isLoading: false, isError: false, error: null };
}

export function useSendSupportMessage() {
  return {
    mutate: (content: string) => {},
    isPending: false,
  };
}

export type { SupportMessage };
