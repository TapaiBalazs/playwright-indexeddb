import { PlaywrightIdbHelper } from '@btapai/playwright-indexeddb';
import { expect, Locator, test } from '@playwright/test';
import { Page } from 'playwright';

test.describe('@btapai/playwright-indexeddb', () => {
  test.describe('key-value pair based databases', () => {
    const IDB_DATABASE_NAME = 'FORM_CACHE';
    const IDB_DATABASE_STORE_NAME = 'user_form_store';
    const IDB_STORE_KEY_NAME = 'user_form';
    let page: Page;
    let playwrightIdb: PlaywrightIdbHelper;

    test.beforeEach(async ({ browser }) => {
      page = await browser.newPage();
      playwrightIdb = new PlaywrightIdbHelper(page);

      await page.goto('/');

      await playwrightIdb.init(IDB_DATABASE_NAME);
      await playwrightIdb.createObjectStore(IDB_DATABASE_STORE_NAME);
    });

    test('entering data into the form saves it to the indexedDb', async () => {
      await page.goto('/');
      await expect(page).toHaveURL('/playwright-indexeddb/key-value-pairs');

      await fillInputFields(page, 'Hans', 'Grüber', 'Germany', 'Berlin');

      await expect
        .poll(async () =>
          playwrightIdb
            .getStore(IDB_DATABASE_STORE_NAME)
            .readItem(IDB_STORE_KEY_NAME)
        )
        .toEqual({
          firstName: 'Hans',
          lastName: 'Grüber',
          country: 'Germany',
          city: 'Berlin',
          address: '',
          addressOptional: '',
        });
    });

    test(`when the indexedDb is deleted manually and then the page reloaded, the form does not populate`, async () => {
      await page.goto('/');
      await expect(page).toHaveURL('/playwright-indexeddb/key-value-pairs');

      const inputs = await fillInputFields(
        page,
        'Hans',
        'Grüber',
        'Germany',
        'Berlin'
      );

      await test.step(`Waiting for the debounceTime to start a db write`, () =>
        page.waitForTimeout(1100));

      await test.step(`The user manually clears the IndexeDb from devtools`, async () => {
        const keysAfterDeletion = await playwrightIdb
          .getStore(IDB_DATABASE_STORE_NAME)
          .deleteItem(IDB_STORE_KEY_NAME)
          .then((store) => store.keys());
        expect(keysAfterDeletion).toHaveLength(0);

        page.reload();
      })

      await fillInputField(inputs.firstNameInput, 'First name', '');
      await fillInputField(inputs.lastNameInput, 'Last name', '');
      await fillInputField(inputs.countryInput, 'Country', '');
      await fillInputField(inputs.cityInput, 'City', '');
    });

    test(`when there is relevant data in the indexedDb, the form gets populated when the page opens`, async () => {
      await page.goto('/');
      await expect(page).toHaveURL('/playwright-indexeddb/key-value-pairs');

      const inputs = await ensureInputFieldsAreVisible(page);

      await test.step(`Expect the input fields to be empty on initial page load`, async () => {
        await fillInputField(inputs.firstNameInput, 'First name', '');
        await fillInputField(inputs.lastNameInput, 'Last name', '');
        await fillInputField(inputs.countryInput, 'Country', '');
        await fillInputField(inputs.cityInput, 'City', '');
      });

      await test.step(`Waiting for the debounceTime to start a db write`, () =>
        page.waitForTimeout(1100));

      await playwrightIdb
        .getStore(IDB_DATABASE_STORE_NAME)
        .createItem(IDB_STORE_KEY_NAME, {
          firstName: 'John',
          lastName: 'McClane',
          country: 'USA',
          city: 'New York',
        });

      await test.step(`Expect the input fields to be filled after outside manipulation of IndexedDb and page reload`, async () => {
        await page.reload();
        await fillInputField(inputs.firstNameInput, 'First name', 'John');
        await fillInputField(inputs.lastNameInput, 'Last name', 'McClane');
        await fillInputField(inputs.countryInput, 'Country', 'USA');
        await fillInputField(inputs.cityInput, 'City', 'New York');
      });
    });

    test(`submitting the form clears the indexedDb`, async () => {
      await page.goto('/');
      await expect(page).toHaveURL('/playwright-indexeddb/key-value-pairs');

      const inputs = await ensureInputFieldsAreVisible(page);

      await playwrightIdb
        .getStore(IDB_DATABASE_STORE_NAME)
        .createItem(IDB_STORE_KEY_NAME, {
          firstName: 'John',
          lastName: 'McClane',
          country: 'USA',
          city: 'New York',
        });

      await page.reload();

      await fillInputField(
        inputs.addressInput,
        'Address line 1',
        '23rd Street 12'
      );
      await test.step(`the form gets submitted`, async () => {
        const submitButton = page.getByTestId(`submit button`);
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
      });

      await expect
        .poll(async () =>
          playwrightIdb
            .getStore(IDB_DATABASE_STORE_NAME)
            .readItem(IDB_STORE_KEY_NAME)
        )
        .toBe(undefined);
    });
  });

  test.describe('auto-increment database', () => {
    const IDB_DATABASE_NAME = 'AUTO_INCREMENT';
    const IDB_DATABASE_STORE_NAME = 'store';
    let page: Page;
    let playwrightIdb: PlaywrightIdbHelper;

    test.beforeEach(async ({ browser }) => {
      page = await browser.newPage();
      playwrightIdb = new PlaywrightIdbHelper(page);

      await page.goto('/playwright-indexeddb/auto-increment');

      await playwrightIdb.init(IDB_DATABASE_NAME);
      const store = await playwrightIdb.createObjectStore(
        IDB_DATABASE_STORE_NAME,
        { autoIncrement: true }
      );

      await store.addItem('test');
      await store.addItem('test2');
      await store.addItem('1337');

      await page.reload();

      const keys = await store.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toEqual([1, 2, 3]);

      const values = await store.values();
      expect(values).toHaveLength(3);
      expect(values).toEqual(['test', 'test2', '1337']);
    });

    test(`can insert data which can be retrieved by the application`, async () => {
      const firstRow = page.getByTestId('row_1');
      const secondRow = page.getByTestId('row_2');
      const thirdRow = page.getByTestId('row_3');

      await test.step(`The rows in the application should have 3 rows with values "test, test2, 1337"`, async () => {
        await expect(firstRow).toContainText('test');
        await expect(secondRow).toContainText('test2');
        await expect(thirdRow).toContainText('1337');
      });
    });

    test(`can read new values added through the application`, async () => {
      await test.step(`Add new values: "something, anything, whatever, seriously"`, async () => {
        const queueInput = page.getByTestId('add-to-queue-input');
        await expect(queueInput).toBeEnabled();
        await queueInput.fill('something');
        await queueInput.press('Enter');
        await queueInput.fill('anything');
        await queueInput.press('Enter');
        await queueInput.fill('whatever');
        await queueInput.press('Enter');
        await queueInput.fill('seriously');
        await queueInput.press('Enter');
      });

      const store = playwrightIdb.getStore(IDB_DATABASE_STORE_NAME);

      await expect
        .poll(async () => store.values())
        .toEqual([
          'test',
          'test2',
          '1337',
          'something',
          'anything',
          'whatever',
          'seriously',
        ]);
    });

    test(`can delete items by keys`, async () => {
      const firstRow = page.getByTestId('row_1');
      const secondRow = page.getByTestId('row_2');
      const thirdRow = page.getByTestId('row_3');

      await test.step(`The rows in the application should have 3 rows with values "test, test2, 1337"`, async () => {
        await expect(firstRow).toContainText('test');
        await expect(secondRow).toContainText('test2');
        await expect(thirdRow).toContainText('1337');
      });

      const store = playwrightIdb.getStore(IDB_DATABASE_STORE_NAME);

      await test.step(`Delete the second item using playwright-indexeddb`, async () => {
        await store.deleteItem(2);
      });

      await test.step(`Delete the last row through the application`, async () => {
        const deleteLastButton = page.getByTestId('delete-last-button');
        await deleteLastButton.click();
      });

      await test.step(`The playwright-indexeddb library should be able to validate the deleted items`, async () => {
        await expect.poll(async () => store.values()).toEqual(['test']);
      });

      await test.step(`The second and third rows should be deleted and the application should have 2 rows with values "test"`, async () => {
        await expect(firstRow).toContainText('test');
        await expect(secondRow).not.toBeVisible();
        await expect(thirdRow).not.toBeVisible();
      });
    });

    test(`can update items by keys`, async () => {
      const firstRow = page.getByTestId('row_1');
      const secondRow = page.getByTestId('row_2');
      const thirdRow = page.getByTestId('row_3');

      await test.step(`The rows in the application should have 3 rows with values "test, test2, 1337"`, async () => {
        await expect(firstRow).toContainText('test');
        await expect(secondRow).toContainText('test2');
        await expect(thirdRow).toContainText('1337');
      });

      const store = playwrightIdb.getStore(IDB_DATABASE_STORE_NAME);

      await test.step(`Update the second item using playwright-indexeddb and reload the page`, async () => {
        await store.updateItem(2, 'updated-test2');
        await page.reload()
      });

      await test.step(`The second and third rows should be deleted and the application should have 2 rows with values "test"`, async () => {
        await expect(firstRow).toContainText('test');
        await expect(secondRow).toContainText('updated-test2');
        await expect(thirdRow).toContainText('1337');
      });
    });
  });
});

