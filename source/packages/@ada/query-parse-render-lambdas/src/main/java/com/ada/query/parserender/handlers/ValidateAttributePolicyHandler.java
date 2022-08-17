/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.handlers;

import com.ada.query.parserender.model.validateattributepolicy.ValidateAttributePolicyRequest;
import com.ada.query.parserender.model.validateattributepolicy.ValidateAttributePolicyResponse;
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

import java.util.Collections;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Lambda handler for the query parse/render service's validate attribute policy api
 */
@NoArgsConstructor
public class ValidateAttributePolicyHandler implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
    private static final Logger logger = Logger.getLogger(ValidateAttributePolicyHandler.class.getName());
    private final ObjectMapper json = new ObjectMapper();
    private final QueryOperations queryOperations = new QueryOperations();

    /**
     * The validate attribute policy handler
     *
     * @param input   an apigateway proxy event containing the attribute policy to validate
     * @param context lambda execution context
     * @return whether or not the attribute policy is valid
     */
    @Override
    public APIGatewayProxyResponseEvent handleRequest(final APIGatewayProxyRequestEvent input, final Context context) {
        // Parse the request
        final ValidateAttributePolicyRequest request;

        try {
            request = json.readValue(input.getBody(), ValidateAttributePolicyRequest.class);
        } catch (JsonProcessingException e) {
            logger.log(Level.SEVERE, "Failed to read input", e);
            return ApiResponse.badRequest("Failed to read input");
        }

        try {
            // Generation of the where clause will throw an exception if the clause is not valid
            queryOperations.generateWhereClause("placeholder", request.getAttribute(), Collections.singletonList(request.getClause()));

            return ApiResponse.success(ValidateAttributePolicyResponse.builder().build());
        } catch (ParsingException | IllegalArgumentException e) {
            return ApiResponse.badRequest(e.getMessage());
        }
    }
}