/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.handlers;

import com.ada.query.parserender.model.rewrite.DataProduct;
import com.ada.query.parserender.model.rewrite.QuerySubstitution;
import com.ada.query.parserender.model.rewrite.RewriteRequest;
import com.ada.query.parserender.model.rewrite.RewriteResponse;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import uk.org.webcompere.systemstubs.environment.EnvironmentVariables;
import uk.org.webcompere.systemstubs.jupiter.SystemStub;
import uk.org.webcompere.systemstubs.jupiter.SystemStubsExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(SystemStubsExtension.class)
public class RewriteHandlerTest {
    private final ObjectMapper json = new ObjectMapper();
    private final RewriteHandler handler = new RewriteHandler();

    @SystemStub
    static EnvironmentVariables testWideVariables;

    @BeforeAll
    static void beforeAll() {
        testWideVariables.set("ATHENA_LENS_LAMBDA", "AthenaLensLambdaw6b8fz4603");
    }

    @Test
    public void handleRequest_shouldQuoteColumnNames() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"catalog.processed_db.ada_orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"group\" }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders", req.getDataProducts()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(200, result.getStatusCode());
        assertEquals("SELECT *\n" +
                "FROM\n" +
                "  (\n" +
                "   SELECT \"group\"\n" +
                "   FROM\n" +
                "     catalog.processed_db.ada_orders\n" +
                ") \n", response.getQuery());
    }

    @Test
    public void handleRequest_shouldRunASimpleRewrite() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"catalog.processed_db.ada_orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"name\", \"attribute\": \"Name\", \"udfs\": [{ \"name\": \"hash\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  }], \"clauses\": [] },\n"
                +
                "        { \"name\": \"email\", \"udfs\": [{ \"name\": \"hash\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  }], \"clauses\": [] },\n"
                +
                "        { \"name\": \"price\", \"attribute\": \"Finance\", \"udfs\": [], \"clauses\": [\n" +
                "          \"FINANCE <= 100\", \"Finance <= 999\"\n" +
                "        ] }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders WHERE age >= 18", req.getDataProducts()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(200, result.getStatusCode());
        assertEquals("" +
                "USING EXTERNAL FUNCTION hash(type VARCHAR) RETURNS VARCHAR LAMBDA 'AthenaLensLambdaw6b8fz4603' \n" +
                "SELECT *\n" +
                "FROM\n" +
                "  (\n" +
                "   SELECT\n" +
                "     \"hash\"(CAST(\"name\" AS varchar)) \"name\"\n" +
                "   , \"hash\"(CAST(\"email\" AS varchar)) \"email\"\n" +
                "   , \"price\"\n" +
                "   FROM\n" +
                "     catalog.processed_db.ada_orders\n" +
                "   WHERE ((price <= 100) OR (price <= 999))\n" +
                ") \n" +
                "WHERE (age >= 18)\n",
                response.getQuery());
    }

    @Test
    public void handleRequest_shouldRunIfUdfsOrClausesAreMissing() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"catalog.processed_db.ada_orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"email\" }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders", req.getDataProducts()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(200, result.getStatusCode());
        assertEquals("SELECT *\n" +
                "FROM\n" +
                "  (\n" +
                "   SELECT \"email\"\n" +
                "   FROM\n" +
                "     catalog.processed_db.ada_orders\n" +
                ") \n", response.getQuery());
    }

    @Test
    public void handleRequest_shouldGenerateAQueryIfTableNameHasQuotes() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"\\\"catalog\\\".\\\"processed_db\\\".\\\"ada_orders\\\"\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"email\" }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders", req.getDataProducts()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(200, result.getStatusCode());
        assertEquals("SELECT *\n" +
                "FROM\n" +
                "  (\n" +
                "   SELECT \"email\"\n" +
                "   FROM\n" +
                "     catalog.processed_db.ada_orders\n" +
                ") \n", response.getQuery());
    }

    @Test
    public void handleRequest_shouldGenerateAQueryIfTableNameHasOnePartOnly() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"catalog\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"email\" }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders", req.getDataProducts()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(200, result.getStatusCode());
        assertEquals("SELECT *\n" +
                "FROM\n" +
                "  (\n" +
                "   SELECT \"email\"\n" +
                "   FROM\n" +
                "     catalog\n" +
                ") \n", response.getQuery());
    }

    @Test
    public void handleRequest_shouldSelectivelyRemoveQuotesFromTableNamePartsWhereAreNotNeeded() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"\\\"catalog\\\".\\\"processed_db\\\".\\\"ada-orders\\\"\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"email\" }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM \"orders\"", req.getDataProducts()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(200, result.getStatusCode());
        assertEquals("SELECT *\n" +
                "FROM\n" +
                "  (\n" +
                "   SELECT \"email\"\n" +
                "   FROM\n" +
                "     catalog.processed_db.\"ada-orders\"\n" +
                ") \n", response.getQuery());
    }

    @Test
    public void handleRequest_shouldNotSplitTheDotIfWrappedInQuotes() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"\\\"catalog\\\".\\\"processed.db\\\".\\\"ada.orders\\\"\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"email\" }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders", req.getDataProducts()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(200, result.getStatusCode());
        assertEquals("SELECT *\n" +
                "FROM\n" +
                "  (\n" +
                "   SELECT \"email\"\n" +
                "   FROM\n" +
                "     catalog.\"processed.db\".\"ada.orders\"\n" +
                ") \n", response.getQuery());
    }

    @Test
    public void handleRequest_shouldWrapPartsInQuoteIfSpecialCharsHaveBeenFound() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"AwsDataCatalog.processed_db.ada-orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"email\" }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders", req.getDataProducts()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(200, result.getStatusCode());
        assertEquals("SELECT *\n" +
                "FROM\n" +
                "  (\n" +
                "   SELECT \"email\"\n" +
                "   FROM\n" +
                "     \"AwsDataCatalog\".processed_db.\"ada-orders\"\n" +
                ") \n", response.getQuery());
    }

    @Test
    public void handleRequest_shouldRunAndGenerateNestedUdfs() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"catalog.processed_db.ada_orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"email\", \"udfs\": [{ \"name\": \"substr\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  }, { \"name\": \"hash\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  },{ \"name\": \"addSalt\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  }] }\n"
                +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders", req.getDataProducts()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(200, result.getStatusCode());
        assertEquals("" +
                "USING EXTERNAL FUNCTION addSalt(type VARCHAR) RETURNS VARCHAR LAMBDA 'AthenaLensLambdaw6b8fz4603' \n" +
                ",EXTERNAL FUNCTION hash(type VARCHAR) RETURNS VARCHAR LAMBDA 'AthenaLensLambdaw6b8fz4603' \n" +
                ",EXTERNAL FUNCTION substr(type VARCHAR) RETURNS VARCHAR LAMBDA 'AthenaLensLambdaw6b8fz4603' \n" +
                "SELECT *\n" +
                "FROM\n" +
                "  (\n" +
                "   SELECT \"substr\"(CAST(\"hash\"(CAST(\"addsalt\"(CAST(\"email\" AS varchar)) AS varchar)) AS varchar)) \"email\"\n"
                +
                "   FROM\n" +
                "     catalog.processed_db.ada_orders\n" +
                ") \n", response.getQuery());
    }

    @Test
    public void handleRequest_shouldRewriteAComplexQuery() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"catalog.processed_db.ada_orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"name\", \"udfs\": [{ \"name\": \"substr\",\"inputType\": \"FLOAT\" ,\"outputType\": \"VARCHAR\" }, { \"name\": \"hash\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  }] },\n"
                +
                "        { \"name\": \"email\" },\n" +
                "        { \"name\": \"price\", \"attribute\": \"Finance\", \"clauses\": [\n" +
                "          \"FINANCE > 100\", \"Finance <= 10000\"\n" +
                "        ] },\n" +
                "        { \"name\": \"available\", \"attribute\": \"Enabled\", \"clauses\": [\n" +
                "          \"ENABLED = 'true'\"\n" +
                "        ] },\n" +
                "        { \"name\": \"nation\", \"attribute\": \"Country\", \"clauses\": [\n" +
                "          \"COUNTRY = 'Singapore'\"\n" +
                "        ] },\n" +
                "        { \"name\": \"createdBy\" },\n" +
                "        { \"name\": \"createdAt\" }\n" +
                "      ]\n" +
                "    },\n" +
                "    \"testOrders\": {\n" +
                "      \"tableName\": \"catalog.processed_db.ada_test_orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"name\" },\n" +
                "        { \"name\": \"email\" },\n" +
                "        { \"name\": \"price\" },\n" +
                "        { \"name\": \"enabled\" },\n" +
                "        { \"name\": \"nation\" },\n" +
                "        { \"name\": \"createdBy\", \"attribute\": \"User\", \"clauses\": [\n" +
                "          \"User LIKE 'sys.%'\"\n" +
                "        ] },\n" +
                "        { \"name\": \"createdAt\", \"attribute\": \"CreationDate\", \"clauses\": [\n" +
                "          \"CreationDate BETWEEN '2000-01-01' AND '2021-01-01'\"\n" +
                "        ] }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM (\n" +
                        "  SELECT \"name\", \"price\", 'prod' as env FROM orders\n" +
                        "  UNION\n" +
                        "  SELECT \"name\", \"price\", 'test' as env FROM testOrders\n" +
                        ") WHERE createdAt BETWEEN '2020-01-01' AND '2021-01-01'", req.getDataProducts()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(200, result.getStatusCode());
        assertEquals("" +
                "USING EXTERNAL FUNCTION hash(type VARCHAR) RETURNS VARCHAR LAMBDA 'AthenaLensLambdaw6b8fz4603' \n" +
                ",EXTERNAL FUNCTION substr(type FLOAT) RETURNS VARCHAR LAMBDA 'AthenaLensLambdaw6b8fz4603' \n" +
                "SELECT *\n" +
                "FROM\n" +
                "  (\n" +
                "   SELECT\n" +
                "     \"name\"\n" +
                "   , \"price\"\n" +
                "   , 'prod' env\n" +
                "   FROM\n" +
                "     (\n" +
                "      SELECT\n" +
                "        \"substr\"(CAST(\"hash\"(CAST(\"name\" AS varchar)) AS float)) \"name\"\n" +
                "      , \"email\"\n" +
                "      , \"price\"\n" +
                "      , \"available\"\n" +
                "      , \"nation\"\n" +
                "      , \"createdBy\"\n" +
                "      , \"createdAt\"\n" +
                "      FROM\n" +
                "        catalog.processed_db.ada_orders\n" +
                "      WHERE ((((price > 100) OR (price <= 10000)) AND (available = 'true')) AND (nation = 'Singapore'))\n"
                +
                "   ) \n" +
                "UNION    SELECT\n" +
                "     \"name\"\n" +
                "   , \"price\"\n" +
                "   , 'test' env\n" +
                "   FROM\n" +
                "     (\n" +
                "      SELECT\n" +
                "        \"name\"\n" +
                "      , \"email\"\n" +
                "      , \"price\"\n" +
                "      , \"enabled\"\n" +
                "      , \"nation\"\n" +
                "      , \"createdBy\"\n" +
                "      , \"createdAt\"\n" +
                "      FROM\n" +
                "        catalog.processed_db.ada_test_orders\n" +
                "      WHERE ((createdBy LIKE 'sys.%') AND (createdAt BETWEEN '2000-01-01' AND '2021-01-01'))\n" +
                "   ) \n" +
                ") \n" +
                "WHERE (createdAt BETWEEN '2020-01-01' AND '2021-01-01')\n",
                response.getQuery());
    }

    @Test
    public void handleRequest_shouldReturn400IfTableNameIsMissing() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"email\" }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders", req.getDataProducts()),
                null);
        assertEquals(400, result.getStatusCode());
    }

    @Test
    public void handleRequest_shouldReturn400IfColumnNameIsMissing() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"AwsDataCatalog.processed_db.ada_orders\",\n" +
                "      \"columns\": [\n" +
                "        {  }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders", req.getDataProducts()),
                null);
        assertEquals(400, result.getStatusCode());
    }

    @Test
    public void handleRequest_shouldReturn400IfAttributeIsNotDefinedWhenClausesAreDefined() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"AwsDataCatalog.processed_db.ada_orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"price\", \"udfs\": [], \"clauses\": [\n" +
                "          \"FINANCE <= 100\", \"Finance <= 999\"\n" +
                "        ] }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders WHERE age >= 18", req.getDataProducts()),
                null);
        assertEquals(400, result.getStatusCode());
    }

    @Test
    public void handleRequest_shouldReturn400IfNonAttributeIsReferenced() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"AwsDataCatalog.processed_db.ada_orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"price\", \"udfs\": [], \"attribute\": \"Name\", \"clauses\": [\n" +
                "          \"FINANCE <= 100\", \"Finance <= 999\"\n" +
                "        ] }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM orders WHERE age >= 18", req.getDataProducts()),
                null);
        assertEquals(400, result.getStatusCode());
    }

    @Test
    public void handleRequest_shouldApplyQuerySubstitutionsBeforeGovernance() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"catalog.processed_db.ada_orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"name\", \"attribute\": \"Name\", \"udfs\": [{ \"name\": \"hash\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  }], \"clauses\": [] },\n"
                +
                "        { \"name\": \"email\", \"udfs\": [{ \"name\": \"hash\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  }], \"clauses\": [] },\n"
                +
                "        { \"name\": \"price\", \"attribute\": \"Finance\", \"udfs\": [], \"clauses\": [\n" +
                "          \"FINANCE <= 100\", \"Finance <= 999\"\n" +
                "        ] }\n" +
                "      ]\n" +
                "    }\n" +
                "  },\n" +
                "  \"querySubstitutions\": {\n" +
                "     \"my.query.one\": {\n" +
                "       \"query\": \"SELECT * FROM orders\"\n" +
                "     }\n" +
                "   }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM my.query.one WHERE age >= 18", req.getDataProducts(),
                        req.getQuerySubstitutions()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(200, result.getStatusCode());
        assertEquals("" +
                "USING EXTERNAL FUNCTION hash(type VARCHAR) RETURNS VARCHAR LAMBDA 'AthenaLensLambdaw6b8fz4603' \n" +
                "SELECT *\n" +
                "FROM\n" +
                "  (\n" +
                "   SELECT *\n" +
                "   FROM\n" +
                "     (\n" +
                "      SELECT\n" +
                "        \"hash\"(CAST(\"name\" AS varchar)) \"name\"\n" +
                "      , \"hash\"(CAST(\"email\" AS varchar)) \"email\"\n" +
                "      , \"price\"\n" +
                "      FROM\n" +
                "        catalog.processed_db.ada_orders\n" +
                "      WHERE ((price <= 100) OR (price <= 999))\n" +
                "   ) \n" +
                ") \n" +
                "WHERE (age >= 18)\n",
                response.getQuery());
    }

    @Test
    public void handleRequest_shouldReturn400ForACircularQueryReference() throws Exception {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"catalog.processed_db.ada_orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"name\", \"attribute\": \"Name\", \"udfs\": [{ \"name\": \"hash\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  }], \"clauses\": [] },\n"
                +
                "        { \"name\": \"email\", \"udfs\": [{ \"name\": \"hash\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  }], \"clauses\": [] },\n"
                +
                "        { \"name\": \"price\", \"attribute\": \"Finance\", \"udfs\": [], \"clauses\": [\n" +
                "          \"FINANCE <= 100\", \"Finance <= 999\"\n" +
                "        ] }\n" +
                "      ]\n" +
                "    }\n" +
                "  },\n" +
                "  \"querySubstitutions\": {\n" +
                "     \"my.query.one\": {\n" +
                "       \"query\": \"SELECT * FROM my.query.one\"\n" +
                "     }\n" +
                "   }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);

        APIGatewayProxyResponseEvent result = handler.handleRequest(
                buildRequest("SELECT * FROM my.query.one WHERE age >= 18", req.getDataProducts(),
                        req.getQuerySubstitutions()),
                null);
        RewriteResponse response = json.readValue(result.getBody(), RewriteResponse.class);
        assertEquals(400, result.getStatusCode());
    }

    @Test
    public void handleRequest_shouldRaiseJsonProcessingErrorOnInvalidInput() throws Exception {

        APIGatewayProxyResponseEvent result = handler.handleRequest(new APIGatewayProxyRequestEvent()
                .withBody(json.writeValueAsString("incorrectjson")), null);

        System.out.println(result.getBody());
        assertEquals("{\"message\":\"Failed to read input\"}", result.getBody());
    }

    private APIGatewayProxyRequestEvent buildRequest(final String query, Map<String, DataProduct> dataProducts)
            throws Exception {
        return buildRequest(query, dataProducts, null);
    }

    private APIGatewayProxyRequestEvent buildRequest(final String query, Map<String, DataProduct> dataProducts,
            Map<String, QuerySubstitution> substitutions) throws Exception {
        return new APIGatewayProxyRequestEvent()
                .withBody(json.writeValueAsString(RewriteRequest.builder().query(query).dataProducts(dataProducts)
                        .querySubstitutions(substitutions).build()));
    }
}
