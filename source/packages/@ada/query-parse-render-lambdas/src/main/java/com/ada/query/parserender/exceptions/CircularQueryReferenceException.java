/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
package com.ada.query.parserender.exceptions;

/**
 * Exception thrown when a query has circular references
 */
public class CircularQueryReferenceException extends Exception {
    public CircularQueryReferenceException(final String message) {
        super(message);
    }
}
