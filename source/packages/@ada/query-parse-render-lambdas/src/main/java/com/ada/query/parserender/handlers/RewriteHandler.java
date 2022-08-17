/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.handlers;

import com.ada.query.parserender.exceptions.CircularQueryReferenceException;
import com.ada.query.parserender.exceptions.NotAQueryException;
import com.ada.query.parserender.model.rewrite.DataUdf;
import com.ada.query.parserender.model.rewrite.RewriteRequest;
import com.ada.query.parserender.model.rewrite.RewriteResponse;
import com.ada.query.parserender.query.QueryOperations;
import com.ada.query.parserender.utils.api.ApiResponse;
import com.ada.query.parserender.utils.query.QueryUtils;
import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.facebook.presto.sql.SqlFormatter;
import com.facebook.presto.sql.parser.ParsingException;
import com.facebook.presto.sql.tree.Query;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.NoArgsConstructor;

import java.util.Set;
import java.util.Optional;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Lambda handler for the query parse/render service's rewrite api
 */
@NoArgsConstructor
public class RewriteHandler implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
    private static final Logger logger = Logger.getLogger(RewriteHandler.class.getName());
    private final ObjectMapper json = new ObjectMapper();
    private final QueryOperations queryOperations = new QueryOperations();
    /**
     * The rewrite lambda handler
     *
     * @param input   an apigateway proxy event containing the query along with data products to be rewritten
     * @param context lambda execution context
     * @return the transformed query
     */
    @Override
    public APIGatewayProxyResponseEvent handleRequest(final APIGatewayProxyRequestEvent input, final Context context) {
        // Parse the request
        final RewriteRequest request;

        try {
            request = json.readValue(input.getBody(), RewriteRequest.class);
        } catch (JsonProcessingException e) {
            logger.log(Level.SEVERE, "Failed to read input", e);
            return ApiResponse.badRequest("Failed to read input");
        }

        try {
            Query inputQuery = queryOperations.parseQuery(request.getQuery());
            Query inputQueryWithSubstitutions = queryOperations.applyQuerySubstitutions(inputQuery, request.getQuerySubstitutions());

            Query q = queryOperations.replaceDataProductsWithGovernanceQueries(
                    inputQueryWithSubstitutions,
                    queryOperations.generateGovernanceQueries(request.getDataProducts())
            );

            Set<DataUdf> udfsList = QueryUtils.getUdfsList(request.getDataProducts());

            String query = SqlFormatter.formatSql(q, Optional.empty());
            if (!udfsList.isEmpty()) {
                // generate expressions starting with "EXTERNAL FUNCTION" for each lens
                String athenaLensLambda = System.getenv("ATHENA_LENS_LAMBDA");
                String resPrefix = QueryUtils.generateLensPrefix(udfsList, athenaLensLambda);

                query = resPrefix + query;
            }
            return ApiResponse.success(RewriteResponse.builder()
                    .query(query).build());
        } catch (NotAQueryException | ParsingException | CircularQueryReferenceException | IllegalArgumentException e) {
            return ApiResponse.badRequest(e.getMessage());
        }
    }
}
