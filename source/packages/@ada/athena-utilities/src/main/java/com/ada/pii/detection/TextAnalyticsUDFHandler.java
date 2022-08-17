/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.pii.detection;

import com.ada.pii.detection.model.PiiType;
import com.amazonaws.athena.connector.lambda.data.Block;
import com.amazonaws.athena.connector.lambda.data.BlockAllocator;
import com.amazonaws.athena.connector.lambda.data.BlockUtils;
import com.amazonaws.athena.connector.lambda.handlers.UserDefinedFunctionHandler;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.annotations.VisibleForTesting;
import com.google.gson.Gson;
import org.apache.arrow.vector.complex.reader.FieldReader;
import org.apache.arrow.vector.types.pojo.Field;
import org.apache.arrow.vector.types.pojo.Schema;
import org.json.JSONArray;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.retry.RetryPolicy;
import software.amazon.awssdk.core.retry.backoff.EqualJitterBackoffStrategy;
import software.amazon.awssdk.services.comprehend.ComprehendClient;
import software.amazon.awssdk.services.comprehend.model.DetectPiiEntitiesRequest;
import software.amazon.awssdk.services.comprehend.model.DetectPiiEntitiesResponse;
import software.amazon.awssdk.services.comprehend.model.PiiEntity;
import java.lang.reflect.Method;
import java.text.BreakIterator;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.nio.charset.StandardCharsets;

/**
 * Amazon Athena UDFs for pii detection using Amazon Comprehend
 * Reference:
 * https://github.com/aws-samples/aws-athena-udfs-textanalytics/tree/main/athena-udfs-textanalytics
 */
public class TextAnalyticsUDFHandler extends UserDefinedFunctionHandler {
    private static final Logger logger = LoggerFactory.getLogger(TextAnalyticsUDFHandler.class);

    private static final String SOURCE_TYPE = "athena_utilities_lens";

    // threshold must be above 90% confidence for a valid pii classification
    private static final Float PII_SCORE_THRESHOLD = (float) 0.9;

    public static final String MULTI_ROW_BATCH = "MULTI_ROW_BATCH";

    public TextAnalyticsUDFHandler(ComprehendClient comprehendClient) {
        super(SOURCE_TYPE);
        this.comprehendClient = comprehendClient;
    }

    public TextAnalyticsUDFHandler() {
        super(SOURCE_TYPE);
    }

    public static final int MAX_TEXT_BYTES = 5000; // utf8 bytes
    public static final int MAX_BATCH_SIZE = 25;

    private ComprehendClient comprehendClient;

    @VisibleForTesting
    protected ClientOverrideConfiguration createClientOverrideConfiguration() {
        // delays in milliseconds
        int retryBaseDelay = 500;
        int retryMaxBackoffTime = 600000;
        int maxRetries = 100;
        int timeout = 600000;
        RetryPolicy retryPolicy = RetryPolicy.defaultRetryPolicy().toBuilder()
                .numRetries(maxRetries)
                .backoffStrategy(EqualJitterBackoffStrategy.builder()
                        .baseDelay(Duration.ofMillis(retryBaseDelay))
                        .maxBackoffTime(Duration.ofMillis(retryMaxBackoffTime))
                        .build())
                .build();
        return ClientOverrideConfiguration.builder()
                .apiCallTimeout(Duration.ofMillis(timeout))
                .apiCallAttemptTimeout(Duration.ofMillis(timeout))
                .retryPolicy(retryPolicy)
                .build();
    }

    private ComprehendClient getComprehendClient() {
        // create client first time on demand
        if (this.comprehendClient == null) {
            logger.info("Creating Comprehend client connection X");
            this.comprehendClient = ComprehendClient.builder()
                    .overrideConfiguration(createClientOverrideConfiguration())
                    .build();
            logger.info​("Created Comprehend client connection");
        }
        return this.comprehendClient;
    }

    /**
     * DETECT / REDACT PII ENTITIES
     * =============================
     **/
    @SuppressWarnings("squid:S100")
    public String ada_detect_pii_types(String inputjson, String languagejson) throws Exception {
        String[] input = fromJSON(inputjson);
        String[] languageCodes = fromJSON(languagejson);
        return toJSON(ada_detect_pii_types(input, languageCodes));
    }

    /**
     * Given an array of input strings returns an array of nested JSON objects
     * representing the detected PII entities and confidence scores for each input
     * string
     *
     * @param input         an array of input strings
     * @param languageCodes an array of language codes corresponding to each input
     *                      string
     * @return an array of nested JSON objects with detect_pii_entities results for
     *         each input string
     */
    @SuppressWarnings("squid:S100")
    public String[] ada_detect_pii_types(String[] input, String[] languageCodes) throws Exception {
        return detect_pii_entities(input, languageCodes);
    }

