# api-client-lambda

During `@ada/infra` post build this package will get move within the dist output
directory into the nested `node_modules/@ada` folder as `node_modules/@ada/api-client-lambda` to prevent lambdas using the layer from having to path to it
via `/opt/nodejs/api-client-lambda` and use `require('@ada/api-client-lambda')`
syntax instead.

## Notes

- See source/packages/@ada/infra/package.json "postbuild -> dist:api-client-lambda"
  script for hook.
- `@ada/api-client-lambda` npm dependency versions managed in parent layer nodejs/package.json to properly scope `nodejs/node_modules` directory. Define all dependencies in this package as `peerDependencies` with `*`.
- Dependencies to project workspace packages must be defined in "yarn workspace no-hoist" config to prevent CI `yarn install --frozen-lock` from complaining. Yarn workspace will automatically add the no-hoist reference into local node_modules for us :D
