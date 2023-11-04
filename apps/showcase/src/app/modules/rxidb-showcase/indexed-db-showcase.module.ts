import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MatFormFieldModule,
} from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { IndexedDbRoutingModule } from './indexed-db-routing.module';
import { IndexedDbKeyValuePairShowcaseComponent } from './components/indexed-db-key-value-pair-showcase/indexed-db-key-value-pair-showcase.component';
import { IndexedDbAutoIncrementComponent } from './components/indexed-db-auto-increment/indexed-db-auto-increment.component';

@NgModule({
  declarations: [
    IndexedDbKeyValuePairShowcaseComponent,
    IndexedDbAutoIncrementComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IndexedDbRoutingModule,
    MatInputModule,
    MatFormFieldModule,
    MatSnackBarModule,
    MatButtonModule,
  ],
  providers: [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: { appearance: 'outline' },
    },
  ],
})
export class IndexedDbShowcaseModule {}
