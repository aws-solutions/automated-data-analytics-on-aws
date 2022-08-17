# Api Client Layer

This package exposes the project api via lambda layer.

## Exposed packages within layer

- `@ada/api-client`: The base generated api client is exposed via "yarn workspace `no-hoist`" rather than dependencies.
- `@ada/api-client-lambda`: Lambda specific client setup to map to api endpoint and apply credentials automatically.

> See `package.json` for additional third-party dependencies provided by the layer.
