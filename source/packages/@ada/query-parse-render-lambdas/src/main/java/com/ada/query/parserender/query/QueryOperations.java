/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.query;

import com.ada.query.parserender.exceptions.CircularQueryReferenceException;
import com.ada.query.parserender.exceptions.InvalidDataProductsInQueryException;
import com.ada.query.parserender.exceptions.NotAQueryException;
import com.ada.query.parserender.model.discover.DiscoveredTable;
import com.ada.query.parserender.model.rewrite.DataColumn;
import com.ada.query.parserender.model.rewrite.DataUdf;
import com.ada.query.parserender.model.rewrite.QuerySubstitution;
import com.ada.query.parserender.visitors.ExpressionAttributeReplaceVisitor;
import com.ada.query.parserender.visitors.GovernanceQueryReplacementVisitor;
import com.ada.query.parserender.visitors.QueryReplacementVisitor;
import com.ada.query.parserender.visitors.TableSearchVisitor;
import com.facebook.presto.sql.QueryUtil;
import com.facebook.presto.sql.parser.ParsingOptions;
import com.facebook.presto.sql.parser.SqlParser;
import com.facebook.presto.sql.tree.Cast;
import com.facebook.presto.sql.tree.Expression;
import com.facebook.presto.sql.tree.FunctionCall;
import com.facebook.presto.sql.tree.Identifier;
import com.facebook.presto.sql.tree.LogicalBinaryExpression;
import com.facebook.presto.sql.tree.QualifiedName;
import com.facebook.presto.sql.tree.Query;
import com.facebook.presto.sql.tree.Select;
import com.facebook.presto.sql.tree.SelectItem;
import com.facebook.presto.sql.tree.SingleColumn;
import com.facebook.presto.sql.tree.Statement;
import com.facebook.presto.sql.tree.Table;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.Lists;
import com.google.common.collect.Sets;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;


@NoArgsConstructor
public class QueryOperations {
    // setting PARSING_OPTIONS to be consistent with Athena
    private static final ParsingOptions PARSING_OPTIONS = new ParsingOptions(ParsingOptions.DecimalLiteralTreatment.AS_DOUBLE);

    private final SqlParser parser = new SqlParser();

    /**
     * Parses the given query
     *
     * @param query the query to parse
     * @return a query AST
     * @throws NotAQueryException if the given sql is valid but not an SQL query (eg CREATE TABLE)
     */
    public Query parseQuery(final String query) throws NotAQueryException {
        Statement statement = parser.createStatement(query, PARSING_OPTIONS);
        if (statement instanceof Query) {
            return (Query) statement;
        }
        throw new NotAQueryException(String.format("The query provided is not a valid query: %s", query));
    }

    /**
     * Finds data products referenced by the given query
     *
     * @param query the sql query
     * @return a list of data products
     * @throws InvalidDataProductsInQueryException when there are invalid data products referenced
     */
    public Set<DiscoveredTable> findTables(final Query query) throws InvalidDataProductsInQueryException {
        TableSearchVisitor visitor = new TableSearchVisitor();
        query.accept(visitor, null);
        return visitor.getTables();
    }

