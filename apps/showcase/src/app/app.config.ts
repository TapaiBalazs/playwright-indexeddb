import { ApplicationConfig } from '@angular/core';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import { appRoutingModule } from './app-routing.module';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutingModule, withEnabledBlockingInitialNavigation()),
  ],
};
