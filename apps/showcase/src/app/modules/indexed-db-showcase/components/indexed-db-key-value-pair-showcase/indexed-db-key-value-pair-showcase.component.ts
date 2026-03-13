import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormGroupDirective,
  Validators,
} from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { from, Subject } from 'rxjs';
import { debounceTime, filter, map, switchMap, takeUntil } from 'rxjs/operators';
import { createIndexedDbStore } from '../../utils/localforage-indexed-db';

const DATABASE_NAME = 'FORM_CACHE';
const STORE_NAME = 'user_form_store';
const USER_FORM_KEY = 'user_form';

interface UserForm {
  firstName: FormControl<string | null>;
  lastName: FormControl<string | null>;
  country: FormControl<string | null>;
  city: FormControl<string | null>;
  address: FormControl<string | null>;
  addressOptional: FormControl<string | null>;
}

interface UserFormValue {
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  addressOptional: string | null;
}

@Component({
  selector: 'showcase-indexed-db-key-value-pair-showcase',
  templateUrl: './indexed-db-key-value-pair-showcase.component.html',
  styleUrls: ['./indexed-db-key-value-pair-showcase.component.scss'],
  standalone: false,
})
export class IndexedDbKeyValuePairShowcaseComponent
  implements AfterViewInit, OnInit, OnDestroy
{
  private readonly destroy$ = new Subject<void>();
  private readonly store = createIndexedDbStore(DATABASE_NAME, STORE_NAME);
  private isSubmitting = false;
  private lastSavePromise: Promise<void> = Promise.resolve();

  readonly formGroup: FormGroup<UserForm> = this.formBuilder.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    country: ['', Validators.required],
    city: ['', Validators.required],
    address: ['', Validators.required],
    addressOptional: [''],
  });

  constructor(
    private formBuilder: FormBuilder,
    private snackbar: MatSnackBar
  ) {}

  ngAfterViewInit(): void {
    void this.restoreForm();
  }

  ngOnInit(): void {
    this.formGroup.valueChanges
      .pipe(
        debounceTime(1000),
        map(() => this.formGroup.getRawValue()),
        filter(() => !this.isSubmitting),
        filter((value) => Object.values(value).some((entry) => entry !== null)),
        switchMap((value) => {
          const savePromise = this.store
            .setItem(USER_FORM_KEY, value)
            .then(() => undefined);
          this.lastSavePromise = savePromise;

          return from(savePromise);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async submit(directive: FormGroupDirective): Promise<void> {
    this.isSubmitting = true;

    try {
      await this.lastSavePromise;
      await this.store.removeItem(USER_FORM_KEY);
      directive.resetForm();
      this.openSnackbar();
    } finally {
      this.isSubmitting = false;
    }
  }

  private async restoreForm(): Promise<void> {
    const value = await this.store.getItem<UserFormValue>(USER_FORM_KEY);
    if (value) {
      this.formGroup.patchValue(value);
    }
  }

  private openSnackbar(): void {
    this.snackbar.open('Form successfully submitted', 'DISMISS', {
      duration: 6000,
    });
  }
}