async function ensureInputFieldsAreVisible(page: Page): Promise<{
  firstNameInput: Locator;
  lastNameInput: Locator;
  countryInput: Locator;
  cityInput: Locator;
  addressInput: Locator;
  addressOptionalInput: Locator;
}> {
  const firstNameInput = page.locator('#firstName');
  const lastNameInput = page.locator('#lastName');
  const countryInput = page.locator('#country');
  const cityInput = page.locator('#city');
  const addressInput = page.locator('#address');
  const addressOptionalInput = page.locator('#addressOptional');

  await test.step(`Make sure that the input fields are visible`, async () => {
    const isFirstNameInputVisible = await firstNameInput.isVisible();
    expect(isFirstNameInputVisible).toBe(true);
    const isLastNameInputVisible = await lastNameInput.isVisible();
    expect(isLastNameInputVisible).toBe(true);
    const isCountryInputVisible = await countryInput.isVisible();
    expect(isCountryInputVisible).toBe(true);
    const isCityInputVisible = await cityInput.isVisible();
    expect(isCityInputVisible).toBe(true);
    const isAddressInputVisible = await addressInput.isVisible();
    expect(isAddressInputVisible).toBe(true);
    const isAddressOptionalInputVisible =
      await addressOptionalInput.isVisible();
    expect(isAddressOptionalInputVisible).toBe(true);
  });

  return {
    firstNameInput,
    lastNameInput,
    countryInput,
    cityInput,
    addressInput,
    addressOptionalInput,
  };
}

async function fillInputFields(
  page: Page,
  firstName: string,
  lastName: string,
  country: string,
  city: string,
  address?: string,
  addressOptional?: string
): Promise<{
  firstNameInput: Locator;
  lastNameInput: Locator;
  countryInput: Locator;
  cityInput: Locator;
  addressInput: Locator;
  addressOptionalInput: Locator;
}> {
  const inputs = await ensureInputFieldsAreVisible(page);

  await fillInputField(inputs.firstNameInput, 'First name', firstName);
  await fillInputField(inputs.lastNameInput, 'Last name', lastName);
  await fillInputField(inputs.countryInput, 'Country', country);
  await fillInputField(inputs.cityInput, 'City', city);

  if (address) {
    await fillInputField(inputs.addressInput, 'Address line 1', address);
  }
  if (addressOptional) {
    await fillInputField(
      inputs.addressOptionalInput,
      'Address line 2',
      addressOptional
    );
  }

  return inputs;
}

async function fillInputField(
  input: Locator,
  inputName: string,
  value: string
): Promise<void> {
  await test.step(`Fill input "${inputName}" ${
    value ? `to have value ${value}` : `to be empty.`
  }`, () => input.fill(value));
}
