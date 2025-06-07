import { Scenes } from 'telegraf';
import { BotContext } from '@/library/telegraf/domain/bot_context';

export abstract class SceneWrapper {
  readonly sceneName: string;
  private callbackInitialized = false;

  constructor(sceneName: string) {
    this.sceneName = sceneName;
  }

  abstract get scene(): Scenes.WizardScene<BotContext>;

  async enter(
    ctx: BotContext,
    onLeave?: (ctx: BotContext) => Promise<void>,
  ): Promise<void> {
    if (!this.callbackInitialized && onLeave) {
      this.callbackInitialized = true;
      this.scene.leave((ctx) => onLeave(ctx));
    }
    await ctx.scene.enter(this.sceneName);
  }
}
