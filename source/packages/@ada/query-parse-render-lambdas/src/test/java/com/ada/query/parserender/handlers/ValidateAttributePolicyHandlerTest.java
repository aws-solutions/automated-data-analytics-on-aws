/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.handlers;

import com.ada.query.parserender.model.validateattributepolicy.ValidateAttributePolicyRequest;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class ValidateAttributePolicyHandlerTest {
    private final ObjectMapper json = new ObjectMapper();
    private final ValidateAttributePolicyHandler handler = new ValidateAttributePolicyHandler();

    @Test
    public void handleRequest_shouldReturnSuccessForValidClause() throws Exception {
        APIGatewayProxyResponseEvent result = handler.handleRequest(buildRequest("value", "value > 3"), null);
        assertEquals(200, result.getStatusCode());
    }

    @Test
    public void handleRequest_shouldReturnSuccessForValidComplexClause() throws Exception {
        APIGatewayProxyResponseEvent result = handler.handleRequest(buildRequest("value", "value > 3 AND value < 5 AND (value - 3) > 10"), null);
        assertEquals(200, result.getStatusCode());
    }

    @Test
    public void handleRequest_shouldReturn400ForInvalidJson() {
        assertEquals(400, handler.handleRequest(new APIGatewayProxyRequestEvent().withBody("not valid json"), null).getStatusCode());
    }

    @Test
    public void handleRequest_shouldReturn400ForInvalidSql() throws Exception {
        APIGatewayProxyResponseEvent result = handler.handleRequest(buildRequest("value", "this is not sql"), null);
        assertEquals(400, result.getStatusCode());
    }

    @Test
    public void handleRequest_shouldReturn400ForInvalidAttributeReference() throws Exception {
        APIGatewayProxyResponseEvent result = handler.handleRequest(buildRequest("value", "something > 3"), null);
        assertEquals(400, result.getStatusCode());
    }

    private APIGatewayProxyRequestEvent buildRequest(final String attribute, final String clause) throws Exception {
        return new APIGatewayProxyRequestEvent()
                .withBody(json.writeValueAsString(ValidateAttributePolicyRequest.builder()
                        .attribute(attribute)
                        .clause(clause)
                        .build()));
    }
}
