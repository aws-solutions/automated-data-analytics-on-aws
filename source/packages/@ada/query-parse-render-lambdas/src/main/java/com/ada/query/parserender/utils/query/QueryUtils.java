/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.utils.query;

import com.ada.query.parserender.model.rewrite.DataUdf;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

public class QueryUtils {
    /**
     * Returns a hashset of DataUdf objects with nullible streams
     * 
     * @param dataProductsMap map of data products from parsing the request
     * @return hashset of udfs
     */
    public static Set<DataUdf> getUdfsList(
            Map<String, com.ada.query.parserender.model.rewrite.DataProduct> dataProductsMap) {
        return dataProductsMap.values().stream()
                .flatMap(dp -> Optional.ofNullable(dp.getColumns())
                        .orElse(new ArrayList<>())
                        .stream())
                .flatMap(dc -> Optional.ofNullable(dc.getUdfs())
                        .orElse(new ArrayList<>())
                        .stream())
                .collect(Collectors.toCollection(HashSet::new));
    }

    /**
     * Returns a formatted string for external function expressions
     * 
     * @param udfName       name of the user defined function (UDF)
     * @param udfInputType  inputType of UDF eg.VARCHAR
     * @param udfOutputType outputType of UDF eg.VARCHAR
     * @param awsService    eg. LAMBDA or sagemaker_endpoint
     * @param lambdaName    name of lambda containing all user defined functions
     * @return formatted string
     */
    public static String generateExternalFuncExpression(final String udfName, final String udfInputType,
            final String udfOutputType, final String awsService, String lambdaName) {
        return "EXTERNAL FUNCTION " + udfName + "(" + "type" + " " + udfInputType +
                ") RETURNS " + udfOutputType + " " + awsService + " '" + lambdaName + "' \n";
    }

    /**
     * Lens prefix sql expression generator
     * 
     * @param udfsList         the list of custom udfs to be used in the expression
     * @param athenaLensLambda name of lambda with custom udfs (a.k.a lens)
     * @return lens prefix
     */
    public static String generateLensPrefix(Set<DataUdf> udfsList, String athenaLensLambda) {
        String lensPrefix = "USING ";
        StringBuilder resPrefix = new StringBuilder(lensPrefix);
        List<String> externalFuncsList = new ArrayList<>();

        // generate the external function statement for each udf
        for (DataUdf udf : udfsList) {
            externalFuncsList.add(generateExternalFuncExpression(
                    udf.getName(), udf.getInputType(), udf.getOutputType(), "LAMBDA", athenaLensLambda));
        }
        // combine all statements joined by commas
        String result = String.join(",", externalFuncsList);

        // append result to end index of lensPrefix
        resPrefix.insert(lensPrefix.length(), result);
        return resPrefix.toString();
    }

    private QueryUtils() {
        throw new IllegalStateException("Utility class");
    }
}