    /**
     * Substitutes any referenced queries with their substitution. Recursive query references are permitted.
     * @param query the query to apply substitutions to
     * @param substitutions map of query reference to the query to substitute
     * @return the new query
     * @throws NotAQueryException when any of the substitution queries are not valid queries
     * @throws CircularQueryReferenceException when a circular reference is detected which would otherwise cause an
     *                                         infinite loop of replacements
     */
    public Query applyQuerySubstitutions(final Query query, final Map<String, QuerySubstitution> substitutions) throws NotAQueryException, CircularQueryReferenceException {
        if (substitutions == null) {
            return query;
        }

        // Parse the queries to substitute
        Map<String, Query> parsedSubstitutions = new HashMap<>();
        for (Map.Entry<String, QuerySubstitution> entry : substitutions.entrySet()) {
            parsedSubstitutions.put(entry.getKey(), parseQuery(entry.getValue().getQuery()));
        }

        // Check if there are any circular references
        Set<String> circularReferences = findCircularReferences(query, new HashSet<>(), parsedSubstitutions).collect(Collectors.toSet());
        if (!circularReferences.isEmpty()) {
            throw new CircularQueryReferenceException(String.format("Found circular query references in query: %s", String.join(", ", circularReferences)));
        }

        // Keep applying replacements until there are no more replacements to make, this means queries can reference queries
        // that include references to other queries for as many levels as required. Note that this will loop infinitely if
        // there are circular references so the above check must come first!
        Query replacedQuery = query;
        QueryReplacementVisitor visitor;
        do {
            visitor = new QueryReplacementVisitor(parsedSubstitutions);
            replacedQuery = (Query) replacedQuery.accept(visitor, null);
        } while (!visitor.getTablesWithReplacementsApplied().isEmpty());

        return replacedQuery;
    }

    private Stream<String> findCircularReferences(final Query query, final Set<String> referencedTables, final Map<String, Query> substitutions) {
        TableSearchVisitor visitor = new TableSearchVisitor();
        query.accept(visitor, null);
        Set<String> circularReferences = Sets.intersection(visitor.getTables().stream().map(DiscoveredTable::qualifiedName).collect(Collectors.toSet()), referencedTables);
        if (!circularReferences.isEmpty()) {
            return circularReferences.stream();
        }
        return visitor.getTables().stream().flatMap(table -> substitutions.containsKey(table.qualifiedName()) ? findCircularReferences(substitutions.get(table.qualifiedName()), Sets.union(Sets.newHashSet(table.qualifiedName()), referencedTables), substitutions) : Stream.empty());
    }

    /**
     * Replaces any data products in a query with governance queries
     *
     * @param query             the query to perform replacements in
     * @param governanceQueries a map of data product name to its governance query. Every data product referenced in the
     *                          query must map to a governance query
     * @return a rewritten query with governance applied
     */
    public Query replaceDataProductsWithGovernanceQueries(final Query query, final Map<String, Query> governanceQueries) {
        return (Query) query.accept(new GovernanceQueryReplacementVisitor(governanceQueries), null);
    }

    /**
     * Generate a governance query from the data product rewrite input
     *
     * @param dataProductMap the map that contains a data product name and its definition
     * @return a map with data product name and its Query
     */
    public Map<String, Query> generateGovernanceQueries(final Map<String, com.ada.query.parserender.model.rewrite.DataProduct> dataProductMap) {
        Map<String, Query> output = new HashMap<>();

        for (Map.Entry<String, com.ada.query.parserender.model.rewrite.DataProduct> entry : dataProductMap.entrySet()) {
            // the key is the table name, value is the data product
            output.put(entry.getKey(), this.generateGovernanceQuery(entry.getKey(), entry.getValue()));
        }

        return output;
    }

