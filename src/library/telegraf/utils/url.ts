function createTelegramMessageLink(
  groupId: number,
  messageId: number,
  topicId?: number | null,
): string {
  const cleanGroupId = String(groupId).replace(/^-100|^-/, '');
  const topicIdStr = !!topicId ? topicId.toString() + '/' : '';
  return `https://t.me/c/${cleanGroupId}/${topicIdStr}${messageId}`;
}

export { createTelegramMessageLink };
