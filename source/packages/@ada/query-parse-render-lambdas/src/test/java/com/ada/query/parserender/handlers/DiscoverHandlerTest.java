/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.handlers;

import com.ada.query.parserender.model.discover.DiscoverRequest;
import com.ada.query.parserender.model.discover.DiscoverResponse;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class DiscoverHandlerTest {
    private final ObjectMapper json = new ObjectMapper();
    private final DiscoverHandler handler = new DiscoverHandler();

    @Test
    public void handleRequest_shouldReturnSuccessOnSimpleQuery() throws Exception {
        APIGatewayProxyResponseEvent result = handler.handleRequest(buildRequest("SELECT * FROM sales.customers"), null);
        assertEquals(200, result.getStatusCode());
        DiscoverResponse response = json.readValue(result.getBody(), DiscoverResponse.class);
        assertEquals(1, response.getTables().size());
        assertEquals(Arrays.asList("sales", "customers"), response.getTables().get(0).getIdentifierParts());
        assertEquals("sales.customers", response.getTables().get(0).qualifiedName());
    }

    @Test
    public void handleRequest_shouldReturnSuccessWithFiltersIncludingDecimals() throws Exception {
        APIGatewayProxyResponseEvent result = handler.handleRequest(buildRequest("SELECT * FROM sales.customers where rand()=0.3"), null);
        assertEquals(200, result.getStatusCode());
        DiscoverResponse response = json.readValue(result.getBody(), DiscoverResponse.class);
        assertEquals(1, response.getTables().size());
        assertEquals(Arrays.asList("sales", "customers"), response.getTables().get(0).getIdentifierParts());
        assertEquals("sales.customers", response.getTables().get(0).qualifiedName());
    }

    @Test
    public void handleRequest_shouldReturnSuccessOnQueryIncludingDemicals() throws Exception {
        APIGatewayProxyResponseEvent result = handler.handleRequest(buildRequest("SELECT 0.3 FROM sales.customers where 0.3=0.3"), null);
        assertEquals(200, result.getStatusCode());
        DiscoverResponse response = json.readValue(result.getBody(), DiscoverResponse.class);
        assertEquals(1, response.getTables().size());
        assertEquals(Arrays.asList("sales", "customers"), response.getTables().get(0).getIdentifierParts());
        assertEquals("sales.customers", response.getTables().get(0).qualifiedName());
    }

    @Test
    public void handleRequest_shouldReturn400ForInvalidJson() {
        assertEquals(400, handler.handleRequest(new APIGatewayProxyRequestEvent().withBody("not valid json"), null).getStatusCode());
    }

    @Test
    public void handleRequest_shouldReturn400ForInvalidSql() throws Exception {
        APIGatewayProxyResponseEvent result = handler.handleRequest(buildRequest("this is not sql"), null);
        assertEquals(400, result.getStatusCode());
    }

    @Test
    public void handleRequest_shouldReturn200ForLongDataProductName() throws Exception {
        APIGatewayProxyResponseEvent result = handler.handleRequest(buildRequest("SELECT * FROM catalog.sales.customers.something"), null);
        assertEquals(200, result.getStatusCode());
        DiscoverResponse response = json.readValue(result.getBody(), DiscoverResponse.class);
        assertEquals(1, response.getTables().size());
        assertEquals(Arrays.asList("catalog", "sales", "customers", "something"), response.getTables().get(0).getIdentifierParts());
        assertEquals("catalog.sales.customers.something", response.getTables().get(0).qualifiedName());
    }

    @Test
    public void handleRequest_shouldReturn400ForNonQuerySqlStatements() throws Exception {
        APIGatewayProxyResponseEvent result = handler.handleRequest(buildRequest("DESCRIBE foo"), null);
        assertEquals(400, result.getStatusCode());
    }

    private APIGatewayProxyRequestEvent buildRequest(final String query) throws Exception {
        return new APIGatewayProxyRequestEvent()
                .withBody(json.writeValueAsString(DiscoverRequest.builder().query(query).build()));
    }
}
