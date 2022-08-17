/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.exceptions;

/**
 * Exception thrown when the given query is valid sql but not a query
 */
public class NotAQueryException extends Exception {
    public NotAQueryException(final String message) {
        super(message);
    }
}
