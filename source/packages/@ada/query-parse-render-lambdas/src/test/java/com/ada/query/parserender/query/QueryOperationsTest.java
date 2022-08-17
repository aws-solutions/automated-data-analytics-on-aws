/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.query;

import com.ada.query.parserender.exceptions.CircularQueryReferenceException;
import com.ada.query.parserender.exceptions.NotAQueryException;
import com.ada.query.parserender.model.discover.DiscoveredTable;
import com.ada.query.parserender.model.rewrite.QuerySubstitution;
import com.facebook.presto.sql.parser.ParsingException;
import com.facebook.presto.sql.tree.Query;
import com.google.common.collect.ImmutableMap;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public class QueryOperationsTest {
    private final QueryOperations queryOperations = new QueryOperations();

    @Test
    public void parseQuery_shouldParseAValidQuery() throws Exception {
        Query query = queryOperations.parseQuery("SELECT * FROM sales.customers");
        Assertions.assertNotNull(query);
    }

    @Test
    public void parseQuery_shouldParseWithAlias() throws Exception {
        Query query = queryOperations.parseQuery("SELECT customFunction(name) as name FROM sales.customers");
        Assertions.assertNotNull(query);
    }

    @Test
    public void parseQuery_shouldParseExpression() throws Exception {
        Query query = queryOperations.parseQuery("SELECT * FROM dummy.dummy WHERE (FINANCE <= 100 or FINANCE >= 10) AND (email like '%gmail.com') AND (enabled = 'true')");
        Assertions.assertNotNull(query);
    }

    @Test
    public void parseQuery_shouldThrowAnExceptionForOtherValidSqlStatements() {
        Assertions.assertThrows(NotAQueryException.class, () ->
                queryOperations.parseQuery("CREATE TABLE customers(id int, name varchar(20))"));
    }

    @Test
    public void parseQuery_shouldThrowAnExceptionForInvalidSql() {
        Assertions.assertThrows(ParsingException.class, () ->
                queryOperations.parseQuery("SEEEELECT something"));
    }

    @Test
    public void parseQuery_shouldThrowAnExceptionForMultipleQueries() {
        Assertions.assertThrows(ParsingException.class, () ->
                queryOperations.parseQuery("SELECT * FROM sales.customers; SELECT * FROM orders"));
    }

    @Test
    public void findDataProducts_shouldFindADataProductWithADomainAndDataSet() throws Exception {
        Set<DiscoveredTable> discoveredTables = queryOperations.findTables(
                queryOperations.parseQuery("SELECT * FROM sales.customers.sessions"));

        Assertions.assertEquals(1, discoveredTables.size());
        Assertions.assertEquals(new HashSet<>(Collections.singletonList(DiscoveredTable.builder()
                .identifierParts(Arrays.asList("sales", "customers", "sessions"))
                .build())), discoveredTables);
    }

    @Test
    public void findDataProducts_shouldFindADataProductWithADomain() throws Exception {
        Set<DiscoveredTable> discoveredTables = queryOperations.findTables(
                queryOperations.parseQuery("SELECT * FROM sales.customers"));

        Assertions.assertEquals(1, discoveredTables.size());
        Assertions.assertEquals(new HashSet<>(Collections.singletonList(DiscoveredTable.builder()
                .identifierParts(Arrays.asList("sales", "customers"))
                .build())), discoveredTables);
    }

    @Test
    public void findDataProducts_shouldFindADataProductWithASingleIdentifierPart() throws Exception {
        Set<DiscoveredTable> discoveredTables = queryOperations.findTables(
                queryOperations.parseQuery("SELECT * FROM single"));

        Assertions.assertEquals(1, discoveredTables.size());
        Assertions.assertEquals(new HashSet<>(Collections.singletonList(DiscoveredTable.builder()
                .identifierParts(Collections.singletonList("single"))
                .build())), discoveredTables);
    }

    @Test
    public void findDataProducts_shouldFindMultipleDataProducts() throws Exception {
        Set<DiscoveredTable> discoveredTables = queryOperations.findTables(
                queryOperations.parseQuery("SELECT * FROM sales.customers JOIN marketing.customers ON sales.customers.id = marketing.customers.id"));

        Assertions.assertEquals(2, discoveredTables.size());
        Assertions.assertEquals(new HashSet<>(Arrays.asList(
                DiscoveredTable.builder()
                        .identifierParts(Arrays.asList("sales", "customers"))
                        .build(),
                DiscoveredTable.builder()
                        .identifierParts(Arrays.asList("marketing", "customers"))
                        .build())), discoveredTables);
    }

    @Test
    public void findDataProducts_shouldFindMultipleDataProductsInNestedQuery() throws Exception {
        Set<DiscoveredTable> discoveredTables = queryOperations.findTables(
                queryOperations.parseQuery("SELECT AVG(number_of_students)\n" +
                        "FROM school.classes\n" +
                        "WHERE teacher_id IN (\n" +
                        "    SELECT id\n" +
                        "    FROM school.teachers\n" +
                        "    WHERE subject = 'English' OR subject = 'History')"));

        Assertions.assertEquals(2, discoveredTables.size());
        Assertions.assertEquals(new HashSet<>(Arrays.asList(
                DiscoveredTable.builder()
                        .identifierParts(Arrays.asList("school", "classes"))
                        .build(),
                DiscoveredTable.builder()
                        .identifierParts(Arrays.asList("school", "teachers"))
                        .build())), discoveredTables);
    }

    @Test
    public void replaceDataProductsWithGovernanceQueries_shouldReplaceDataProducts() throws Exception {
        assertReplacesDataProductsWithGovernanceQueries("SELECT * FROM foo.bar", ImmutableMap.of(
                "foo.bar", "SELECT * FROM governed.foo"
        ), "SELECT * FROM (SELECT * FROM governed.foo)");
    }

    @Test
    public void replaceDataProductsWithGovernanceQueries_shouldReplaceDataProductsCaseInsensitive() throws Exception {
        assertReplacesDataProductsWithGovernanceQueries("SELECT * FROM FooCase", ImmutableMap.of(
                "FooCase", "SELECT * FROM governed.foo"
        ), "SELECT * FROM (SELECT * FROM governed.foo)");

        assertReplacesDataProductsWithGovernanceQueries("SELECT * FROM FooCase", ImmutableMap.of(
                "foocase", "SELECT * FROM governed.foo"
        ), "SELECT * FROM (SELECT * FROM governed.foo)");
    }

    @Test
    public void replaceDataProductsWithGovernanceQueries_shouldReplaceMultipleDataProducts() throws Exception {
        assertReplacesDataProductsWithGovernanceQueries("SELECT * FROM sales.customers JOIN marketing.customers ON sales.customers.id = marketing.customers.id", ImmutableMap.of(
                "sales.customers", "SELECT id, hash(name) as name FROM sales.customers WHERE type != 'VIP'",
                "marketing.customers", "SELECT id, hash(name) as name FROM marketing.customers WHERE type != 'VIP'"
        ), "SELECT * FROM " +
                "(SELECT id, hash(name) as name FROM sales.customers WHERE type != 'VIP') " +
                "JOIN " +
                "(SELECT id, hash(name) as name FROM marketing.customers WHERE type != 'VIP') " +
                "ON sales.customers.id = marketing.customers.id");
    }

    @Test
    public void replaceDataProductsWithGovernanceQueries_shouldReplaceDataProductsInNestedQueries() throws Exception {
        assertReplacesDataProductsWithGovernanceQueries("SELECT AVG(number_of_students)\n" +
                "FROM school.classes\n" +
                "WHERE teacher_id IN (\n" +
                "    SELECT id\n" +
                "    FROM school.teachers\n" +
                "    WHERE subject = 'English' OR subject = 'History')", ImmutableMap.of(
                "school.teachers", "SELECT id, subject, hash(salary) FROM school.teachers",
                "school.classes", "SELECT teacher_id, number_of_students FROM school.classes"
        ), "SELECT AVG(number_of_students)\n" +
                "FROM (SELECT teacher_id, number_of_students FROM school.classes)\n" +
                "WHERE teacher_id IN (\n" +
                "    SELECT id\n" +
                "    FROM (SELECT id, subject, hash(salary) FROM school.teachers)\n" +
                "    WHERE subject = 'English' OR subject = 'History')");
    }

    @Test
    public void applyQuerySubstitutions_shouldSkipApplicationWhenThereAreNoSubstitutions() throws Exception {
        Query inputQuery = queryOperations.parseQuery("SELECT * FROM data.product");
        Assertions.assertEquals(inputQuery, queryOperations.applyQuerySubstitutions(inputQuery, null));
    }

    @Test
    public void applyQuerySubstitutions_shouldSkipApplicationWhenSubstitutionsAreEmpty() throws Exception {
        Query inputQuery = queryOperations.parseQuery("SELECT * FROM data.product");
        Assertions.assertEquals(inputQuery, queryOperations.applyQuerySubstitutions(inputQuery, new HashMap<>()));
    }

    @Test
    public void applyQuerySubstitutions_shouldThrowForNonQuerySubstitutions() throws Exception {
        Assertions.assertThrows(NotAQueryException.class, () ->
                queryOperations.applyQuerySubstitutions(queryOperations.parseQuery("SELECT * FROM my.query"), ImmutableMap.of(
                        "my.query", QuerySubstitution.builder().query("CREATE TABLE customers(id int, name varchar(20))").build()
                )));
    }

    @Test
    public void applyQuerySubstitutions_shouldThrowForInvalidSubstitutionSql() throws Exception {
        Assertions.assertThrows(ParsingException.class, () ->
                queryOperations.applyQuerySubstitutions(queryOperations.parseQuery("SELECT * FROM my.query"), ImmutableMap.of(
                        "my.query", QuerySubstitution.builder().query("NOT A VALID SQL QUERY!").build()
                )));
    }

    @Test
    public void applyQuerySubstitutions_shouldApplyASubstitution() throws Exception {
        Query outputQuery = queryOperations.applyQuerySubstitutions(queryOperations.parseQuery("SELECT * FROM my.query.do_things"), ImmutableMap.of(
                "my.query.do_things", QuerySubstitution.builder().query("SELECT * FROM data.product").build()
        ));

        Assertions.assertEquals(queryOperations.parseQuery("SELECT * FROM (SELECT * FROM data.product)"), outputQuery);
    }

    @Test
    public void applyQuerySubstitutions_shouldApplyMultipleSubstitutions() throws Exception {
        Query outputQuery = queryOperations.applyQuerySubstitutions(queryOperations.parseQuery("SELECT * FROM my.query.do_things INNER JOIN domain.query.another ON foo = bar"), ImmutableMap.of(
                "my.query.do_things", QuerySubstitution.builder().query("SELECT * FROM data.product").build(),
                "domain.query.another", QuerySubstitution.builder().query("SELECT * FROM another.data.product").build()
        ));

        Assertions.assertEquals(queryOperations.parseQuery("SELECT * FROM (SELECT * FROM data.product) INNER JOIN (SELECT * FROM another.data.product) ON foo = bar"), outputQuery);
    }

    @Test
    public void applyQuerySubstitutions_shouldAllowMixturesOfQueriesAndDataProducts() throws Exception {
        Query outputQuery = queryOperations.applyQuerySubstitutions(queryOperations.parseQuery("SELECT * FROM my.query.do_things INNER JOIN some.data.product ON foo = bar"), ImmutableMap.of(
                "my.query.do_things", QuerySubstitution.builder().query("SELECT * FROM data.product").build()
        ));

        Assertions.assertEquals(queryOperations.parseQuery("SELECT * FROM (SELECT * FROM data.product) INNER JOIN some.data.product ON foo = bar"), outputQuery);
    }

    @Test
    public void applyQuerySubstitutions_shouldApplyRecursiveSubstitutions() throws Exception {
        Query outputQuery = queryOperations.applyQuerySubstitutions(queryOperations.parseQuery("SELECT * FROM my.query.do_things"), ImmutableMap.of(
                "my.query.do_things", QuerySubstitution.builder().query("SELECT * FROM another.query").build(),
                "another.query", QuerySubstitution.builder().query("SELECT * FROM yet.another.query").build(),
                "yet.another.query", QuerySubstitution.builder().query("SELECT * FROM data.product").build()
        ));

        Assertions.assertEquals(queryOperations.parseQuery("SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT * FROM data.product)))"), outputQuery);
    }

    @Test
    public void applyQuerySubstitutions_shouldApplyRecursiveSubstitutionsWithRepetition() throws Exception {
        Query outputQuery = queryOperations.applyQuerySubstitutions(queryOperations.parseQuery("SELECT * FROM my.query.one INNER JOIN my.query.two ON foo = bar"), ImmutableMap.of(
                "my.query.one", QuerySubstitution.builder().query("SELECT * FROM my.query.two").build(),
                "my.query.two", QuerySubstitution.builder().query("SELECT * FROM my.query.three").build(),
                "my.query.three", QuerySubstitution.builder().query("SELECT * FROM data.product").build()
        ));

        Assertions.assertEquals(queryOperations.parseQuery("SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT * FROM data.product))) INNER JOIN (SELECT * FROM (SELECT * FROM data.product)) ON foo = bar"), outputQuery);
    }

    @Test
    public void applyQuerySubstitutions_shouldThrowForCircularReferences() throws Exception {
        Assertions.assertThrows(CircularQueryReferenceException.class, () ->
                queryOperations.applyQuerySubstitutions(queryOperations.parseQuery("SELECT * FROM my.infinite.query"), ImmutableMap.of(
                        "my.infinite.query", QuerySubstitution.builder().query("SELECT * FROM my.infinite.query").build()
                )));
    }

    @Test
    public void applyQuerySubstitutions_shouldThrowForMultiLevelCircularReferences() throws Exception {
        Assertions.assertThrows(CircularQueryReferenceException.class, () ->
                queryOperations.applyQuerySubstitutions(queryOperations.parseQuery("SELECT * FROM infinite.one"), ImmutableMap.of(
                        "infinite.one", QuerySubstitution.builder().query("SELECT * FROM infinite.two").build(),
                        "infinite.two", QuerySubstitution.builder().query("SELECT * FROM infinite.three").build(),
                        "infinite.three", QuerySubstitution.builder().query("SELECT * FROM infinite.four").build(),
                        "infinite.four", QuerySubstitution.builder().query("SELECT * FROM infinite.one").build()
                )));
    }

    private void assertReplacesDataProductsWithGovernanceQueries(final String originalQuery, final Map<String, String> governanceQueries, final String expectedRewrittenQuery) throws Exception {
        Query rewritten = queryOperations.replaceDataProductsWithGovernanceQueries(queryOperations.parseQuery(originalQuery),
                governanceQueries.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, entry -> {
                    try {
                        return queryOperations.parseQuery(entry.getValue());
                    } catch (NotAQueryException e) {
                        throw new RuntimeException("Invalid query");
                    }
                })));
        Query expected = queryOperations.parseQuery(expectedRewrittenQuery);
        Assertions.assertEquals(expected, rewritten);
    }
}
