/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.visitors;

import com.facebook.presto.sql.tree.AddColumn;
import com.facebook.presto.sql.tree.AliasedRelation;
import com.facebook.presto.sql.tree.Analyze;
import com.facebook.presto.sql.tree.ArithmeticBinaryExpression;
import com.facebook.presto.sql.tree.ArithmeticUnaryExpression;
import com.facebook.presto.sql.tree.ArrayConstructor;
import com.facebook.presto.sql.tree.AstVisitor;
import com.facebook.presto.sql.tree.AtTimeZone;
import com.facebook.presto.sql.tree.BetweenPredicate;
import com.facebook.presto.sql.tree.BindExpression;
import com.facebook.presto.sql.tree.Cast;
import com.facebook.presto.sql.tree.CoalesceExpression;
import com.facebook.presto.sql.tree.ColumnDefinition;
import com.facebook.presto.sql.tree.ComparisonExpression;
import com.facebook.presto.sql.tree.CreateTable;
import com.facebook.presto.sql.tree.CreateTableAsSelect;
import com.facebook.presto.sql.tree.CreateView;
import com.facebook.presto.sql.tree.Delete;
import com.facebook.presto.sql.tree.DereferenceExpression;
import com.facebook.presto.sql.tree.Except;
import com.facebook.presto.sql.tree.ExistsPredicate;
import com.facebook.presto.sql.tree.Explain;
import com.facebook.presto.sql.tree.ExplainOption;
import com.facebook.presto.sql.tree.Expression;
import com.facebook.presto.sql.tree.Extract;
import com.facebook.presto.sql.tree.FrameBound;
import com.facebook.presto.sql.tree.FunctionCall;
import com.facebook.presto.sql.tree.GroupBy;
import com.facebook.presto.sql.tree.GroupingElement;
import com.facebook.presto.sql.tree.GroupingOperation;
import com.facebook.presto.sql.tree.Identifier;
import com.facebook.presto.sql.tree.IfExpression;
import com.facebook.presto.sql.tree.InListExpression;
import com.facebook.presto.sql.tree.InPredicate;
import com.facebook.presto.sql.tree.Insert;
import com.facebook.presto.sql.tree.Intersect;
import com.facebook.presto.sql.tree.IsNotNullPredicate;
import com.facebook.presto.sql.tree.IsNullPredicate;
import com.facebook.presto.sql.tree.Join;
import com.facebook.presto.sql.tree.JoinOn;
import com.facebook.presto.sql.tree.Lateral;
import com.facebook.presto.sql.tree.LikePredicate;
import com.facebook.presto.sql.tree.LogicalBinaryExpression;
import com.facebook.presto.sql.tree.Node;
import com.facebook.presto.sql.tree.NotExpression;
import com.facebook.presto.sql.tree.NullIfExpression;
import com.facebook.presto.sql.tree.OrderBy;
import com.facebook.presto.sql.tree.Property;
import com.facebook.presto.sql.tree.QuantifiedComparisonExpression;
import com.facebook.presto.sql.tree.Query;
import com.facebook.presto.sql.tree.QueryBody;
import com.facebook.presto.sql.tree.QuerySpecification;
import com.facebook.presto.sql.tree.Relation;
import com.facebook.presto.sql.tree.Row;
import com.facebook.presto.sql.tree.SampledRelation;
import com.facebook.presto.sql.tree.SearchedCaseExpression;
import com.facebook.presto.sql.tree.Select;
import com.facebook.presto.sql.tree.SelectItem;
import com.facebook.presto.sql.tree.SetSession;
import com.facebook.presto.sql.tree.SimpleCaseExpression;
import com.facebook.presto.sql.tree.SimpleGroupBy;
import com.facebook.presto.sql.tree.SingleColumn;
import com.facebook.presto.sql.tree.SortItem;
import com.facebook.presto.sql.tree.StartTransaction;
import com.facebook.presto.sql.tree.Statement;
import com.facebook.presto.sql.tree.SubqueryExpression;
import com.facebook.presto.sql.tree.SubscriptExpression;
import com.facebook.presto.sql.tree.Table;
import com.facebook.presto.sql.tree.TableElement;
import com.facebook.presto.sql.tree.TableSubquery;
import com.facebook.presto.sql.tree.TransactionMode;
import com.facebook.presto.sql.tree.TryExpression;
import com.facebook.presto.sql.tree.Union;
import com.facebook.presto.sql.tree.Unnest;
import com.facebook.presto.sql.tree.Values;
import com.facebook.presto.sql.tree.WhenClause;
import com.facebook.presto.sql.tree.Window;
import com.facebook.presto.sql.tree.WindowFrame;
import com.facebook.presto.sql.tree.With;
import com.facebook.presto.sql.tree.WithQuery;

