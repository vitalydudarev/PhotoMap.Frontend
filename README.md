# PhotoMapUi

Angular front end for PhotoMap. Built with [Angular CLI](https://github.com/angular/angular-cli) 22.

## Prerequisites

Node.js `^22.22.3 || ^24.15.0 || >=26.0.0` and npm 8+. Run `npm ci` to install dependencies.

## Development server

Run `npm start` for a dev server. Navigate to `http://localhost:4200/`. The app reloads automatically when you change a source file.

The app expects the PhotoMap backend on `https://localhost:5001` — see `src/environments/environment.ts`.

## Design system

There is no third-party UI library. The look is defined by CSS custom properties in
`src/styles/_tokens.scss` (retune the whole app from that one file), a reset in `_base.scss`, and
styles for directive-driven elements in `_controls.scss`. Light and dark palettes both ship; the app
follows the OS unless the user picks a theme, which `ThemeService` stores and writes to `data-theme`
on `<html>`.

The components themselves live in `src/app/shared/ui/`: `app-icon` (inline SVG, no icon font),
`appButton`, `app-card`, `app-alert`, `app-segmented`, `app-paginator`, `app-progress-bar`,
`app-spinner`, `app-toast-host` and `app-theme-toggle`.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum`.

Components are standalone; there are no `NgModule`s in the app. Application-wide providers live in `src/app/app.config.ts` and routes in `src/app/app.routes.ts`.

## Build

Run `npm run build` for a production build, or `ng build --configuration development` for an unoptimized one. Artifacts land in `dist/`.

## Running unit tests

Run `npm test` to execute the unit tests with [Vitest](https://vitest.dev) via `@angular/build:unit-test`, in a jsdom environment.

## Linting and formatting

Run `npm run lint` for [ESLint](https://eslint.org) (`angular-eslint` flat config in `eslint.config.js`) and `npm run format` for Prettier.

## Regenerating the backend client

`npm run nswag:backend` regenerates `src/app/shared/models/photomap-backend.swagger.ts` from the backend's OpenAPI document. The backend must be running.
