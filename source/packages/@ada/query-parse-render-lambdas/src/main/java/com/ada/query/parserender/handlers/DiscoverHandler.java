/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.handlers;

import com.ada.query.parserender.exceptions.InvalidDataProductsInQueryException;
import com.ada.query.parserender.exceptions.NotAQueryException;
import com.ada.query.parserender.model.discover.DiscoverRequest;
import com.ada.query.parserender.model.discover.DiscoverResponse;
import com.ada.query.parserender.query.QueryOperations;
import com.ada.query.parserender.utils.api.ApiResponse;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.facebook.presto.sql.parser.ParsingException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.NoArgsConstructor;

import java.util.logging.Logger;
import java.util.logging.Level;
import java.util.ArrayList;

/**
 * Lambda handler for the query parse/render service's discover api
 */
@NoArgsConstructor
public class DiscoverHandler implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
    private static final Logger logger = Logger.getLogger(DiscoverHandler.class.getName());
    private final ObjectMapper json = new ObjectMapper();
    private final QueryOperations queryOperations = new QueryOperations();

    /**
     * The discover lambda handler
     * @param input an apigateway proxy event containing the query for which to find data products
     * @param context lambda execution context
     * @return the data products involved in the query
     */
    @Override
    public APIGatewayProxyResponseEvent handleRequest(final APIGatewayProxyRequestEvent input, final Context context) {
        // Parse the request
        final DiscoverRequest request;
        try {
            request = json.readValue(input.getBody(), DiscoverRequest.class);
        } catch (JsonProcessingException e) {
            logger.log(Level.SEVERE, "Failed to read input", e);
            return ApiResponse.badRequest("Failed to read input");
        }

        try {
            // Find data products in the query
            return ApiResponse.success(DiscoverResponse.builder()
                    .tables(new ArrayList<>(queryOperations.findTables(queryOperations.parseQuery(request.getQuery()))))
                    .build());
        } catch (NotAQueryException | ParsingException | InvalidDataProductsInQueryException e) {
            return ApiResponse.badRequest(e.getMessage());
        }
    }
}
