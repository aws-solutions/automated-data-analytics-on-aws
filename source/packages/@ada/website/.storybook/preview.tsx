import React, { useMemo } from 'react';
import jest from 'jest-mock';
import expect from '@storybook/expect'
// @ts-ignore
window.jest = jest;
// @ts-ignore
window.expect = expect;

import 'font-awesome/css/font-awesome.css'

import '../src/index.css';
import '../src/core/App/index.css';

import {configure} from '@testing-library/react'

configure({
  // disable pretty error message in storybook
  // https://github.com/testing-library/dom-testing-library/issues/773
  getElementError: (message, container) => {
    const error = new Error(message || undefined)
    error.name = 'TestingLibraryElementError'
    return error
  }
})

import '../src/strings'
import type { MockMetaProviderProps } from '../src/core/provider/MetaProvider/mock'
import { useImmediateEffect } from '../src/common/hooks/use-immediate-effect'
import { ENV_STORYBOOK } from '../src/config';

// after window.jest
const { MockMetaProvider } = require('../src/core/provider/MetaProvider/mock')
const { applyDefaultApiOperationMocks } = require('../src/testing/api')

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
}

type ProvidersParameter = MockMetaProviderProps & { custom: React.FC }

export type StorybookParameters = typeof parameters & {
  providers?: ProvidersParameter,
  apiMocks?: boolean
}

export const decorators = [
  (Story: any, { parameters }: any) => {
    const providers = useMemo<ProvidersParameter>(() => ({
      api: true,
      appLayout: true,
      indexing: false,
      northstar: true,
      router: true,
      amplify: 'MOCKED',
      user: 'MOCKED',
      ...(parameters?.providers || {}),
    }), [])

    useImmediateEffect(() => {
      // always clear mocks between stories in storybook env
      ENV_STORYBOOK && jest.clearAllMocks();

      if (parameters?.apiMocks == null) {
        applyDefaultApiOperationMocks()
      }
    })

    const Custom = useMemo<React.FC>(() => {
      return providers.custom || React.Fragment
    }, [providers.custom])

    return (
      <MockMetaProvider {...providers}>
        <Custom>
          <Story />
        </Custom>
      </MockMetaProvider>
    )
  }
]
