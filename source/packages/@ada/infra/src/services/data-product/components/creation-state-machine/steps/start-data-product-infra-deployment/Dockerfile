FROM public.ecr.aws/lambda/nodejs:16 AS builder
WORKDIR /usr/app
COPY node_modules/ ./node_modules
COPY dist/ ./
RUN ls
# Verify that modules are correctly installed for bundled handler
# If this fails with `Error: Cannot find module 'xxx'` then we need to add
# that module to ./package.json dependencies
RUN node -e "console.log(typeof require('./index.js').handler === 'function');"


FROM public.ecr.aws/lambda/nodejs:16
WORKDIR ${LAMBDA_TASK_ROOT}
COPY --from=builder /usr/app/* ./
CMD ["index.handler"]
