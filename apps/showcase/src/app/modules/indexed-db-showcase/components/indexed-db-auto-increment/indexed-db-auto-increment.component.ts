import { BehaviorSubject, EMPTY, firstValueFrom, map, Observable } from 'rxjs';
import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  addAutoIncrementItem,
  createIndexedDbStore,
  deleteDatabase,
  deleteIndexedDbItem,
  ensureAutoIncrementStore,
  getIndexedDbEntries,
  IndexedDbEntry,
} from '../../utils/localforage-indexed-db';

const DATABASE_NAME = 'AUTO_INCREMENT';
const STORE_NAME = 'store';

@Component({
  selector: 'showcase-indexed-db-auto-increment',
  templateUrl: './indexed-db-auto-increment.component.html',
  styleUrls: ['./indexed-db-auto-increment.component.scss'],
  standalone: false,
})
export class IndexedDbAutoIncrementComponent implements OnInit {
  private readonly store = createIndexedDbStore(DATABASE_NAME, STORE_NAME);
  private isLoadingSubject = new BehaviorSubject(false);
  private readonly keyValuesSubject = new BehaviorSubject<
    IndexedDbEntry<string>[]
  >([]);
  private isStoreAvailable = false;

  readonly isLoading$ = this.isLoadingSubject.asObservable();
  readonly keyValues$ = this.keyValuesSubject.asObservable();

  readonly inputControl = new FormControl('', { nonNullable: true });

  constructor(private snackbar: MatSnackBar) {}

  ngOnInit(): void {
    void this.initializeStore();
  }

  append(evt: SubmitEvent): void {
    evt.preventDefault();
    const value = this.inputControl.value.trim();
    if (!value) {
      return;
    }

    this.inputControl.setValue('');
    void this.appendValue(value);
  }

  deleteFirst(): void {
    this.setLoading(true);
    void this.deleteBoundaryItem('first');
  }

  deleteLast(): void {
    this.setLoading(true);
    void this.deleteBoundaryItem('last');
  }

  clearAll(): void {
    this.setLoading(true);
    void this.clearAllItems();
  }

  deleteDatabase(): void {
    this.setLoading(true);
    void this.removeDatabase();
  }

  private openSnackbar(
    key: IDBValidKey,
    value: unknown
  ): Observable<IDBValidKey> {
    const snackbarRef = this.snackbar.open(
      `Cleared ${key} with value ${value}`,
      'DISMISS',
      {
        duration: 1000,
      }
    );
    return snackbarRef.afterDismissed().pipe(map(() => key));
  }

  private async initializeStore(): Promise<void> {
    try {
      await ensureAutoIncrementStore(DATABASE_NAME, STORE_NAME);
      this.isStoreAvailable = true;
      await this.refreshEntries();
    } catch {
      this.isStoreAvailable = false;
      this.keyValuesSubject.next([]);
    } finally {
      this.updateInputControlState();
    }
  }

  private async appendValue(value: string): Promise<void> {
    await ensureAutoIncrementStore(DATABASE_NAME, STORE_NAME);
    await addAutoIncrementItem(this.store, value);
    await this.refreshEntries();
  }

  private async deleteBoundaryItem(position: 'first' | 'last'): Promise<void> {
    try {
      const keyValues = await getIndexedDbEntries<string>(this.store);
      const keyValue =
        position === 'first'
          ? keyValues[0]
          : keyValues[keyValues.length - 1];

      if (!keyValue) {
        return;
      }

      await deleteIndexedDbItem(this.store, keyValue.key);
      await this.refreshEntries();
    } finally {
      this.setLoading(false);
    }
  }

  private async clearAllItems(): Promise<void> {
    try {
      const keyValues = await getIndexedDbEntries<string>(this.store);
      if (!keyValues.length) {
        return;
      }

      for (const keyValue of keyValues) {
        const key = await firstValueFrom(
          this.openSnackbar(keyValue.key, keyValue.value)
        );
        await deleteIndexedDbItem(this.store, key);
      }

      await this.refreshEntries();
    } finally {
      this.setLoading(false);
    }
  }

  private async removeDatabase(): Promise<void> {
    try {
      await deleteDatabase(DATABASE_NAME);
      this.isStoreAvailable = false;
      this.keyValuesSubject.next([]);
    } finally {
      this.setLoading(false);
    }
  }

  private async refreshEntries(): Promise<void> {
    const keyValues = await getIndexedDbEntries<string>(this.store);
    this.keyValuesSubject.next(keyValues);
  }

  private setLoading(isLoading: boolean): void {
    this.isLoadingSubject.next(isLoading);
    this.updateInputControlState();
  }

  private updateInputControlState(): void {
    if (this.isLoadingSubject.value || !this.isStoreAvailable) {
      this.inputControl.disable();
      return;
    }

    this.inputControl.enable();
  }
}