import java.util.stream.Collectors;

/**
 * An AST visitor for mutating the visited AST, allowing for easy replacement of
 * query parts.
 * This uses the same traversal logic as the DefaultTraversalVisitor, where
 * instead of returning null we return a new
 * equivalent AST node composed of the processed result.
 * 
 * @param <C> context type
 */
public class MutateAstVisitor<C> extends AstVisitor<Node, C> {
    @Override
    public Node visitNode(final Node node, final C context) {
        return node;
    }

    @Override
    protected Node visitExtract(final Extract node, final C context) {
        return new Extract((Expression) process(node.getExpression(), context), node.getField());
    }

    @Override
    protected Node visitCast(final Cast node, final C context) {
        return new Cast((Expression) process(node.getExpression(), context), node.getType(), node.isSafe(),
                node.isTypeOnly());
    }

    @Override
    protected Node visitArithmeticBinary(final ArithmeticBinaryExpression node, final C context) {
        return new ArithmeticBinaryExpression(
                node.getOperator(),
                (Expression) process(node.getLeft(), context),
                (Expression) process(node.getRight(), context));
    }

    @Override
    protected Node visitBetweenPredicate(final BetweenPredicate node, final C context) {
        return new BetweenPredicate(
                (Expression) process(node.getValue(), context),
                (Expression) process(node.getMin(), context),
                (Expression) process(node.getMax(), context));
    }

