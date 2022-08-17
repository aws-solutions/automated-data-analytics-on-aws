/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { useEffect, useRef } from 'react';

export const useImmediateEffect = (effect: CallableFunction): void => {
  const willMount = useRef(true);
  const cleanup = useRef<CallableFunction>();

  useEffect(() => {
    return () => {
      cleanup.current && cleanup.current();
    };
  }, []);

  if (willMount.current) {
    cleanup.current = effect();
  }

  willMount.current = false;
};
