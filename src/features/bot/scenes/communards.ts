import { BotContext } from '@/library/telegraf/domain/bot_context';
import { CommunardsManager } from '@/features/db/communards_manager';
import { Scenes } from 'telegraf';
import { emj } from '../domain/emoji';

// Сцена для добавления коммунара
const addCommunardWizard = new Scenes.WizardScene<BotContext>(
  'addCommunard',
  async (ctx) => {
    await ctx.reply(`${emj.enter} Введи id коммунара для добавления`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply(`${emj.fail} Отправь текстовое сообщение`);
      return;
    }
    const userId = parseInt(ctx.message.text);
    if (isNaN(userId)) {
      await ctx.reply(`${emj.fail} id должен быть числом. Попробуй ещё раз`);
      return;
    }
    await ctx.helper.get(CommunardsManager)!.addCommunard(userId, '');
    await ctx.reply(`${emj.ok} Коммунар ${userId} успешно добавлен!`);
    return ctx.scene.leave();
  },
);

// Сцена для удаления коммунара
const delCommunardWizard = new Scenes.WizardScene<BotContext>(
  'delCommunard',
  async (ctx) => {
    await ctx.reply(`${emj.enter} Введи id или логин коммунара для удаления`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply(`${emj.fail} Отправь текстовое сообщение`);
      return;
    }

    let success = false;
    const manager = ctx.helper.get(CommunardsManager)!;
    if (ctx.message.text.startsWith('@')) {
      success = await manager.delCommunardByUsername(ctx.message.text);
    } else {
      const userId = parseInt(ctx.message.text);
      if (isNaN(userId)) {
        await ctx.reply(`${emj.fail} id должен быть числом. Попробуй ещё раз`);
        return;
      }
      success = await manager.delCommunardByUserId(userId);
    }

    if (success) {
      await ctx.reply(`${emj.ok} Коммунар успешно удален!`);
    } else {
      await ctx.reply(`${emj.fail} Коммунар не найден!`);
    }

    return ctx.scene.leave();
  },
);

// Сцена для установки списка коммунаров
const setCommunardsWizard = new Scenes.WizardScene<BotContext>(
  'setCommunards',
  async (ctx) => {
    await ctx.reply(`${emj.enter} Введи список коммунаров через запятую:`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply(`${emj.fail} Отправь текстовое сообщение.`);
      return;
    }
    const userIds = ctx.message.text
      .split(',')
      .map((login) => login.trim())
      .map(parseInt);

    for (const userId of userIds) {
      if (isNaN(userId)) {
        await ctx.reply(`${emj.fail} id должен быть числом. Попробуй ещё раз`);
        return;
      }
    }
    await ctx.helper.get(CommunardsManager)!.setCommunards(userIds);
    await ctx.reply(`${emj.ok} Список коммунаров успешно обновлен!`);
    return ctx.scene.leave();
  },
);

export { addCommunardWizard, delCommunardWizard, setCommunardsWizard };
