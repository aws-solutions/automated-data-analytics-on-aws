/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.visitors;

import com.facebook.presto.sql.parser.ParsingException;
import com.facebook.presto.sql.tree.Node;
import com.facebook.presto.sql.tree.Query;
import com.facebook.presto.sql.tree.Table;
import com.facebook.presto.sql.tree.TableSubquery;
import lombok.Getter;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * A visitor for replacing "tables" in a query with subqueries
 */
public class QueryReplacementVisitor extends MutateAstVisitor<Object> {
    private final Map<String, Query> replacementQueries;

    @Getter
    private final Set<String> tablesWithReplacementsApplied = new HashSet<>();

    @Getter
    private final Set<String> tablesWithMissingReplacements = new HashSet<>();

    public QueryReplacementVisitor(final Map<String, Query> replacementQueries) {
        // enable case insensitive lookups
        this.replacementQueries = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        this.replacementQueries.putAll(replacementQueries);
    }

    @Override
    public Node visitTable(final Table table, final Object context) {
        // Retrieve the replacement query for this table
        String tableName = table.getName().toString();
        Query replacement = replacementQueries.get(tableName);
        // When there's no replacement, add to the missing replacements set and return the table unmodified
        if (replacement == null) {
            tablesWithMissingReplacements.add(tableName);
            return table;
        }
        tablesWithReplacementsApplied.add(tableName);
        // Instead of the table node, we return a subquery which will replace this node in the AST
        return new TableSubquery(replacement);
    }

    protected ParsingException buildParsingException(final String message, final Table table) {
        if (table.getLocation().isPresent()) {
            return new ParsingException(message, table.getLocation().get());
        } else {
            return new ParsingException(message);
        }
    }
}
