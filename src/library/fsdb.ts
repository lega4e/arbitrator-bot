import fs from 'fs/promises';

export default class Db<T> {
  public data!: T;

  constructor(
    private readonly filename: string,
    private readonly defaultData: T,
  ) {
    this.data = defaultData;
  }

  async save() {
    await fs.writeFile(this.filename, JSON.stringify(this.data, null, 2));
  }

  async update(updater: (data: T) => void) {
    updater(this.data);
    await this.save();
  }

  async load() {
    let data;
    try {
      data = await fs.readFile(this.filename, 'utf8');
    } catch (error) {
      this.data = this.defaultData;
      await this.save();
      return;
    }
    this.data = JSON.parse(data);
  }
}
