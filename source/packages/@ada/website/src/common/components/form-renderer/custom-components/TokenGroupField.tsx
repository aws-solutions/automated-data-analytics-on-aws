/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, Inline, Input, Stack, TokenGroup } from 'aws-northstar';
import { Item as Token } from 'aws-northstar/components/TokenGroup/components/Token';
import { compact, isEmpty } from 'lodash';
import { getErrorText } from 'aws-northstar/components/FormRenderer/utils/getErrorText';
import FormField from 'aws-northstar/components/FormField';
import React, { useEffect, useMemo, useState } from 'react';
import useFieldApi, { UseFieldApiConfig } from '@data-driven-forms/react-form-renderer/use-field-api';
import useUniqueId from 'aws-northstar/components/../hooks/useUniqueId';

export type { Item as Token } from 'aws-northstar/components/TokenGroup/components/Token';

export function tokensFromStrings(values?: string[]): Token[] | undefined {
  if (values == null || isEmpty(values)) return undefined;

  return values.map((value) => ({ label: value, value }));
}

export function tokensToStrings(tokens?: Token[]): string[] | undefined {
  if (tokens == null) return tokens;

  return compact(
    tokens.map(({ value }) => {
      return value;
    }),
  );
}

interface Props extends UseFieldApiConfig {
  placeholder?: string;
  addButtonText?: string;
  inputValueResolver?: (value?: any) => Token[];
  outputValueResolver?: (tokens?: Token[]) => any;
  validateValue?: (value?: string) => undefined | string;
}

export const TokenGroupField: React.FC<Props> = ({
  placeholder,
  addButtonText,
  inputValueResolver,
  outputValueResolver,
  validateValue,
  ...props
}) => {
  const {
    label,
    description,
    helperText,
    input,
    validateOnMount,
    stretch,
    showError,
    renderReload,
    onReloadClick,
    createNewLinkHref,
    createNewLink,
    secondaryControl,
    meta: { error, submitFailed },
    hideField,
  } = useFieldApi(props);
  const controlId = useUniqueId(input.name);
  const errorText = getErrorText(validateOnMount, submitFailed, showError, error);
  const [tokens, setTokens] = useState<Token[]>(
    () => (inputValueResolver ? inputValueResolver(input.value) : input.value) || [],
  );
  const [inputValue, setInputValue] = useState<string>();

  const inputValueError = useMemo(() => {
    return validateValue && validateValue(inputValue);
  }, [inputValue, validateValue]);

  useEffect(() => {
    if (tokens) {
      const value = outputValueResolver ? outputValueResolver(tokens) : tokens;
      input.onChange(value);
    }
  }, [tokens, outputValueResolver]);

  if (hideField) {
    return null;
  }

  return (
    <FormField
      controlId={controlId}
      label={label}
      description={description}
      hintText={helperText}
      errorText={errorText}
      stretch={stretch}
      secondaryControl={secondaryControl}
      renderReload={renderReload}
      onReloadClick={onReloadClick}
      createNewLink={createNewLink}
      createNewLinkHref={createNewLinkHref}
    >
      <Stack>
        <Inline>
          <Input value={inputValue} onChange={setInputValue} placeholder={placeholder} />
          <Button
            variant="primary"
            disabled={inputValueError != null}
            onClick={() => {
              setTokens((_tokens) => _tokens.concat({ label: inputValue, value: inputValue }));
              setInputValue(''); // reset input
            }}
          >
            {addButtonText || 'Add'}
          </Button>
        </Inline>

        <TokenGroup
          items={tokens || []}
          onDismiss={(item) => {
            setTokens((_tokens) => {
              return _tokens.filter((token) => JSON.stringify(token) !== JSON.stringify(item));
            });
          }}
        />
      </Stack>
    </FormField>
  );
};

export const StringGroupField: React.FC<Omit<Props, 'inputValueResolver' | 'outputValueResolver'>> = (props) => {
  return (
    <TokenGroupField {...(props as any)} inputValueResolver={tokensFromStrings} outputValueResolver={tokensToStrings} />
  );
};
