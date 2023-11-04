import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { IndexedDbAutoIncrementComponent } from './components/indexed-db-auto-increment/indexed-db-auto-increment.component';
import { IndexedDbKeyValuePairShowcaseComponent } from './components/indexed-db-key-value-pair-showcase/indexed-db-key-value-pair-showcase.component';

const routes: Routes = [
  {
    path: 'key-value-pairs',
    component: IndexedDbKeyValuePairShowcaseComponent,
  },
  {
    path: 'auto-increment',
    component: IndexedDbAutoIncrementComponent,
  },
  {
    path: '**',
    pathMatch: 'full',
    redirectTo: 'key-value-pairs',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IndexedDbRoutingModule {}
