import { Message } from 'telegraf/typings/core/types/typegram';
import { BotContext } from '../../domain/bot_context';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';

export class ValidatorReuslt<T> {
  constructor(
    public readonly value: T | null,
    public readonly isValid: boolean,
    public readonly error: string | null = null,
  ) {}

  validate<U>(
    validator:
      | Validator<T, U>
      | ((value: T) => [U | null, boolean, string | null]),
  ): ValidatorReuslt<U> {
    if (!this.isValid) {
      return new ValidatorReuslt<U>(null, false, this.error);
    }

    if (typeof validator === 'function') {
      const [result, isValid, error] = validator(this.value!);
      return new ValidatorReuslt<U>(result, isValid, error);
    } else {
      return validator.validate(this.value!);
    }
  }

  execute(
    ctx: BotContext,
    onSuccess?: (ctx: BotContext, value: T) => void,
    extra?: ExtraReplyMessage,
  ): void {
    if (!this.isValid) {
      ctx.reply(this.error!, extra);
    } else {
      onSuccess?.(ctx, this.value!);
    }
  }
}

export abstract class Validator<T, U> {
  abstract validate(value: T): ValidatorReuslt<U>;
}

export class TextValidator extends Validator<BotContext, string> {
  constructor(
    private readonly error: string = 'Сообщение должно быть текстом',
  ) {
    super();
  }

  validate(ctx: BotContext): ValidatorReuslt<string> {
    return !ctx.message || !('text' in ctx.message)
      ? new ValidatorReuslt<string>(null, false, this.error)
      : new ValidatorReuslt<string>(ctx.message.text, true);
  }
}

export class FunValidator<T, U> extends Validator<T, U> {
  constructor(private readonly validator: (value: T) => [U | null, boolean]) {
    super();
  }

  validate(value: T): ValidatorReuslt<U> {
    const [result, isValid] = this.validator(value);
    return isValid && result
      ? new ValidatorReuslt<U>(result, true)
      : new ValidatorReuslt<U>(null, false);
  }
}
