import { Logger } from "tslog";
import { IDB } from "@/domain/models/db";
import Db from "@/library/fsdb";
import { ClassUuid } from "@/library/class_uuid";

@ClassUuid()
export class CommunardsManager {
  constructor(
    private readonly logger: Logger<any>,
    private readonly db: Db<IDB>,
  ) {}

  async addCommunard(login: string): Promise<boolean> {
    if (this.isCommunard(login)) {
      this.logger.info(`Communard ${login} already exists`);
      return false;
    }
    this.db.update((data) => data.communards.push(login));
    this.logger.info(`Communard ${login} added`);
    return true;
  }

  async delCommunard(login: string): Promise<boolean> {
    if (!this.isCommunard(login)) {
      this.logger.info(`Communard ${login} not found`);
      return false;
    }
    this.db.update((data) => {
      data.communards = data.communards.filter((communard) => communard.toLocaleLowerCase() !== login.toLocaleLowerCase());
    });
    this.logger.info(`Communard ${login} deleted`);
    return true;
  }

  getCommunards(): string[] {
    return this.db.data!.communards;
  }

  async setCommunards(names: string[]): Promise<void> {
    this.db.update((data) => data.communards = names);
    this.logger.info(`Communards set to ${names.join(", ")}`);
  }

  isCommunard(login: string): boolean {
    return this.db.data!.communards.map((communard) => communard.toLowerCase()).includes(login.toLowerCase());
  }
}
