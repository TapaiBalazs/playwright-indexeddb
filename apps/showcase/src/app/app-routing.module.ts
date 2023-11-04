import { NgModule } from '@angular/core';
import { Route, RouterModule } from '@angular/router';

export const routes: Route[] = [
  {
    path: 'playwright-indexeddb',
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./modules/indexed-db-showcase/indexed-db-showcase.module').then(
            (m) => m.IndexedDbShowcaseModule
          ),
      },
    ],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'playwright-indexeddb',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
