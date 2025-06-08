import { BotContext } from '@/library/telegraf/domain/bot_context';
import {
  TextValidator,
  Validator,
  ValidatorReuslt as ValidatorResult,
} from '@/library/telegraf/helpers/validators/validators';
import { emj } from '../domain/emoji';

export class UserValidator extends Validator<BotContext, string | number> {
  constructor() {
    super();
  }

  validate(ctx: BotContext): ValidatorResult<string | number> {
    return new TextValidator(`${emj.fail} Сообщение должно быть текстом`)
      .validate(ctx)
      .validate((text): [string | number | null, boolean, string | null] => {
        if (/^@[a-zA-Z0-9_]{4,}$/.test(text)) {
          return [text.slice(1), true, null];
        } else if (!isNaN(parseInt(text))) {
          return [parseInt(text), true, null];
        }
        return [
          null,
          false,
          `${emj.fail} Строка должна быть логином (@login) или числом — ID пользователя. ` +
            'Попробуй ещё раз',
        ];
      });
  }
}

export class UserIdValidator extends Validator<BotContext, number> {
  validate(ctx: BotContext): ValidatorResult<number> {
    return new TextValidator(`${emj.fail} Сообщение должно быть числом`)
      .validate(ctx)
      .validate((text) => {
        const userId = parseInt(text);
        return [
          userId,
          !isNaN(userId),
          `${emj.fail} Текст должен быть числом. Попробуй ещё раз`,
        ];
      });
  }
}
