import { getClassUuid } from "@/library/class_uuid";
import { Context, Scenes } from "telegraf";
import { SceneWrapper } from "../scenes/scene_wrapper";

declare module "telegraf/typings/scenes" {
  export interface SceneSessionData {
    data: Record<string, any>;
    namedData: Record<string, any>;
    callbacks: Record<string, (ctx: BotContext) => Promise<void>>;
  }
}

export interface BotSceneStackItem {
  sceneName: string;
  step: number;
  sceneWrapper: SceneWrapper;
}

export type BotSceneSessionData = Scenes.WizardSessionData;

export type BotSessionData = Scenes.WizardSession<BotSceneSessionData> & {
  namedData: Record<string, any>;
  data: Record<string, any>;
  sceneStack: BotSceneStackItem[];
};

export type BotContext = Context & {
  scene: Scenes.SceneContextScene<BotContext, BotSceneSessionData>;
  wizard: Scenes.WizardContextWizard<BotContext>;
  session: BotSessionData;
  helper: BotContextHelper;
};

class BotContextHelperNamedData {
  constructor(private readonly namedDataGetter: () => Record<string, any>) {}

  get<T>(key: string): T {
    return this.namedDataGetter()[key] as T;
  }

  set<T>(key: string, value: T) {
    this.namedDataGetter()[key] = value;
  }
}

class BotContextSceneHelper {
  public named: BotContextHelperNamedData;

  constructor(private readonly ctx: BotContext) {
    this.named = new BotContextHelperNamedData(() => ctx.scene.session.namedData);
  }

  get<T>(ctor: new (...args: any[]) => T): T | undefined {
    return this.ctx.scene.session.data[getClassUuid(ctor)] as T | undefined;
  }

  set<T extends object>(value: T) {
    this.ctx.scene.session.data[getClassUuid(value.constructor)] = value;
  }

  putCallback(
    sceneName: string,
    name: string,
    callback: (ctx: BotContext) => Promise<void>,
  ): void {
    this.ctx.scene.session.callbacks[sceneName + "/" + name] = callback;
  }

  callback(
    sceneName: string,
    name: string,
  ): (ctx: BotContext) => Promise<void> {
    return this.ctx.scene.session.callbacks[sceneName + "/" + name];
  }
}

export class BotContextHelper {
  public readonly named: BotContextHelperNamedData;
  public readonly scene: BotContextSceneHelper;

  constructor(private readonly ctx: BotContext) {
    this.named = new BotContextHelperNamedData(() => ctx.session.namedData);
    this.scene = new BotContextSceneHelper(ctx);
  }

  get<T>(ctor: new (...args: any[]) => T): T | undefined {
    return this.ctx.session.data[getClassUuid(ctor)] as T | undefined;
  }

  set<T>(ctor: new (...args: any[]) => T, value: T) {
    this.ctx.session.data[getClassUuid(ctor)] = value;
  }
}