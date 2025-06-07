import { Message } from "telegraf/typings/core/types/typegram";
import { Markup } from "telegraf";
import { InputField, InputFieldProps } from "./input_field";
import { BotContext } from "@/library/telegraf/domain/bot_context";

interface MultiChoiceFieldProps<T> extends InputFieldProps<T[]> {
  buttons: MultichoiceButton<T>[][];
}

export interface MultichoiceButton<T> {
  titleOn: string;
  titleOff?: string;
  value?: T;
  confirm: boolean;
  data: string;
}

interface MultiChoiceFieldData<T> {
  values: T[];
  message?: Message;
}

export class MultiChoiceField<T> extends InputField<T[]> {
  constructor(protected props: MultiChoiceFieldProps<T>) {
    super(props);
  }

  setValues(ctx: BotContext, values: T[]) {
    this.getData(ctx).values = values;
  }

  setMessage(ctx: BotContext, message: Message) {
    this.getData(ctx).message = message;
  }

  async requestInput(ctx: BotContext): Promise<void> {
    const data = this.getData(ctx);

    const markup = Markup.inlineKeyboard(
      this.props.buttons.map((row) => [
        ...row.map((button) =>
          Markup.button.callback(
            button.confirm
              ? button.titleOn
              : data.values.includes(button.value!)
                ? button.titleOn
                : button.titleOff!,
            button.data!,
          ),
        ),
      ]),
    );

    if (data.message) {
      await ctx.telegram.editMessageText(
        data.message.chat.id,
        data.message.message_id,
        undefined,
        this.props.prompt,
        {
          reply_markup: markup.reply_markup,
        },
      );
    } else {
      data.message = await ctx.reply(this.props.prompt, markup);
    }
  }

  async validateMessage(ctx: BotContext): Promise<[T[] | null, boolean]> {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
      await ctx.reply(this.props.errorMessage);
      return [null, false];
    }

    ctx.answerCbQuery();
    const cqData = ctx.callbackQuery.data;
    const button = this.props.buttons.flat().find((button) => {
      return button.data == cqData;
    });

    if (!button) {
      return [null, false];
    }

    const data = this.getData(ctx);
    if (button.confirm) {
      this.clearData(ctx);
      return [data.values, true];
    } else {
      if (data.values.includes(button.value!)) {
        data.values = data.values.filter((val) => val !== button.value!);
      } else {
        data.values.push(button.value!);
      }
      await this.requestInput(ctx);
      return [data.values, false];
    }
  }

  private getData(ctx: BotContext): MultiChoiceFieldData<T> {
    if (!ctx.helper.scene.named.get<MultiChoiceFieldData<T>>(this.id)) {
      ctx.helper.scene.named.set(
        this.id,
        {
          values: [],
          message: undefined,
        },
      );
    }
    return ctx.helper.scene.named.get<MultiChoiceFieldData<T>>(this.id)!;
  }

  private clearData(ctx: BotContext): void {
    ctx.helper.scene.named.set(this.id, undefined);
  }
}