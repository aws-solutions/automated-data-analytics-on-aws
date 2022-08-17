/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import ReactDOM from 'react-dom';

jest.mock('@ada/api-client');

jest.mock('./core/App', () => ({
	App: () => 'App',
}))

jest.mock('./core/provider', () => ({
	MetaProvider: ({ children }: any) => <>{children}</>,
}))


describe('src/index', () => {
  it('should render app', () => {
		const renderSpy = jest.spyOn(ReactDOM, 'render').mockImplementation(jest.fn());
		expect(() => require('./index')).not.toThrow();
		expect(renderSpy).toBeCalled();
		renderSpy.mockRestore();
  });
});