    @Override
    protected Node visitCoalesceExpression(final CoalesceExpression node, final C context) {
        return new CoalesceExpression(node.getOperands().stream()
                .map(operand -> (Expression) process(operand, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitAtTimeZone(final AtTimeZone node, final C context) {
        return new AtTimeZone(
                (Expression) process(node.getValue(), context),
                (Expression) process(node.getTimeZone(), context));
    }

    @Override
    protected Node visitArrayConstructor(final ArrayConstructor node, final C context) {
        return new ArrayConstructor(node.getValues().stream()
                .map(value -> (Expression) process(value, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitSubscriptExpression(final SubscriptExpression node, final C context) {
        return new SubscriptExpression(
                (Expression) process(node.getBase(), context),
                (Expression) process(node.getIndex(), context));
    }

    @Override
    protected Node visitComparisonExpression(final ComparisonExpression node, final C context) {
        return new ComparisonExpression(
                node.getOperator(),
                (Expression) process(node.getLeft(), context),
                (Expression) process(node.getRight(), context));
    }

    @Override
    protected Node visitQuery(final Query node, final C context) {
        return new Query(node.getWith().map(with -> (With) process(with, context)),
                (QueryBody) process(node.getQueryBody(), context),
                node.getOrderBy().map(orderBy -> (OrderBy) process(orderBy, context)),
                node.getLimit());
    }

    @Override
    protected Node visitWith(final With node, final C context) {
        return new With(node.isRecursive(), node.getQueries().stream()
                .map(withQuery -> (WithQuery) process(withQuery, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitWithQuery(final WithQuery node, final C context) {
        return new WithQuery(node.getName(), (Query) process(node.getQuery(), context), node.getColumnNames());
    }

    @Override
    protected Node visitSelect(final Select node, final C context) {
        return new Select(node.isDistinct(), node.getSelectItems().stream()
                .map(selectItem -> (SelectItem) process(selectItem, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitSingleColumn(final SingleColumn node, final C context) {
        return new SingleColumn((Expression) process(node.getExpression(), context), node.getAlias());
    }

    @Override
    protected Node visitWhenClause(final WhenClause node, final C context) {
        return new WhenClause((Expression) process(node.getOperand(), context),
                (Expression) process(node.getResult(), context));
    }

    @Override
    protected Node visitInPredicate(final InPredicate node, final C context) {
        return new InPredicate((Expression) process(node.getValue(), context),
                (Expression) process(node.getValueList(), context));
    }

    @Override
    protected Node visitFunctionCall(final FunctionCall node, final C context) {
        return new FunctionCall(
                node.getName(),
                node.getWindow().map(window -> (Window) process(window, context)),
                node.getFilter().map(filter -> (Expression) process(filter, context)),
                node.getOrderBy().map(orderBy -> (OrderBy) process(orderBy, context)),
                node.isDistinct(),
                node.getArguments().stream()
                        .map(argument -> (Expression) process(argument, context))
                        .collect(Collectors.toList()));
    }

    @Override
    protected Node visitGroupingOperation(final GroupingOperation node, final C context) {
        return new GroupingOperation(node.getLocation(), node.getGroupingColumns().stream()
                .map(groupingColumn -> (DereferenceExpression) process(groupingColumn, context))
                .map(DereferenceExpression::getQualifiedName)
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitDereferenceExpression(final DereferenceExpression node, final C context) {
        return new DereferenceExpression((Expression) process(node.getBase(), context), node.getField());
    }

    @Override
    public Node visitWindow(final Window node, final C context) {
        return new Window(
                node.getPartitionBy().stream()
                        .map(partitionBy -> (Expression) process(partitionBy, context))
                        .collect(Collectors.toList()),
                node.getOrderBy().map(orderBy -> (OrderBy) process(orderBy, context)),
                node.getFrame().map(frame -> (WindowFrame) process(frame, context)));
    }

    @Override
    public Node visitWindowFrame(final WindowFrame node, final C context) {
        return new WindowFrame(node.getType(),
                (FrameBound) process(node.getStart(), context),
                node.getEnd().map(end -> (FrameBound) process(end, context)));
    }

    @Override
    public Node visitFrameBound(final FrameBound node, final C context) {
        if (node.getValue().isPresent()) {
            return new FrameBound(node.getType(), (Expression) process(node.getValue().get(), context));
        }
        return new FrameBound(node.getType());
    }

    @Override
    protected Node visitSimpleCaseExpression(final SimpleCaseExpression node, final C context) {
        return new SimpleCaseExpression((Expression) process(node.getOperand(), context), node.getWhenClauses().stream()
                .map(whenClause -> (WhenClause) process(whenClause, context))
                .collect(Collectors.toList()),
                node.getDefaultValue().map(defaultValue -> (Expression) process(defaultValue, context)));
    }

    @Override
    protected Node visitInListExpression(final InListExpression node, final C context) {
        return new InListExpression(node.getValues().stream()
                .map(value -> (Expression) process(value, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitNullIfExpression(final NullIfExpression node, final C context) {
        return new NullIfExpression(
                (Expression) process(node.getFirst(), context),
                (Expression) process(node.getSecond(), context));
    }

    @Override
    protected Node visitIfExpression(final IfExpression node, final C context) {
        return new IfExpression((Expression) process(node.getCondition(), context),
                (Expression) process(node.getTrueValue(), context),
                node.getFalseValue().map(falseValue -> (Expression) process(falseValue, context)).orElse(null));
    }

    @Override
    protected Node visitTryExpression(final TryExpression node, final C context) {
        return new TryExpression((Expression) process(node.getInnerExpression(), context));
    }

    @Override
    protected Node visitBindExpression(final BindExpression node, final C context) {
        return new BindExpression(node.getValues().stream()
                .map(value -> (Expression) process(value, context))
                .collect(Collectors.toList()), (Expression) process(node.getFunction(), context));
    }

    @Override
    protected Node visitArithmeticUnary(final ArithmeticUnaryExpression node, final C context) {
        return new ArithmeticUnaryExpression(node.getSign(), (Expression) process(node.getValue(), context));
    }

    @Override
    protected Node visitNotExpression(final NotExpression node, final C context) {
        return new NotExpression((Expression) process(node.getValue(), context));
    }

    @Override
    protected Node visitSearchedCaseExpression(final SearchedCaseExpression node, final C context) {
        return new SearchedCaseExpression(node.getWhenClauses().stream()
                .map(whenClause -> (WhenClause) process(whenClause, context))
                .collect(Collectors.toList()),
                node.getDefaultValue().map(defaultValue -> (Expression) process(defaultValue, context)));
    }

    @Override
    protected Node visitLikePredicate(final LikePredicate node, final C context) {
        return new LikePredicate((Expression) process(node.getValue(), context),
                (Expression) process(node.getPattern(), context),
                node.getEscape().map(escape -> (Expression) process(escape, context)));
    }

    @Override
    protected Node visitIsNotNullPredicate(final IsNotNullPredicate node, final C context) {
        return new IsNotNullPredicate((Expression) process(node.getValue(), context));
    }

    @Override
    protected Node visitIsNullPredicate(final IsNullPredicate node, final C context) {
        return process(node.getValue(), context);
    }

    @Override
    protected Node visitLogicalBinaryExpression(final LogicalBinaryExpression node, final C context) {
        return new LogicalBinaryExpression(node.getOperator(),
                (Expression) process(node.getLeft(), context),
                (Expression) process(node.getRight(), context));
    }

    @Override
    protected Node visitSubqueryExpression(final SubqueryExpression node, final C context) {
        return new SubqueryExpression((Query) process(node.getQuery(), context));
    }

    @Override
    protected Node visitOrderBy(final OrderBy node, final C context) {
        return new OrderBy(node.getSortItems().stream()
                .map(sortItem -> (SortItem) process(sortItem, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitSortItem(final SortItem node, final C context) {
        return new SortItem((Expression) process(node.getSortKey(), context), node.getOrdering(),
                node.getNullOrdering());
    }

    @Override
    protected Node visitQuerySpecification(final QuerySpecification node, final C context) {
        return new QuerySpecification(
                (Select) process(node.getSelect(), context),
                node.getFrom().map(from -> (Relation) process(from, context)),
                node.getWhere().map(where -> (Expression) process(where, context)),
                node.getGroupBy().map(groupBy -> (GroupBy) process(groupBy, context)),
                node.getHaving().map(having -> (Expression) process(having, context)),
                node.getOrderBy().map(orderBy -> (OrderBy) process(orderBy, context)),
                node.getLimit());
    }

    @Override
    protected Node visitIntersect(final Intersect node, final C context) {
        return new Intersect(node.getRelations().stream()
                .map(relation -> (Relation) process(relation, context))
                .collect(Collectors.toList()), node.isDistinct());
    }

    @Override
    protected Node visitUnion(final Union node, final C context) {
        return new Union(node.getRelations().stream()
                .map(relation -> (Relation) process(relation, context))
                .collect(Collectors.toList()), node.isDistinct());
    }

    @Override
    protected Node visitExcept(final Except node, final C context) {
        return new Except(
                (Relation) process(node.getLeft(), context),
                (Relation) process(node.getRight(), context),
                node.isDistinct());
    }

    @Override
    protected Node visitValues(final Values node, final C context) {
        return new Values(node.getRows().stream()
                .map(row -> (Expression) process(row, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitRow(final Row node, final C context) {
        return new Row(node.getItems().stream()
                .map(value -> (Expression) process(value, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitTableSubquery(final TableSubquery node, final C context) {
        return new TableSubquery((Query) process(node.getQuery(), context));
    }

    @Override
    protected Node visitAliasedRelation(final AliasedRelation node, final C context) {
        return new AliasedRelation((Relation) process(node.getRelation(), context), node.getAlias(),
                node.getColumnNames());
    }

    @Override
    protected Node visitSampledRelation(final SampledRelation node, final C context) {
        return new SampledRelation((Relation) process(node.getRelation(), context), node.getType(),
                node.getSamplePercentage());
    }

    @Override
    protected Node visitJoin(final Join node, final C context) {
        return new Join(node.getType(),
                (Relation) process(node.getLeft(), context),
                (Relation) process(node.getRight(), context),
                node.getCriteria().map(criteria -> criteria instanceof JoinOn
                        ? new JoinOn((Expression) process(((JoinOn) criteria).getExpression(), context))
                        : criteria));
    }

    @Override
    protected Node visitUnnest(final Unnest node, final C context) {
        return new Unnest(node.getExpressions().stream()
                .map(expression -> (Expression) process(expression, context))
                .collect(Collectors.toList()), node.isWithOrdinality());
    }

    @Override
    protected Node visitGroupBy(final GroupBy node, final C context) {
        return new GroupBy(node.isDistinct(), node.getGroupingElements().stream()
                .map(groupingElement -> (GroupingElement) process(groupingElement, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitSimpleGroupBy(final SimpleGroupBy node, final C context) {
        return new SimpleGroupBy(node.getExpressions().stream()
                .map(expression -> (Expression) process(expression, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitInsert(final Insert node, final C context) {
        return new Insert(node.getTarget(), node.getColumns(), (Query) process(node.getQuery(), context));
    }

    @Override
    protected Node visitDelete(final Delete node, final C context) {
        return new Delete((Table) process(node.getTable(), context),
                node.getWhere().map(where -> (Expression) process(where, context)));
    }

    @Override
    protected Node visitCreateTableAsSelect(final CreateTableAsSelect node, final C context) {
        return new CreateTableAsSelect(node.getName(), (Query) process(node.getQuery(), context), node.isNotExists(),
                node.getProperties().stream()
                        .map(property -> (Property) process(property, context))
                        .collect(Collectors.toList()),
                node.isWithData(), node.getColumnAliases(), node.getComment());
    }

    @Override
    protected Node visitProperty(final Property node, final C context) {
        return new Property((Identifier) process(node.getName(), context),
                (Expression) process(node.getValue(), context));
    }

    @Override
    protected Node visitAnalyze(final Analyze node, final C context) {
        return new Analyze(node.getTableName(), node.getProperties().stream()
                .map(property -> (Property) process(property, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitCreateView(final CreateView node, final C context) {
        return new CreateView(node.getName(), (Query) process(node.getQuery(), context), node.isReplace());
    }

    @Override
    protected Node visitSetSession(final SetSession node, final C context) {
        return new SetSession(node.getName(), (Expression) process(node.getValue(), context));
    }

    @Override
    protected Node visitAddColumn(final AddColumn node, final C context) {
        return new AddColumn(node.getName(), (ColumnDefinition) process(node.getColumn(), context));
    }

    @Override
    protected Node visitCreateTable(final CreateTable node, final C context) {
        return new CreateTable(node.getName(), node.getElements().stream()
                .map(tableElement -> (TableElement) process(tableElement, context))
                .collect(Collectors.toList()), node.isNotExists(),
                node.getProperties().stream()
                        .map(property -> (Property) process(property, context))
                        .collect(Collectors.toList()),
                node.getComment());
    }

    @Override
    protected Node visitStartTransaction(final StartTransaction node, final C context) {
        return new StartTransaction(node.getTransactionModes().stream()
                .map(mode -> (TransactionMode) process(mode, context))
                .collect(Collectors.toList()));
    }

    @Override
    protected Node visitExplain(final Explain node, final C context) {
        return new Explain((Statement) process(node.getStatement(), context), node.isAnalyze(), node.isVerbose(),
                node.getOptions().stream()
                        .map(option -> (ExplainOption) process(option, context))
                        .collect(Collectors.toList()));
    }

    @Override
    protected Node visitQuantifiedComparisonExpression(final QuantifiedComparisonExpression node, final C context) {
        return new QuantifiedComparisonExpression(node.getOperator(), node.getQuantifier(),
                (Expression) process(node.getValue(), context), (Expression) process(node.getSubquery(), context));
    }

    @Override
    protected Node visitExists(final ExistsPredicate node, final C context) {
        return new ExistsPredicate((Expression) process(node.getSubquery(), context));
    }

    @Override
    protected Node visitLateral(final Lateral node, final C context) {
        return new Lateral((Query) process(node.getQuery(), context));
    }
}
