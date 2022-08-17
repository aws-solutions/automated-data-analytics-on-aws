/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Autosuggest } from 'aws-northstar';
import { DebounceSettings, debounce } from 'lodash';
import { INDEXING_MIN_MATCH_CHARS, SearchResult, useRefreshIndex, useSearch } from '$core/provider/IndexingProvider';
import { SelectOption } from 'aws-northstar/components/Select';
import { useRenderOption, useSearchOptions } from './options';
import React, { useCallback, useMemo, useState } from 'react';

const DEBOUCE_OPTIONS: DebounceSettings = {
  maxWait: 1000,
  leading: false,
  trailing: true,
};
const DEBOUNC_WAIT = 200;
const SEARCH_LIMIT = 100;

export const GlobalSearch: React.FC<{}> = () => {
  const refreshIndex = useRefreshIndex();
  const search = useSearch();
  const [results, setResults] = useState<SearchResult[]>();

  const options = useSearchOptions(results);

  const inputHandler = useMemo(() => {
    return debounce(
      (_event: React.ChangeEvent<{}>, value: string) => {
        if (value.length >= INDEXING_MIN_MATCH_CHARS) {
          const _results = search(value, { limit: SEARCH_LIMIT });
          setResults(_results);
        }
      },
      DEBOUNC_WAIT,
      DEBOUCE_OPTIONS,
    );
  }, [search]);

  const selectionHandler = useCallback((option: SelectOption | null) => {
    // This is noop since the option pushes directly to history on click
    console.info('search:selection:', option);
  }, []);

  const renderOption = useRenderOption();

  return (
    <Autosuggest
      controlId="searchInput"
      placeholder="Enter search..."
      filteringType="manual"
      filterOptions={(_options) => _options}
      onChange={selectionHandler}
      onInputChange={inputHandler}
      statusType="finished"
      options={options}
      renderOption={renderOption as any}
      empty="No matching service found"
      onFocus={refreshIndex}
      freeSolo
      disableBrowserAutocorrect
    />
  );
};
