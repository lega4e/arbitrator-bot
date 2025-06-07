function createTelegramMessageLink(
  groupId: number,
  messageId: number,
  topicId?: number | null,
): string {
  const cleanGroupId = String(groupId).replace(/^-100|^-/, '');
  const topicIdStr = !!topicId ? topicId.toString() + '/' : '';
  return `https://t.me/c/${cleanGroupId}/${topicIdStr}${messageId}`;
}

function createUserLink(
  userId: number,
  displayText: any = 'Пользователь',
): string {
  return `<a href="tg://user?id=${userId}">${displayText}</a>`;
}

export { createTelegramMessageLink, createUserLink };
