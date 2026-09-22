# PhotoMapUi

Angular front end for PhotoMap. Built with [Angular CLI](https://github.com/angular/angular-cli) 22.

## Prerequisites

Node.js `^22.22.3 || ^24.15.0 || >=26.0.0` and npm 8+. Run `npm ci` to install dependencies.

## Development server

Run `npm start` for a dev server. Navigate to `http://localhost:4200/`. The app reloads automatically when you change a source file.

The app expects the PhotoMap backend on `https://localhost:5001` — see `src/environments/environment.ts`.

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
