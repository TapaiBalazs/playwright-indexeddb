# @btapai/playwright-indexeddb

`@btapai/playwright-indexeddb` is a Playwright helper library for preparing,
inspecting, and manipulating IndexedDB state from tests.

The main entry point is `PlaywrightIdbHelper`:

```ts
import { PlaywrightIdbHelper } from '@btapai/playwright-indexeddb';
```

The examples below are based on the real end-to-end usage in
`apps/showcase-e2e/src/playwright-indexeddb.spec.ts`.

## Best practice before initialization

Before calling `init()`, delete the IndexedDB database you want to use in the
test. This keeps setup deterministic and avoids stale data or leftover schema
from previous test runs.

Recommended setup pattern:

```ts
const playwrightIdb = new PlaywrightIdbHelper(page);

await page.goto('/');
await playwrightIdb.deleteDatabase('FORM_CACHE');
await playwrightIdb.init('FORM_CACHE');
await playwrightIdb.createObjectStore('user_form_store');
```

## How to clear a database?

The library supports both clearing store contents and deleting the whole
database.

### Clear the contents of a store through the library

If your test only needs an empty object store, delete each key through the
store helper:

```ts
const playwrightIdb = new PlaywrightIdbHelper(page);

await page.goto('/');
await playwrightIdb.deleteDatabase('FORM_CACHE');
await playwrightIdb.init('FORM_CACHE');
await playwrightIdb.createObjectStore('user_form_store');

const store = playwrightIdb.getStore('user_form_store');
for (const key of await store.keys()) {
  await store.deleteItem(key);
}

expect(await store.keys()).toHaveLength(0);
```

This matches the form showcase flow where the stored `user_form` entry is
deleted and the store becomes empty again.

### Delete the whole IndexedDB database through Playwright

If you need to remove the whole IndexedDB database, call
`deleteDatabase()` on `PlaywrightIdbHelper` before you initialize the
database:

```ts
const playwrightIdb = new PlaywrightIdbHelper(page);

await page.goto('/');
await playwrightIdb.deleteDatabase('FORM_CACHE');
```

This removes the full database, including every object store inside it, not
just the current store.

After deletion, initialize the same helper and recreate the store if your test
needs the database again:

```ts
await playwrightIdb.init('FORM_CACHE');
await playwrightIdb.createObjectStore('user_form_store');
```

## How to create a database connection?

Create a Playwright page, navigate to the application, instantiate
`PlaywrightIdbHelper`, and call `init()`.

```ts
const page = await browser.newPage();
await page.goto('/');

const playwrightIdb = new PlaywrightIdbHelper(page);
await playwrightIdb.deleteDatabase('FORM_CACHE');
await playwrightIdb.init('FORM_CACHE');
```

Important details:

- Call `page.goto()` before `init()`, otherwise the browser context is not
  ready for IndexedDB access.
- `init()` should be called once per helper instance.
- You can optionally pass a version if your test needs an explicit database
  version:

```ts
await playwrightIdb.deleteDatabase('FORM_CACHE');
await playwrightIdb.init('FORM_CACHE', 1);
```

## How to create an Object Store?

After initializing the database, create an object store with
`createObjectStore()`.

### Standard store with explicit keys

```ts
await playwrightIdb.deleteDatabase('FORM_CACHE');
await playwrightIdb.init('FORM_CACHE');
const formStore = await playwrightIdb.createObjectStore('user_form_store');
```

### Store with IndexedDB options

For auto-increment stores, pass the normal `IDBObjectStoreParameters`:

```ts
await playwrightIdb.deleteDatabase('AUTO_INCREMENT');
await playwrightIdb.init('AUTO_INCREMENT');
const queueStore = await playwrightIdb.createObjectStore('store', {
  autoIncrement: true,
});
```

Once created, you can fetch the same helper later with `getStore()`:

```ts
const queueStore = playwrightIdb.getStore('store');
```

## How to make CRUD operations on an Object Store?

The store helper exposes `createItem`, `readItem`, `updateItem`, and
`deleteItem`.

### Create

Use `createItem(key, value)` for stores that use explicit keys:

```ts
await playwrightIdb
  .getStore('user_form_store')
  .createItem('user_form', {
    firstName: 'John',
    lastName: 'McClane',
    country: 'USA',
    city: 'New York',
  });
```

### Read

Use `readItem(key)` to fetch the stored value:

```ts
const savedForm = await playwrightIdb
  .getStore('user_form_store')
  .readItem<{
    firstName: string;
    lastName: string;
    country: string;
    city: string;
  }>('user_form');

expect(savedForm).toEqual({
  firstName: 'John',
  lastName: 'McClane',
  country: 'USA',
  city: 'New York',
});
```

This is the same pattern used by the showcase e2e tests when they poll the
database to verify that form values were written.

### Update

Use `updateItem(key, value)` to replace the stored value:

```ts
await playwrightIdb.getStore('store').updateItem(2, 'updated-test2');
```

### Delete

Use `deleteItem(key)` to remove a value:

```ts
await playwrightIdb.getStore('store').deleteItem(2);
```

`deleteItem()` returns the same store helper, so you can immediately continue
with metadata reads:

```ts
const keysAfterDeletion = await playwrightIdb
  .getStore('user_form_store')
  .deleteItem('user_form')
  .then((store) => store.keys());
```

### Read all keys and values

Use `keys()` and `values()` when you want to inspect the full store content:

```ts
const store = playwrightIdb.getStore('store');

expect(await store.keys()).toEqual([1, 2, 3]);
expect(await store.values<string>()).toEqual(['test', 'test2', '1337']);
```

## How to handle Object Stores with autoIncrement?

Auto-increment stores are useful for queue-like data where IndexedDB generates
the numeric keys for you.

### 1. Create the store with `autoIncrement: true`

```ts
await page.goto('/playwright-indexeddb/auto-increment');

const playwrightIdb = new PlaywrightIdbHelper(page);
await playwrightIdb.deleteDatabase('AUTO_INCREMENT');
await playwrightIdb.init('AUTO_INCREMENT');

const store = await playwrightIdb.createObjectStore('store', {
  autoIncrement: true,
});
```

### 2. Append values with `addItem()`

```ts
await store.addItem('test');
await store.addItem('test2');
await store.addItem('1337');
```

### 3. Inspect the generated keys and values

```ts
expect(await store.keys()).toEqual([1, 2, 3]);
expect(await store.values<string>()).toEqual(['test', 'test2', '1337']);
```

### 4. Update or delete entries by numeric key

```ts
await store.updateItem(2, 'updated-test2');
await store.deleteItem(3);
```

### 5. Verify application behavior against IndexedDB state

This is a common test pattern from the showcase app:

```ts
await expect.poll(async () => store.values<string>()).toEqual([
  'test',
  'test2',
  '1337',
  'something',
  'anything',
  'whatever',
  'seriously',
]);
```

This makes the library useful both for setup and for validating that UI
actions changed IndexedDB exactly as expected.