    /**
     * Generate a governance query for the given data product
     *
     * @param dataProduct data product defined as input
     * @return a transformed query based on the governance input
     */
    private Query generateGovernanceQuery(final String dataProductName, final com.ada.query.parserender.model.rewrite.DataProduct dataProduct) {
        List<SelectItem> selectList = new ArrayList<>(dataProduct.getColumns().size());
        List<Optional<Expression>> whereClauseList = new ArrayList<>();
        String tableName = dataProduct.getTableName();

        if (tableName == null || tableName.isEmpty()) {
            throw new IllegalArgumentException(String.format("tableName field in data product %s is required", dataProductName));
        }

        for (DataColumn column : dataProduct.getColumns()) {
            String columnName = column.getName();

            if (columnName == null || columnName.isEmpty()) {
                throw new IllegalArgumentException(String.format("name field in the column element for data product %s is required", dataProductName));
            }

            selectList.add(this.generateSelectClause(columnName, column.getUdfs()));
            whereClauseList.add(this.generateWhereClause(columnName, column.getAttribute(), column.getClauses()));
        }

        // take each part that compose the table name and split
        // remove the quotes as well, given that, if required, it will be added
        // by the SqlFormatter after the query has been composed.
        // names like catalog."db"."table.name" will be converted into -> [catalog, db, table.name]
        String[] tableParts = Arrays.stream(dataProduct.getTableName().split("\\.(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)"))
                .map(str -> str.replace("\"", ""))
                .toArray(String[]::new);

        return QueryUtil.simpleQuery(
                new Select(false, selectList),
                // add te first element (required) as first qualifier, append all the others (optionally) as additional qualifiers.
                new Table(QualifiedName.of(tableParts[0], Arrays.stream(tableParts).skip(1).toArray(String[]::new))),
                whereClauseList.stream().reduce(Optional.empty(), (accumulator, element) -> {
                    if (element.isPresent() && accumulator.isPresent()) {
                        // if we've a previously added condition will just append
                        return Optional.of(new LogicalBinaryExpression(
                                // cross column condition would be by default as AND
                                LogicalBinaryExpression.Operator.AND,
                                accumulator.get(),
                                element.get()
                        ));
                    }

                    // return the accumulator if it has been defined before, otherwise return the element
                    return accumulator.isPresent() ? accumulator : element;
                }),
                Optional.empty()
        );
    }

    /**
     * Generate the where condition by appending the clauses given as input to the current where condition
     *
     * @param columnName the name of the current column
     * @param attribute  the name of the attribute
     * @param clauses    the list of clauses to add to the where condition
     * @return a new expression (or Optional.Empty) with the new clauses appended to the current one
     */
    public Optional<Expression> generateWhereClause(String columnName, String attribute, List<String> clauses) {
        // if no clauses are available just return an empty Expression
        if (clauses == null || clauses.isEmpty()) {
            return Optional.empty();
        }

        // attribute is a required field when the clause are specified
        if (attribute == null || attribute.isEmpty()) {
            throw new IllegalArgumentException(String.format("attribute field in column %s is required when clauses are specified.", columnName));
        }

        // cross clause condition within a column would be OR by default
        Optional<Expression> whereCondition = clauses.stream().map(clause -> this.parser.createExpression(clause, PARSING_OPTIONS))
                .reduce((accumulator, element) ->
                        new LogicalBinaryExpression(
                                LogicalBinaryExpression.Operator.OR,
                                accumulator,
                                element
                        )
                );

        // replace the attribute and use column name instead (by using the ExpressionAttributeReplaceVisitor)
        return whereCondition.map(expression -> new ExpressionAttributeReplaceVisitor(attribute, columnName).visit(expression));
    }

    private SelectItem generateSelectClause(final String columnName, final List<DataUdf> udfs) {
        if (udfs != null && !udfs.isEmpty()) {
            return new SingleColumn(
                    this.generateChainableUDFs(columnName, udfs),
                    // use the column name as alias
                    new Identifier(columnName, true)
            );
        }

        return new SingleColumn(new Identifier(columnName, true));
    }

    /**
     * Generate an expression which uses the UDFs provided as input
     *
     * @param udfs list of UDFs, will be applied in the order being received
     * @return an expression that match the UDF list, the alias would be the column name
     */
    private Expression generateChainableUDFs(final String columnName, final List<DataUdf> udfs) {
        Expression previousFunction = null;

        // reverse the list to apply the parameter first to the last function
        // walk back to then chain other functions that could be inside the udf list
        // input sample: [{name: "substr" }, { name: "hash" }]
        // output => substr(hash(columnName))
        for (DataUdf udf : Lists.reverse(udfs)) {
            previousFunction = generateUDF(udf, previousFunction == null
                    ? new Identifier(columnName, true)
                    : previousFunction);
        }

        return previousFunction;
    }

    private Expression generateUDF(final DataUdf udf, final Expression operand) {
        // Cast the column to the input type for the udf (we expect any "castable" checks to occur prior to calling the
        // rewrite api).
        return new FunctionCall(QualifiedName.of(udf.getName()), ImmutableList.of(new Cast(operand, udf.getInputType())));
    }
}
