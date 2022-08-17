/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.utils.api;

import com.ada.query.parserender.model.ErrorResponse;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Utility methods for returning json responses
 */
public class ApiResponse {
    private static final ObjectMapper json = new ObjectMapper();

    public static APIGatewayProxyResponseEvent badRequest(final String message) {
        return buildResponseEvent(400, ErrorResponse.builder().message(message).build());
    }

    public static <T> APIGatewayProxyResponseEvent success(final T response) {
        return buildResponseEvent(200, response);
    }

    private static <T> APIGatewayProxyResponseEvent buildResponseEvent(final int statusCode, final T response) {
        try {
            return new APIGatewayProxyResponseEvent()
                    .withStatusCode(statusCode)
                    .withBody(json.writeValueAsString(response));
        } catch (JsonProcessingException e) {
            return new APIGatewayProxyResponseEvent()
                    .withStatusCode(500)
                    .withBody("{\"message\": \"Failed to serialise response\"}");
        }
    }

    private ApiResponse() {
        throw new IllegalStateException("Utility class");
    }
}
