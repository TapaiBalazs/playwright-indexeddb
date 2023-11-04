import { test, expect, selectors } from '@playwright/test';
import { Page } from 'playwright';
import { Idbhelper } from '@btapai/playwright-indexeddb';

test.describe('@btapai/playwright-indexeddb', () => {
  let page: Page;
  let playwrightIdb: Idbhelper

  test.beforeAll(async ({ browser }) => {
    selectors.setTestIdAttribute('data-test-id');
    page = await browser.newPage();
  });

  test.beforeEach(async () => {
    playwrightIdb = new Idbhelper(page);

    await page.goto('/');

    await playwrightIdb.init('FORM_CACHE');
    await playwrightIdb.createObjectStore('user_form_store');
  });

  test('the documentation of the library is always visible', async () => {
    await page.goto('/');
    await expect(page).toHaveURL('/playwright-indexeddb/key-value-pairs');

    const firstNameInput = page.locator('#firstName')
    const lastNameInput = page.locator('#lastName')
    const countryInput = page.locator('#country')
    const cityInput = page.locator('#city')

    const isFirstNameInputVisible = await firstNameInput.isVisible()
    expect(isFirstNameInputVisible).toBe(true);
    const isLastNameInputVisible = await lastNameInput.isVisible()
    expect(isLastNameInputVisible).toBe(true);
    const isCountryInputVisible = await countryInput.isVisible()
    expect(isCountryInputVisible).toBe(true);
    const isCityInputVisible = await cityInput.isVisible()
    expect(isCityInputVisible).toBe(true);

    await firstNameInput.fill('Hans')
    await lastNameInput.fill('Grüber')
    await countryInput.fill('Germany')
    await cityInput.fill('Berlin')

    // Waiting for the debounceTime to start a db write
    await page.waitForTimeout(1100)

    const values = await playwrightIdb
      .store('user_form_store')
      .readItem(`user_form`)

    expect(values).toEqual({
      firstName: 'Hans',
      lastName: 'Grüber',
      country: 'Germany',
      city: 'Berlin',
      address: '',
      addressOptional: '',
    })
  });
});
