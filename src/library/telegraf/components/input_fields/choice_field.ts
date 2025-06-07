import { BotContext } from "@/library/telegraf/domain/bot_context";
import { Markup } from "telegraf";
import { InputField, InputFieldProps } from "./input_field";

export interface ChoiceFieldProps<T> extends InputFieldProps<T> {
  buttons: Button<T>[][];
}

export interface Button<T> {
  title: string;
  value: T;
  data: string;
}

export class ChoiceField<T> extends InputField<T> {
  constructor(protected props: ChoiceFieldProps<T>) {
    super(props);
  }

  async requestInput(ctx: BotContext): Promise<void> {
    await ctx.reply(
      this.props.prompt,
      Markup.inlineKeyboard(
        this.props.buttons.map((row) => [
          ...row.map((button) =>
            Markup.button.callback(button.title, button.data!),
          ),
        ]),
      ),
    );
  }

  async validateMessage(ctx: BotContext): Promise<[T | null, boolean]> {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
      await ctx.reply(this.props.errorMessage);
      return [null, false];
    }

    ctx.answerCbQuery();
    const data = ctx.callbackQuery.data;
    const button = this.props.buttons.flat().find((button) => {
      return button.data == data;
    });

    return !button ? [null, false] : [button.value, true];
  }
}