    @SuppressWarnings({"squid:S100", "squid:S3776"})
    private String[] detect_pii_entities(String[] input, String[] languageCodes) throws Exception {
        // batch input records
        int rowCount = input.length;
        String[] result = new String[rowCount];
        if (allItemEmpty(input)) {
            Arrays.fill(result, "");
            return result;
        }
        int rowNum = 0;
        for (Object[] batch : getBatches(input, languageCodes, MAX_BATCH_SIZE, MAX_TEXT_BYTES)) {
            String[] textArray = (String[]) batch[0];
            String singleRowOrMultiRow = (String) batch[1];
            String languageCode = (String) batch[2];
            logger.debug​("Call comprehend DetectPiiEntities API - Batch => Language:" + languageCode +
                " Records: " + textArray.length);
            if (singleRowOrMultiRow.equals(MULTI_ROW_BATCH)) {
                // batchArray represents multiple output rows, one element per output row
                String[] multiRowResults = multiRowBatchDetectPiiEntities(languageCode, textArray);
                for (int i = 0; i < multiRowResults.length; i++) {
                    result[rowNum++] = multiRowResults[i];
                }
            } else {
                // batchArray represents single output row (long text split)
                String singleRowResults = textSplitBatchDetectPiiEntities(languageCode, textArray);
                result[rowNum++] = singleRowResults;
            }
        }

        Map<String, Integer> piiTypesToCounts = new HashMap<>();
        ObjectMapper mapper = new ObjectMapper();
        TypeReference<List<PiiType>> mapType = new TypeReference<List<PiiType>>() {
        };
        String notDetectedEntity = "";
        for (int i = 0; i < result.length; i++) {
            Map<String, Float> piiTypesToScores = new HashMap<>();
            List<PiiType> jsonToPiiTypeList = mapper.readValue(result[i], mapType);
            jsonToPiiTypeList.forEach(p -> {
                piiTypesToCounts.putIfAbsent(p.getType(), 0);
                piiTypesToScores.putIfAbsent(p.getType(), (float) 0);
                piiTypesToScores.computeIfPresent(p.getType(), (k, prev) -> p.getScore() >= prev ? p.getScore() : prev);
            });
            if (!piiTypesToScores.isEmpty()) {
                Map.Entry<String, Float> entry = maxEntry(piiTypesToScores);
                String key = entry.getKey();
                Float score = entry.getValue();
                // record pii value only if score is greater than threshold
                result[i] = score > PII_SCORE_THRESHOLD ? key : notDetectedEntity;
            } else {
                result[i] = notDetectedEntity;
            }
        }

        return result;
    }

    // returns the key with the highest value associated in a map
    public <K, V extends Comparable<V>> Map.Entry<K, V> maxEntry(Map<K, V> map) throws NoSuchElementException {
        Optional<Map.Entry<K, V>> maxEntry = map.entrySet()
                .stream()
                .max(Map.Entry.comparingByValue());
        if (!maxEntry.isPresent()) {
            throw new NoSuchElementException();
        }

        return maxEntry.get();
    }

    private String[] multiRowBatchDetectPiiEntities(String languageCode, String[] batch) {
        String[] result = new String[batch.length];
        // Call detectPiiEntities API in loop (no multidocument batch API available)
        for (int i = 0; i < batch.length; i++) {
            result[i] = detectPiiEntities(languageCode, batch[i]);
        }
        return result;
    }

    private String textSplitBatchDetectPiiEntities(String languageCode, String[] batch) {
        String[] result = new String[batch.length];
        int[] offset = new int[batch.length];
        // Call detectPiiEntities API in loop (no multidocument batch API available)
        int cumOffset = 0;
        for (int i = 0; i < batch.length; i++) {
            result[i] = detectPiiEntities(languageCode, batch[i]);
            offset[i] = cumOffset;
            cumOffset += batch[i].length();
        }
        // merge results to single output row
        return mergeEntitiesAll(result, offset);
    }

    /**
     * PRIVATE HELPER METHODS
     */

    // merges multiple results from detectEntities_all or detectPiiEntities_all into
    // a single string
    // apply offsets to the beginOffset and endOffset members of each detected
    // entity
    protected static String mergeEntitiesAll(String[] arrayOfJson, int[] offset) {
        JSONArray resultArray = new JSONArray();
        for (int i = 0; i < arrayOfJson.length; i++) {
            JSONArray entities = new JSONArray(arrayOfJson[i]);
            applyOffset(entities, offset[i]);
            resultArray.putAll(entities);
        }
        return resultArray.toString();
    }

