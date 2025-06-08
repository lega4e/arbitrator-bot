import { BotContext } from '@/library/telegraf/domain/bot_context';
import CommunardsManager from '@/features/db/communards_manager';
import { Scenes } from 'telegraf';
import { emj } from '../domain/emoji';
import { UserIdValidator, UserValidator } from './utils';

// Сцена для добавления коммунара
const addCommunardWizard = new Scenes.WizardScene<BotContext>(
  'addCommunard',
  async (ctx) => {
    await ctx.reply(`${emj.enter} Введи id коммунара для добавления`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    new UserIdValidator().validate(ctx).execute(ctx, async (ctx, value) => {
      await ctx.helper.get(CommunardsManager)!.addCommunard(value, '');
      await ctx.reply(`${emj.ok} Коммунар ${value} успешно добавлен!`);
      return ctx.scene.leave();
    });
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
    new UserValidator().validate(ctx).execute(ctx, async (ctx, value) => {
      const manager = ctx.helper.get(CommunardsManager)!;

      let success =
        typeof value === 'string'
          ? await manager.delCommunardByUsername(value)
          : await manager.delCommunardByUserId(value);

      success
        ? await ctx.reply(`${emj.ok} Коммунар успешно удален!`)
        : await ctx.reply(`${emj.fail} Коммунар не найден!`);

      return ctx.scene.leave();
    });
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
