/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.exceptions;

/**
 * Exception thrown when there are invalid data products in a query
 */
public class InvalidDataProductsInQueryException extends Exception {
    public InvalidDataProductsInQueryException(final String message) {
        super(message);
    }
}
