import { IdbHelper } from '@btapai/playwright-indexeddb';
import { expect, Locator, test } from '@playwright/test';
import { Page } from 'playwright';

const IDB_DATABASE_NAME = 'FORM_CACHE';
const IDB_DATABASE_STORE_NAME = 'user_form_store';
const IDB_STORE_KEY_NAME = 'user_form';

test.describe('@btapai/playwright-indexeddb', () => {
  test.describe('key-value pair based databases', () => {
    let page: Page;
    let playwrightIdb: IdbHelper;

    test.beforeAll(async ({ browser }) => {
      page = await browser.newPage();
    });

    test.beforeEach(async () => {
      playwrightIdb = new IdbHelper(page);

      await page.goto('/');

      await playwrightIdb.init(IDB_DATABASE_NAME);
      await playwrightIdb.createObjectStore(IDB_DATABASE_STORE_NAME);
    });

    test('entering data into the form saves it to the indexedDb', async () => {
      await page.goto('/');
      await expect(page).toHaveURL('/playwright-indexeddb/key-value-pairs');

      await fillInputFields(page, 'Hans', 'Grüber', 'Germany', 'Berlin');

      await test.step(`Waiting for the debounceTime to start a db write`, () => page.waitForTimeout(1100))

      const values = await playwrightIdb
        .store(IDB_DATABASE_STORE_NAME)
        .readItem(IDB_STORE_KEY_NAME);

      expect(values).toEqual({
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

      await test.step(`Waiting for the debounceTime to start a db write`, () => page.waitForTimeout(1100))

      // The user manually clears the IndexedDb (e.g.: devtools)
      const keysAfterDeletion = await playwrightIdb
        .store(IDB_DATABASE_STORE_NAME)
        .deleteItem(IDB_STORE_KEY_NAME)
        .then((store) => store.keys());
      expect(keysAfterDeletion).toHaveLength(0);

      page.reload();


      await fillInputField(inputs.firstNameInput, 'First name', '')
      await fillInputField(inputs.lastNameInput, 'Last name', '')
      await fillInputField(inputs.countryInput, 'Country', '')
      await fillInputField(inputs.cityInput, 'City', '')
    });

    test(`when there is relevant data in the indexedDb, the form gets populated when the page opens`, async () => {
      await page.goto('/');
      await expect(page).toHaveURL('/playwright-indexeddb/key-value-pairs');

      const inputs = await ensureInputFieldsAreVisible(page);

      await test.step(`Expect the input fields to be empty on initial page load`, async () => {
        await fillInputField(inputs.firstNameInput, 'First name', '')
        await fillInputField(inputs.lastNameInput, 'Last name', '')
        await fillInputField(inputs.countryInput, 'Country', '')
        await fillInputField(inputs.cityInput, 'City', '')
      })

      await test.step(`Waiting for the debounceTime to start a db write`, () => page.waitForTimeout(1100))

      await playwrightIdb
        .store(IDB_DATABASE_STORE_NAME)
        .createItem(IDB_STORE_KEY_NAME, {
          firstName: 'John',
          lastName: 'McClane',
          country: 'USA',
          city: 'New York',
        })


      await test.step(`Expect the input fields to be filled after outside manipulation of IndexedDb and page reload`, async () => {
        await page.reload();
        await fillInputField(inputs.firstNameInput, 'First name', 'John')
        await fillInputField(inputs.lastNameInput, 'Last name', 'McClane')
        await fillInputField(inputs.countryInput, 'Country', 'USA')
        await fillInputField(inputs.cityInput, 'City', 'New York')
      })
    });

    test(`submitting the form clears the indexedDb`, async () => {
      await page.goto('/');
      await expect(page).toHaveURL('/playwright-indexeddb/key-value-pairs');

      const inputs = await ensureInputFieldsAreVisible(page);

      await playwrightIdb
        .store(IDB_DATABASE_STORE_NAME)
        .createItem(IDB_STORE_KEY_NAME, {
          firstName: 'John',
          lastName: 'McClane',
          country: 'USA',
          city: 'New York',
        })

      await page.reload();

      await fillInputField(inputs.addressInput, 'Address line 1', '23rd Street 12');
      await test.step(`the form gets submitted`, async () => {
        const submitButton = page.getByTestId(`submit button`)
        await expect(submitButton).toBeEnabled()
        await submitButton.click()
      });

      await test.step(`Waiting for the save event and DB write to occur`, () => page.waitForTimeout(1100))

      const IdbContentsAfterSubmit = await playwrightIdb
        .store(IDB_DATABASE_STORE_NAME)
        .readItem(IDB_STORE_KEY_NAME)

      expect(IdbContentsAfterSubmit).toBe(undefined)

    })

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
    const isAddressOptionalInputVisible = await addressOptionalInput.isVisible();
    expect(isAddressOptionalInputVisible).toBe(true);
  })

  return {
    firstNameInput,
    lastNameInput,
    countryInput,
    cityInput,
    addressInput,
    addressOptionalInput
  };
}

async function fillInputFields(
  page: Page,
  firstName: string,
  lastName: string,
  country: string,
  city: string,
  address?: string,
  addressOptional?: string,
): Promise<{
  firstNameInput: Locator;
  lastNameInput: Locator;
  countryInput: Locator;
  cityInput: Locator;
  addressInput: Locator;
  addressOptionalInput: Locator;
}> {
  const inputs = await ensureInputFieldsAreVisible(page);

  await fillInputField(inputs.firstNameInput, 'First name', firstName)
  await fillInputField(inputs.lastNameInput, 'Last name', lastName)
  await fillInputField(inputs.countryInput, 'Country', country)
  await fillInputField(inputs.cityInput, 'City', city)

  if (address) {
    await fillInputField(inputs.addressInput, 'Address line 1', address)
  }
  if (addressOptional) {
    await fillInputField(inputs.addressOptionalInput, 'Address line 2', addressOptional)
  }

  return inputs;
}

async function fillInputField(input: Locator, inputName: string, value: string): Promise<void> {
  await test.step(`Fill input "${inputName}" ${value ? `to have value ${value}` : `to be empty.` }`, () => input.fill(value));
}
