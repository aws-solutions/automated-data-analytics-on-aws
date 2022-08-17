/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.visitors;

import com.ada.query.parserender.model.discover.DiscoveredTable;
import com.facebook.presto.sql.tree.DefaultTraversalVisitor;
import com.facebook.presto.sql.tree.Table;
import lombok.Getter;

import java.util.HashSet;
import java.util.Set;

/**
 * A query AST visitor for collecting the tables discovered in the query
 */
public class TableSearchVisitor extends DefaultTraversalVisitor<Table, Object> {
    @Getter
    private Set<DiscoveredTable> tables = new HashSet<>();

    @Override
    protected Table visitTable(final Table table, final Object context) {
        tables.add(DiscoveredTable.builder().identifierParts(table.getName().getParts()).build());
        return table;
    }
}