    // apply offset to the values of beginOffset and endOffset in each result, so
    // that they match the original long input text
    protected static JSONArray applyOffset(JSONArray entities, int offset) {
        int size = entities.length();
        for (int i = 0; i < size; i++) {
            JSONObject entity = entities.getJSONObject(i);
            int beginOffset = entity.getInt("beginOffset");
            int endOffset = entity.getInt("endOffset");
            entity.put("beginOffset", beginOffset + offset);
            entity.put("endOffset", endOffset + offset);
        }
        return entities;
    }

    // splits input array into batches no larger than multiDocBatchSize
    private List<Object[]> getBatches(String[] input, String[] languageCodes, int multiRowBatchSize, int maxTextBytes)
            throws IllegalArgumentException, Exception {
        List<Object[]> batches = new ArrayList<>();
        String languageCode = languageCodes[0];
        int start = 0;
        int c = 0;
        for (int i = 0; i < input.length; i++) {
            if (c++ >= multiRowBatchSize || !languageCode.equals(languageCodes[i])) {
                // add a batch (not including current row), and reset c
                batches.add(new Object[] { Arrays.copyOfRange(input, start, i), MULTI_ROW_BATCH, languageCode });
                languageCode = languageCodes[i];
                start = i;
                c = 1;
            }
            int textLength = getUtf8StringLength(input[i]);
            // check if text is to long
            if (textLength > maxTextBytes) {
                // close off current multi-record batch before making new single record batch
                if (start < i) {
                    batches.add(new Object[] { Arrays.copyOfRange(input, start, i), MULTI_ROW_BATCH, languageCode });
                }
                // split this row and add the text splits as a new *TEXT_SPLIT_BATCH* batch
                String[] textSplit = splitLongText(input[i], maxTextBytes);
                logger.info("Split long text field (" + textLength + " bytes) into " + textSplit.length
                        + " segments of under " + maxTextBytes + " bytes");
                batches.add(new Object[] { textSplit, "TEXT_SPLIT_BATCH", languageCode });
                // increment counters for next row / next batch
                start = i + 1;
                c = 1;
                if (i < input.length) {
                    languageCode = languageCodes[i];
                }
            }
        }
        // last multi-record split
        if (start < input.length) {
            batches.add(
                    new Object[] { Arrays.copyOfRange(input, start, input.length), MULTI_ROW_BATCH, languageCode });
        }
        return batches;
    }

    protected static int getUtf8StringLength(String string) {
        final byte[] utf8Bytes = string.getBytes(StandardCharsets.UTF_8);
        return (utf8Bytes.length);
    }

    protected static String[] splitLongText(String longText, int maxTextBytes) {
        String[] sentences = splitStringBySentence(longText);
        // recombine sentences up to maxTextBytes
        List<String> splitBatches = new ArrayList<>();
        int bytesCnt = 0;
        int start = 0;
        for (int i = 0; i < sentences.length; i++) {
            int sentenceLength = getUtf8StringLength(sentences[i]);
            if (sentenceLength >= maxTextBytes) {
                logger.warn("DATA WARNING: sentence size (" + sentenceLength + " bytes) is larger than max ("
                        + maxTextBytes + " bytes). Unsplittable.");
                logger.warn("Problematic sentence: " + sentences[i]);
            }
            bytesCnt += sentenceLength;
            if (bytesCnt >= maxTextBytes) {
                // join sentences prior to this one, and add to splitBatches. Reset counters.
                String splitBatch = String.join("", Arrays.copyOfRange(sentences, start, i));
                int splitBatchLength = getUtf8StringLength(splitBatch);
                if (splitBatchLength == 0 || splitBatchLength > maxTextBytes) {
                    logger.debug("Split size is " + splitBatchLength + " bytes - Skipping.");
                } else {
                    logger.debug("Split size (" + splitBatchLength + " bytes)");
                    splitBatches.add(splitBatch);
                }
                start = i;
                bytesCnt = getUtf8StringLength(sentences[i]);
            }
        }
        // last split
        if (start < sentences.length) {
            String splitBatch = String.join("", Arrays.copyOfRange(sentences, start, sentences.length));
            int splitBatchLength = getUtf8StringLength(splitBatch);
            if (splitBatchLength == 0 || splitBatchLength > maxTextBytes) {
                logger.debug("Split size is " + splitBatchLength + " bytes - Skipping.");
            } else {
                logger.debug("Split size (" + splitBatchLength + " bytes)");
                splitBatches.add(splitBatch);
            }
        }
        return splitBatches.toArray(new String[0]);
    }

    protected static String[] splitStringBySentence(String longText) {
        BreakIterator boundary = BreakIterator.getSentenceInstance();
        boundary.setText(longText);
        List<String> sentencesList = new ArrayList<>();
        int start = boundary.first();
        for (int end = boundary.next(); end != BreakIterator.DONE; start = end, end = boundary.next()) {
            sentencesList.add(longText.substring(start, end));
        }
        return sentencesList.toArray(new String[0]);
    }

