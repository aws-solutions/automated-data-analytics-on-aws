/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.exceptions;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class InvalidDataProductsInQueryExceptionTest {

    @Test
    public void handleRequest_shouldQuoteColumnNames() throws Exception {
        InvalidDataProductsInQueryException ex = new InvalidDataProductsInQueryException("message");
        Assertions.assertEquals("message", ex.getMessage());
    }

}
