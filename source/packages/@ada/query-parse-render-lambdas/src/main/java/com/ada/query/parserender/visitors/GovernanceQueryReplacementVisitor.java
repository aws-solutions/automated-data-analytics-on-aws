/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.visitors;

import com.facebook.presto.sql.tree.Node;
import com.facebook.presto.sql.tree.Query;
import com.facebook.presto.sql.tree.Table;

import java.util.Map;

/**
 * A visitor for replacing data products with their corresponding governance queries
 */
public class GovernanceQueryReplacementVisitor extends QueryReplacementVisitor {
    public GovernanceQueryReplacementVisitor(final Map<String, Query> governanceQueries) {
        super(governanceQueries);
    }

    @Override
    public Node visitTable(final Table table, final Object context) {
        Node replaced = super.visitTable(table, context);
        if (!this.getTablesWithMissingReplacements().isEmpty()) {
            throw this.buildParsingException(String.format("No governance query found for %s", table.getName().toString()), table);
        }
        return replaced;
    }
}
