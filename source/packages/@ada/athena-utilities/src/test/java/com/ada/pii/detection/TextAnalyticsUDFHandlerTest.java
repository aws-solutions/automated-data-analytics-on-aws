/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.pii.detection;

import com.amazonaws.athena.connector.lambda.data.Block;
import com.amazonaws.athena.connector.lambda.data.BlockAllocator;
import com.amazonaws.athena.connector.lambda.data.BlockAllocatorImpl;
import org.apache.arrow.vector.VarCharVector;
import org.apache.arrow.vector.types.pojo.ArrowType;
import org.apache.arrow.vector.types.pojo.Field;
import org.apache.arrow.vector.types.pojo.FieldType;
import org.apache.arrow.vector.types.pojo.Schema;
import org.apache.arrow.vector.util.Text;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.comprehend.ComprehendClient;
import software.amazon.awssdk.services.comprehend.model.DetectPiiEntitiesRequest;
import software.amazon.awssdk.services.comprehend.model.DetectPiiEntitiesResponse;
import software.amazon.awssdk.services.comprehend.model.PiiEntity;
import software.amazon.awssdk.services.comprehend.model.PiiEntityType;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
public class TextAnalyticsUDFHandlerTest {

    @Mock
    private ComprehendClient mockComprehendClient;

    private static String[] makeArray(String text, int len) {
        String[] textArray = new String[len];
        for (int i = 0; i < len; i++) {
            textArray[i] = text;
        }
        return textArray;
    }

    @Test
    public void testDetectPiiTypes() throws Exception {
        TextAnalyticsUDFHandler handler = new TextAnalyticsUDFHandler(mockComprehendClient);
        Mockito.when(mockComprehendClient.detectPiiEntities(Mockito.any(DetectPiiEntitiesRequest.class)))
                .thenReturn(DetectPiiEntitiesResponse.builder()
                        .entities(Arrays.asList(
                                PiiEntity.builder()
                                        .beginOffset(1)
                                        .endOffset(13)
                                        .type(PiiEntityType.ADDRESS)
                                        .score(0.99998444f)
                                        .build(),
                                PiiEntity.builder()
                                        .beginOffset(1)
                                        .endOffset(13)
                                        .type(PiiEntityType.NAME)
                                        .score(0.91f)
                                        .build()))
                        .build())
                .thenReturn(DetectPiiEntitiesResponse.builder()
                        .entities(Collections.singletonList(
                                PiiEntity.builder()
                                        .beginOffset(1)
                                        .endOffset(6)
                                        .type(PiiEntityType.NAME)
                                        .score(0.99998f)
                                        .build()))
                        .build());
        String[] text = new String[] { " 78 Test st ", "Jeff Bezos", " " };
        String[] lang = makeArray("en", 3);
        String[] result = handler.ada_detect_pii_types(text, lang);
        String[] expected = new String[] { "ADDRESS", "NAME", "", };
        assertArrayEquals(expected, result);
    }

    @Test
    public void testDetectPiiTypesShouldReturnEmmptyArrayWhenRowsAreEmpty() throws Exception {
        TextAnalyticsUDFHandler handler = new TextAnalyticsUDFHandler(mockComprehendClient);
        String[] text = new String[] { "", "", "" };
        String[] lang = makeArray("en", 3);
        String[] result = handler.ada_detect_pii_types(text, lang);
        String[] expected = new String[] { "", "", "", };
        assertArrayEquals(expected, result);
    }

    @Test
    public void testDetectPiiTypesOnJsonInputShouldReturnEmmptyArrayWhenRowsAreEmpty() throws Exception {
        TextAnalyticsUDFHandler handler = new TextAnalyticsUDFHandler(mockComprehendClient);
        String result = handler.ada_detect_pii_types("[\"\",\"\",\"\",\"\"]", "[\"en\"]");
        String expected = "[\"\",\"\",\"\",\"\"]";
        assertEquals(expected, result);
    }

    @Test
    public void testDetectPiiTypesShouldReturnEmmptyArrayWhenUntrimedRowsAreEmpty() throws Exception {
        TextAnalyticsUDFHandler handler = new TextAnalyticsUDFHandler(mockComprehendClient);
        String result = handler.ada_detect_pii_types("[\" \"]", "[\"en\"]");
        String expected = "[\"\"]";
        assertEquals(expected, result);
    }

    @Test
    public void testDetectPiiTypesShouldDetectNoneIfBelowThreshold() throws Exception {
        TextAnalyticsUDFHandler handler = new TextAnalyticsUDFHandler(mockComprehendClient);
        Mockito.when(mockComprehendClient.detectPiiEntities(Mockito.any(DetectPiiEntitiesRequest.class)))
                .thenReturn(DetectPiiEntitiesResponse.builder()
                        .entities(Collections.singletonList(
                                PiiEntity.builder()
                                        .beginOffset(1)
                                        .endOffset(13)
                                        .type(PiiEntityType.ADDRESS)
                                        .score(0.01f) // Low score
                                        .build()))
                        .build());
        String result = handler.ada_detect_pii_types("[\"Ambiguous\"]", "[\"en\"]");
        assertEquals("[\"\"]", result);
    }

