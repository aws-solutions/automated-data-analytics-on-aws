# Generate OpenAPI Spec

Given that the @ada/infra package depends on @ada/api package to fully build, but the OpenAPI spec for
the @ada/api pacakge is derived from definitions in @ada/infra package, we use jest mocking to
virtualize and circumvent this dependency when generating the OpenAPI spec for @ada/api package.

## Notes

- The jest config is named `jest.config.generate-spec.ts.ts` to prevent it from matching
  the root "projects" pattern.
- `task.ts` is the runner that runs jest with configs needed to bypass @ada/infra dependency on @ada/api and
  prevent asset bundling/staging during cdk constructor calls.
- `generate.ts` is the actual generator that outputs the spec.json file, which is called from the @ada/api package
  during its build task.
