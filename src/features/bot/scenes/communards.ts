import { BotContext } from "@/library/telegraf/domain/bot_context";
import { CommunardsManager } from "@/features/db/communards_manager";
import { Scenes } from "telegraf";
import { emj } from "../domain/emoji";

// Сцена для добавления коммунара
const addCommunardWizard = new Scenes.WizardScene<BotContext>(
  "addCommunard",
  async (ctx) => {
    await ctx.reply(`${emj.enter} Введите логин коммунара для добавления:`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply(`${emj.fail} Пожалуйста, отправьте текстовое сообщение.`);
      return;
    }
    const login = ctx.message.text;
    if (!/^@[`a-zA-Z0-9_]{4,}$/.test(login)) {
      await ctx.reply(`${emj.fail} Логин должен содержать только латинские буквы, цифры и символы подчеркивания, начинаться с @ и быть не менее 4 символов.\n\nПопробуй ещё раз.`);
      return;
    }
    await ctx.helper.get(CommunardsManager)!.addCommunard(login);
    await ctx.reply(`${emj.ok} Коммунар ${login} успешно добавлен!`);
    return ctx.scene.leave();
  }
);

// Сцена для удаления коммунара
const delCommunardWizard = new Scenes.WizardScene<BotContext>(
  "delCommunard",
  async (ctx) => {
    await ctx.reply(`${emj.enter} Введите логин коммунара для удаления:`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply(`${emj.fail} Пожалуйста, отправьте текстовое сообщение.`);
      return;
    }
    const login = ctx.message.text;
    const success = await ctx.helper.get(CommunardsManager)!.delCommunard(login);
    if (success) {
      await ctx.reply(`${emj.ok} Коммунар ${login} успешно удален!`);
    } else {
      await ctx.reply(`${emj.fail} Коммунар ${login} не найден!`);
    }
    return ctx.scene.leave();
  }
);

// Сцена для установки списка коммунаров
const setCommunardsWizard = new Scenes.WizardScene<BotContext>(
  "setCommunards",
  async (ctx) => {
    await ctx.reply(`${emj.enter} Введите список коммунаров через запятую:`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) {
      await ctx.reply(`${emj.fail} Пожалуйста, отправьте текстовое сообщение.`);
      return;
    }
    const login = ctx.message.text.split(",").map((login) => login.trim());
    for (const l of login) {
      if (!/^@[`a-zA-Z0-9_]{4,}$/.test(l)) {
        await ctx.reply(`${emj.fail} Логин (${l}) должен содержать только латинские буквы, цифры и символы подчеркивания, начинаться с @ и быть не менее 4 символов.\n\nПопробуй ещё раз.`);
        return;
      }
    }
    await ctx.helper.get(CommunardsManager)!.setCommunards(login);
    await ctx.reply(`${emj.ok} Список коммунаров успешно обновлен!`);
    return ctx.scene.leave();
  }
);

export { addCommunardWizard, delCommunardWizard, setCommunardsWizard };