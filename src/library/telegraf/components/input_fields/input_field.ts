import { BotContext } from "@/library/telegraf/domain/bot_context";
import { Validator } from "@/library/telegraf/helpers/validators/validators";
import { Message } from "telegraf/typings/core/types/typegram";
import { v4 as uuidv4 } from "uuid";

export interface InputFieldProps<T> {
  prompt: string;
  validator?: Validator<Message, T>;
  errorMessage: string;
}

export class InputField<T> {
  public id: string;

  constructor(protected props: InputFieldProps<T>) {
    this.id = uuidv4();
  }

  async requestInput(ctx: BotContext): Promise<void> {
    await ctx.reply(this.props.prompt);
  }

  async validateMessage(ctx: BotContext): Promise<[T | null, boolean]> {
    if (!this.props.validator) {
      return [ctx.message! as T, true];
    }

    const [value, isValid] = this.props.validator.validate(ctx.message!);
    if (!isValid) {
      await ctx.reply(this.props.errorMessage);
      return [null, false];
    }

    return [value, true];
  }
}