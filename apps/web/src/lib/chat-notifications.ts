const changeEvent = "engplatform2:chat-unread-changed";

const key = (companyId: string, userId: string) => `engplatform2:chat-unread:${companyId}:${userId}`;

export const chatUnreadChangeEvent = changeEvent;

export function getUnreadChatCount(companyId: string, userId: string) {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(key(companyId, userId)) ?? 0) || 0;
}

export function addUnreadChatMessage(companyId: string, userId: string) {
  if (typeof window === "undefined") return 0;
  const count = getUnreadChatCount(companyId, userId) + 1;
  window.localStorage.setItem(key(companyId, userId), String(count));
  window.dispatchEvent(new Event(changeEvent));
  return count;
}

export function markChatRead(companyId: string, userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key(companyId, userId));
  window.dispatchEvent(new Event(changeEvent));
}
