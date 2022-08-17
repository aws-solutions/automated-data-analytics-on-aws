/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { StepFunctionErrorDetails, buildErrorMessageFromStepFunctionErrorDetails } from '../../types/step-function';

describe('step-function - build error message from step function error details', () => {
  it('should return detailed error message', () => {
    expect(
      buildErrorMessageFromStepFunctionErrorDetails({
        Error: 'SomeError',
        Cause: JSON.stringify({ errorMessage: 'detailed error message' }),
      } as StepFunctionErrorDetails),
    ).toBe('SomeError: detailed error message');
  });

  it('should return just the Error if cause is not parseable', () => {
    expect(
      buildErrorMessageFromStepFunctionErrorDetails({
        Error: 'SomeError',
        Cause: 'no cause',
      } as StepFunctionErrorDetails),
    ).toBe('SomeError');
  });

  it('should return only the Error if cause is parseable but errorMessage is missing in the cause', () => {
    expect(
      buildErrorMessageFromStepFunctionErrorDetails({
        Error: 'SomeError',
        Cause: JSON.stringify({ message: 'detailed error message' }),
      } as StepFunctionErrorDetails),
    ).toBe('SomeError');
  });
});
