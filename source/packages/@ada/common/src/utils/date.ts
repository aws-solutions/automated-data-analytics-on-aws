/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/**
 * Add a certain amount of days to a date (timestamp)
 * @param ts the timestamp (could be retrieved from Date.now())
 * @param days number of days to add to the original date
 * @returns a new date that adds the number of days
 */
export const addDays = (ts: number, days: number): Date => {
  const date = new Date(ts);
  date.setDate(date.getDate() + days);

  return date;
};
