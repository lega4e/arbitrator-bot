import { Message } from "telegraf/typings/core/types/typegram";

export abstract class Validator<T, U> {
  abstract validate(value: T): [U | null, boolean];
}

export class TextValidator extends Validator<Message, string> {
  validate(m: Message): [string | null, boolean] {
    return !m || !("text" in m) ? [null, false] : [m.text, true];
  }
}

export class FunValidator<T, U> extends Validator<T, U> {
  constructor(private readonly validator: (value: T) => [U | null, boolean]) {
    super();
  }

  validate(value: T): [U | null, boolean] {
    return this.validator(value);
  }
}

export class TFunValidator<T> extends Validator<Message, T> {
  constructor(private readonly validator: (value: string) => [T | null, boolean]) {
    super();
  }

  validate(value: Message): [T | null, boolean] {
    const [text, isValid] = new TextValidator().validate(value);
    if (!isValid || !text) {
      return [null, false];
    }

    return this.validator(text);
  }
}
