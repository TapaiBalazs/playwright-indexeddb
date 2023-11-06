import { test } from '@playwright/test';
import { Page } from 'playwright';
import { CrudHelper } from './crud-helper';
import { MetadataHelper } from './metadata-helper';

export class PlaywrightIdbStoreHelper {

  private readonly crud = new CrudHelper(this.page, this.databaseName, this.storeName);
  private readonly metadata = new MetadataHelper(this.page, this.databaseName, this.storeName);
  constructor(
    private readonly page: Page,
    private readonly databaseName: string,
    private readonly storeName: string
  ) {
  }

  readItem<T>(key: string | number): Promise<T> {
    return test.step(`Read "${key}" from "${this.storeName}" ObjectStore`, () =>
      this.crud.readItem(key));
  }

  deleteItem(key: string | number): Promise<PlaywrightIdbStoreHelper> {
    return test.step(`Delete "${key}" from "${this.storeName}" ObjectStore`, () =>
      this.crud.deleteItem(key).then(() => this));
  }

  createItem<T>(
    key: string | number,
    value: T
  ): Promise<PlaywrightIdbStoreHelper> {
    return test.step(`Create "${key}" with value "${value}" in "${this.storeName}" ObjectStore`, () =>
      this.crud.createItem(key, value).then(() => this));
  }

  addItem<T>(value: T): Promise<PlaywrightIdbStoreHelper> {
    return test.step(`Add entry "${value}" in "${this.storeName}" ObjectStore`, () =>
      this.crud.addItem<T>(value).then(() => this));
  }

  updateItem(
    key: string | number,
    value: unknown
  ): Promise<PlaywrightIdbStoreHelper> {
    return test.step(`Update "${key}" with value "${value}" in "${this.storeName}" ObjectStore`, () =>
      this.crud.updateItem(key, value).then(() => this));
  }

  keys(): Promise<(string | number)[]> {
    return test.step(`Retrieving all keys from ${this.storeName} ObjectStore`, () =>
      this.metadata.getKeys());
  }

  values<T>(): Promise<T[]> {
    return test.step(`Retrieving all values from ${this.storeName} ObjectStore`, () =>
      this.metadata.getValues());
  }
}
