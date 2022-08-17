/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/* eslint-disable */
declare module 'find-port-free-sync' {
	interface Options {
		start?: number,
		end?: number,
		num?: number,
		ip?: string
	}

	export = function(options?: Options): number {};
}
