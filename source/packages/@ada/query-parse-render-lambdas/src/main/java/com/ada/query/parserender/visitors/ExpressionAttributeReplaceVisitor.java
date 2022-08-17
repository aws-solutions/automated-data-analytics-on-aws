/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.visitors;

import com.facebook.presto.sql.tree.Expression;
import com.facebook.presto.sql.tree.Identifier;
import com.facebook.presto.sql.tree.Node;
import lombok.RequiredArgsConstructor;


/**
 * A visitor for replacing the where attributes to use the column name
 */
@RequiredArgsConstructor
public class ExpressionAttributeReplaceVisitor extends MutateAstVisitor<Object> {
    private final String attribute;
    private final String columnName;

    public Expression visit(Expression node) {
        return (Expression) super.process(node);
    }

    @Override
    protected Node visitIdentifier(Identifier node, Object context) {
        if (node.getValue().equalsIgnoreCase(attribute)) {
            return new Identifier(columnName);
        }
        throw new IllegalArgumentException(String.format(
                "Only the attribute %s can be referenced in the attribute value policy. Found %s", attribute, node.getValue()));
    }
}
