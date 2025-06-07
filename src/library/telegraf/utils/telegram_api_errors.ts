import { TelegramError } from 'telegraf';

export async function ignoreTgError(
  action: () => Promise<void>,
  message: string | null = null,
) {
  try {
    await action();
  } catch (error) {
    if (
      error instanceof TelegramError &&
      error.code === 400 &&
      (!message || error.description.includes(message))
    ) {
      return;
    }
    throw error;
  }
}

export async function ignoreMessageNotModified(action: () => Promise<void>) {
  await ignoreTgError(action, 'message is not modified');
}
