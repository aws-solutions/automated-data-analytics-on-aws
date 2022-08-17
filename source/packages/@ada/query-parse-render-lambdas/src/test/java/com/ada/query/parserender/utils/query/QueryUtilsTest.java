/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.utils.query;

import com.ada.query.parserender.model.rewrite.DataUdf;
import com.ada.query.parserender.model.rewrite.RewriteRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.util.Set;
import java.util.HashSet;

public class QueryUtilsTest {
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void getUdfsList_shouldReturnUniqueSetOfUdfs() throws JsonProcessingException {
        String jsonInput = "{\n" +
                "  \"dataProducts\": {\n" +
                "    \"orders\": {\n" +
                "      \"tableName\": \"catalog.processed_db.ada_orders\",\n" +
                "      \"columns\": [\n" +
                "        { \"name\": \"name\", \"attribute\": \"Name\", \"udfs\": [{ \"name\": \"hash\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  }], \"clauses\": [] },\n" +
                "        { \"name\": \"email\", \"udfs\": [], \"clauses\": [] },\n" +
                "        { \"name\": \"price\", \"attribute\": \"Finance\", \"udfs\": [{ \"name\": \"hash\",\"inputType\": \"VARCHAR\" ,\"outputType\": \"VARCHAR\"  }], \"clauses\": [\n" +
                "          \"FINANCE <= 100\", \"Finance <= 999\"\n" +
                "        ] }\n" +
                "      ]\n" +
                "    }\n" +
                "  }\n" +
                "}";
        RewriteRequest req = json.readValue(jsonInput, RewriteRequest.class);
        final Set<DataUdf> udfs = QueryUtils.getUdfsList(
                req.getDataProducts());

        Assertions.assertEquals(1, udfs.size());

        HashSet<DataUdf> expectedSet = new HashSet<>();
        expectedSet.add(DataUdf.builder()
                .name("hash")
                .inputType("VARCHAR")
                .outputType("VARCHAR")
                .build());

        Assertions.assertEquals(expectedSet, udfs);
    }

    @Test
    void generateLensPrefix_shouldReturnExternalFuncStatement() {
        HashSet<DataUdf> udfsList = new HashSet<>();
        udfsList.add(DataUdf.builder()
                .name("hash")
                .inputType("VARCHAR")
                .outputType("VARCHAR")
                .build());

        String result = QueryUtils.generateLensPrefix(udfsList, "AthenaLambda56261");
        String expected = "USING EXTERNAL FUNCTION hash(type VARCHAR) RETURNS VARCHAR LAMBDA 'AthenaLambda56261' \n";
        Assertions.assertEquals(expected, result);

        udfsList.add(DataUdf.builder()
                .name("addSalt")
                .inputType("VARCHAR")
                .outputType("VARCHAR")
                .build());

        result = QueryUtils.generateLensPrefix(udfsList, "AthenaLambda56261");
        expected = "USING EXTERNAL FUNCTION addSalt(type VARCHAR) RETURNS VARCHAR LAMBDA 'AthenaLambda56261' \n" +
        ",EXTERNAL FUNCTION hash(type VARCHAR) RETURNS VARCHAR LAMBDA 'AthenaLambda56261' \n";
        Assertions.assertEquals(expected, result);
    }

    @Test
    public void apiresponse_utility_class_cannot_be_instantiated() throws Exception {
        Constructor<QueryUtils> constructor = QueryUtils.class.getDeclaredConstructor();
        Assertions.assertTrue(Modifier.isPrivate(constructor.getModifiers()));
        constructor.setAccessible(true);
        Assertions.assertThrows(InvocationTargetException.class, () -> {
            constructor.newInstance((Object[]) null);
        });
    }
}