    protected static String toJSON(Object obj) {
        Gson gson = new Gson();
        return gson.toJson(obj);
    }

    protected static String[] fromJSON(String json) {
        Gson gson = new Gson();
        return gson.fromJson(json, String[].class);
    }

    /**
     * Processes a group by rows. This method takes in a block of data (containing
     * multiple rows), process them and
     * returns multiple rows of the output column in a block.
     * <p>
     * In the super class UDF methods are invoked row-by-row in a for loop.
     * This override method greatly improves throughput by batching records into
     * fewer calls using the Comprehend batch APIs.
     *
     * @param allocator    arrow memory allocator
     * @param udfMethod    the extracted java method matching the
     *                     User-Defined-Function defined in Athena.
     * @param inputRecords input data in Arrow format
     * @param outputSchema output data schema in Arrow format
     * @return output data in Arrow format
     */
    @Override
    protected Block processRows(BlockAllocator allocator, Method udfMethod, Block inputRecords, Schema outputSchema)
            throws IllegalArgumentException, Exception {
        int rowCount = inputRecords.getRowCount();
        int fieldCount = inputRecords.getFieldReaders().size();

        String[][] input = new String[fieldCount][rowCount];
        for (int fieldNum = 0; fieldNum < fieldCount; ++fieldNum) {
            for (int rowNum = 0; rowNum < rowCount; ++rowNum) {
                input[fieldNum][rowNum] = TextAnalyticsUDFHandler.getStringValue(inputRecords, fieldNum, rowNum);
            }
        }
        // input and output arrays serialised to JSON strings, to match the method
        // signature declared in the UDF.
        String[] inputjson = new String[fieldCount];
        for (int fieldNum = 0; fieldNum < fieldCount; ++fieldNum) {
            inputjson[fieldNum] = toJSON(input[fieldNum]);
        }
        // now call the udf with the right number of arguments, per fieldCount
        String resultjson;
        switch (fieldCount) {
            case 1:
                resultjson = (String) udfMethod.invoke(this, inputjson[0]);
                break;
            case 2:
                resultjson = (String) udfMethod.invoke(this, inputjson[0], inputjson[1]);
                break;
            case 3:
                resultjson = (String) udfMethod.invoke(this, inputjson[0], inputjson[1], inputjson[2]);
                break;
            case 4:
                resultjson = (String) udfMethod.invoke(this, inputjson[0], inputjson[1], inputjson[2], inputjson[3]);
                break;
            default:
                throw new IllegalArgumentException("Unsupported field count of " + fieldCount + "; support count range of 1-4");
        }
        String[] result = fromJSON(resultjson);
        Field outputField = outputSchema.getFields().get(0);
        Block outputRecords = allocator.createBlock(outputSchema);
        outputRecords.setRowCount(rowCount);
        for (int rowNum = 0; rowNum < rowCount; ++rowNum) {
            outputRecords.setValue(outputField.getName(), rowNum, result[rowNum]);
        }
        return outputRecords;
    }

    /**
     * Used to convert a specific field from row in the provided Block to a String
     * value.
     * Code adapted from BlockUtils.rowToString.
     *
     * @param block The Block to read the row from.
     * @param field The field number to read.
     * @param row   The row number to read.
     * @return The String representation of the requested row.
     */
    private static String getStringValue(Block block, int field, int row) {
        if (row > block.getRowCount()) {
            throw new IllegalArgumentException(row + " exceeds available rows " + block.getRowCount());
        }
        StringBuilder sb = new StringBuilder();
        FieldReader fieldReader = block.getFieldReaders().get(field);
        fieldReader.setPosition(row);
        sb.append(BlockUtils.fieldToString(fieldReader));
        return sb.toString();
    }

    private String detectPiiEntities(final String languageCode, final String text) {
        if (itemIsNullOrEmpty(text)) {
            return "[]";
        } else {
            DetectPiiEntitiesRequest detectPiiEntitiesRequest = DetectPiiEntitiesRequest.builder()
                    .text(text)
                    .languageCode(languageCode)
                    .build();
            DetectPiiEntitiesResponse detectPiiEntitiesResponse = getComprehendClient()
                    .detectPiiEntities(detectPiiEntitiesRequest);
            List<PiiEntity> piiEntities = detectPiiEntitiesResponse.entities();
            // return JSON structure containing all entity types, scores and offsets
            return toJSON(piiEntities);
        }
    }

    /**
     * Check if input string array is empty
     *
     * @param input
     * @return true if array is empty
     */
    private boolean allItemEmpty(String[] input) {
        for (String item : input) {
            if (!itemIsNullOrEmpty(item)) {
                return false;
            }
        }
        return true;
    }

    private boolean itemIsNullOrEmpty(String item) {
        return item == null || item.trim().isEmpty();
    }
}