    @Test
    public void testDetectPiiTypesLongInput() throws Exception {
        TextAnalyticsUDFHandler handler = new TextAnalyticsUDFHandler(mockComprehendClient);
        Mockito.when(mockComprehendClient.detectPiiEntities(Mockito.any(DetectPiiEntitiesRequest.class)))
                .thenReturn(DetectPiiEntitiesResponse.builder()
                        .entities(Collections.singletonList(
                                PiiEntity.builder()
                                        .beginOffset(1)
                                        .endOffset(6)
                                        .type(PiiEntityType.NAME)
                                        .score(0.99998f)
                                        .build()))
                        .build())
                .thenReturn(DetectPiiEntitiesResponse.builder()
                        .entities(Collections.emptyList())
                        .build());
        // Build a long string that should get split into different calls (2 batches)
        String paragraph = "This is a sample paragraph with a few sentences. The text udf handler splits text into batches of 5000 characters based on sentence breaks. This paragraph is 180 characters long!!";
        String[] text = new String[] {
                IntStream.range(0, (TextAnalyticsUDFHandler.MAX_TEXT_BYTES / paragraph.length()) + 2)
                        .mapToObj(i -> paragraph).collect(Collectors.joining(" ")) };
        String[] lang = makeArray("en", 1);
        String[] result = handler.ada_detect_pii_types(text, lang);
        String[] expected = new String[] { "NAME" };
        assertArrayEquals(expected, result);
    }

    @Test
    public void testDetectPiiTypesShouldSkipUnsplittableInput() throws Exception {
        TextAnalyticsUDFHandler handler = new TextAnalyticsUDFHandler(mockComprehendClient);
        // Build a long string that cannot be split into sentences
        String[] text = new String[] { IntStream.range(0, TextAnalyticsUDFHandler.MAX_TEXT_BYTES + 1).mapToObj(i -> "x")
                .collect(Collectors.joining("")) };
        String[] lang = makeArray("en", 1);
        String[] result = handler.ada_detect_pii_types(text, lang);

        // Expect no classification
        String[] expected = new String[] { "" };
        assertArrayEquals(expected, result);
        Mockito.verify(mockComprehendClient, Mockito.never())
                .detectPiiEntities(Mockito.any(DetectPiiEntitiesRequest.class));
    }

    @Test
    public void testMaxEntry() {
        TextAnalyticsUDFHandler handler = new TextAnalyticsUDFHandler(mockComprehendClient);
        Map<String, Integer> piiTypesToCounts = new HashMap<>();
        // setup equal amount for keys
        piiTypesToCounts.put("ADDRESS", 3);
        piiTypesToCounts.put("NAME", 3);

        String maxKey = handler.maxEntry(piiTypesToCounts).getKey();
        assertEquals("ADDRESS", maxKey);

        // insert new highest key
        piiTypesToCounts.put("ANOTHERKEY", 4);
        maxKey = handler.maxEntry(piiTypesToCounts).getKey();
        assertEquals("ANOTHERKEY", maxKey);
    }

    @Test
    public void testMaxEntryThrowsExceptionForEmptyMap() {
        assertThrows(NoSuchElementException.class,
                () -> new TextAnalyticsUDFHandler(mockComprehendClient).maxEntry(new HashMap<String, Integer>()));
    }

    @Test
    public void testMaxValue() {
        TextAnalyticsUDFHandler handler = new TextAnalyticsUDFHandler(mockComprehendClient);
        Map<String, Integer> piiTypesToCounts = new HashMap<>();
        piiTypesToCounts.put("ADDRESS", 3);
        piiTypesToCounts.put("NAME", 5);
        int maxValue = handler.maxEntry(piiTypesToCounts).getValue();
        assertEquals(5, maxValue);
    }

    @Test
    public void testCreateClientOverrideConfiguration() {
        assertTrue(
                new TextAnalyticsUDFHandler().createClientOverrideConfiguration().apiCallAttemptTimeout().isPresent());
    }

    @Test
    public void testProcessRowsShouldBatchCalls() throws Exception {
        Method method = TextAnalyticsUDFHandler.class.getMethod("ada_detect_pii_types", String.class, String.class);
        BlockAllocator allocator = new BlockAllocatorImpl();

        Mockito.when(mockComprehendClient.detectPiiEntities(Mockito.any(DetectPiiEntitiesRequest.class)))
                .thenReturn(DetectPiiEntitiesResponse.builder()
                        .entities(Collections.emptyList())
                        .build());

        // Build the input
        Schema inputSchema = new Schema(Arrays.asList(
                new Field("inputjson", FieldType.nullable(new ArrowType.Utf8()), null),
                new Field("languagejson", FieldType.nullable(new ArrowType.Utf8()), null)));
        Schema outputSchema = new Schema(
                Collections.singletonList(new Field("output", FieldType.nullable(new ArrowType.Utf8()), null)));

        int numRows = 5;
        Block input = allocator.createBlock(inputSchema);
        input.setRowCount(numRows);
        input.getFieldVectors().forEach(vector -> {
            vector.setInitialCapacity(numRows);
            vector.allocateNew();
            vector.setValueCount(numRows);
            System.out.println(vector.getClass().getCanonicalName());
            for (int i = 0; i < numRows; i++) {
                ((VarCharVector) vector).setSafe(i, new Text(String.format("value-%d", i)));
            }
        });

        Block output = new TextAnalyticsUDFHandler(mockComprehendClient).processRows(new BlockAllocatorImpl(), method,
                input, outputSchema);

        assertEquals(numRows, output.getFieldVectors().get(0).getValueCount());
        Mockito.verify(mockComprehendClient, Mockito.times(numRows))
                .detectPiiEntities(Mockito.any(DetectPiiEntitiesRequest.class));
    }
}
