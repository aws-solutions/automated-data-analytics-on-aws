/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

package com.ada.query.parserender.visitors;

import com.ada.query.parserender.query.QueryOperations;
import com.facebook.presto.sql.parser.ParsingOptions;
import com.facebook.presto.sql.parser.SqlParser;
import com.facebook.presto.sql.tree.Node;
import com.facebook.presto.sql.tree.QualifiedName;
import com.facebook.presto.sql.tree.Query;
import com.facebook.presto.sql.tree.Statement;
import com.facebook.presto.sql.tree.Table;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

public class MutateAstVisitorTest {
    private QueryOperations queryOperations = new QueryOperations();

    @Test
    public void shouldReturnEquivalentQuery() throws Exception {
        assertEquivalentQueryReturned(
                "SELECT * FROM sales.customers JOIN marketing.customers ON sales.customers.id = marketing.customers.id");
        assertEquivalentQueryReturned("SELECT * FROM " +
                "(SELECT id, hash(name) as name FROM sales.customers WHERE type != 'VIP') " +
                "JOIN " +
                "(SELECT id, hash(name) as name FROM marketing.customers WHERE type != 'VIP') " +
                "ON sales.customers.id = marketing.customers.id");
        assertEquivalentQueryReturned("SELECT AVG(number_of_students) " +
                "FROM (SELECT teacher_id, number_of_students FROM classes) " +
                "WHERE teacher_id IN ( " +
                "    SELECT id " +
                "    FROM (SELECT id, subject, hash(salary) FROM teachers) " +
                "    WHERE subject = 'English' OR subject = 'History')");
    }

    @Test
    public void shouldNotReturnSameQueryReference() throws Exception {
        Query original = queryOperations.parseQuery("SELECT * FROM customers");
        Query visited = (Query) original.accept(new MutateAstVisitor<>(), null);
        Assertions.assertNotSame(original, visited);
    }

    @Test
    public void shouldAllowReplacements() throws Exception {
        Query original = queryOperations.parseQuery("SELECT * FROM my_table");
        Query visited = (Query) original.accept(new MutateAstVisitor<Object>() {
            @Override
            public Node visitTable(final Table node, final Object context) {
                return new Table(QualifiedName.of("replaced"));
            }
        }, null);
        Assertions.assertEquals(queryOperations.parseQuery("SELECT * FROM replaced"), visited);
    }

    @Test
    public void shouldReturnSimilarIsNullStatement() throws Exception {
        Statement original = new SqlParser().createStatement("SELECT 3.0 IS NULL",
                new ParsingOptions(ParsingOptions.DecimalLiteralTreatment.AS_DOUBLE));
        Statement visited = (Statement) original.accept(new MutateAstVisitor<>(), null);
        System.out.println(original);
        System.out.println(visited);
        Assertions.assertEquals(
                "Query{queryBody=QuerySpecification{select=Select{distinct=false, selectItems=[3E0]}, from=Optional.empty, where=null, groupBy=Optional.empty, having=null, orderBy=Optional.empty, limit=null}, orderBy=Optional.empty}",
                visited.toString());

    }

    @Test
    public void shouldReturnEquivalentOtherSqlStatements() throws Exception {
        // Statements for test coverage taken from:
        // https://github.com/prestodb/presto/blob/0.217/presto-parser/src/test/java/com/facebook/presto/sql/parser/TestStatementBuilder.java
        // https://github.com/prestodb/presto/blob/0.217/presto-parser/src/test/java/com/facebook/presto/sql/parser/TestSqlParser.java

        assertEquivalentStatementReturned("select * from foo");
        assertEquivalentStatementReturned("explain select * from foo");
        assertEquivalentStatementReturned("explain (type distributed, format graphviz) select * from foo");
        assertEquivalentStatementReturned("select * from foo /* end */");
        assertEquivalentStatementReturned("/* start */ select * from foo");
        assertEquivalentStatementReturned("/* start */ select * /* middle */ from foo /* end */");
        assertEquivalentStatementReturned("-- start\nselect * -- junk\n-- hi\nfrom foo -- done");
        assertEquivalentStatementReturned("select * from foo a (x, y, z)");
        assertEquivalentStatementReturned("select *, 123, * from foo");
        assertEquivalentStatementReturned("select show from foo");
        assertEquivalentStatementReturned("select extract(day from x), extract(dow from x) from y");
        assertEquivalentStatementReturned("select 1 + 13 || '15' from foo");
        assertEquivalentStatementReturned("select x is distinct from y from foo where a is not distinct from b");
        assertEquivalentStatementReturned("select x[1] from my_table");
        assertEquivalentStatementReturned("select x[1][2] from my_table");
        assertEquivalentStatementReturned("select x[cast(10 * sin(x) as bigint)] from my_table");
        assertEquivalentStatementReturned("select * from unnest(t.my_array)");
        assertEquivalentStatementReturned("select * from unnest(array[1, 2, 3])");
        assertEquivalentStatementReturned("select x from unnest(array[1, 2, 3]) t(x)");
        assertEquivalentStatementReturned("select * from users cross join unnest(friends)");
        assertEquivalentStatementReturned("select id, friend from users cross join unnest(friends) t(friend)");
        assertEquivalentStatementReturned("select * from unnest(t.my_array) with ordinality");
        assertEquivalentStatementReturned("select * from unnest(array[1, 2, 3]) with ordinality");
        assertEquivalentStatementReturned("select x from unnest(array[1, 2, 3]) with ordinality t(x)");
        assertEquivalentStatementReturned("select * from users cross join unnest(friends) with ordinality");
        assertEquivalentStatementReturned(
                "select id, friend from users cross join unnest(friends) with ordinality t(friend)");
        assertEquivalentStatementReturned("select count(*) x from src group by k, v");
        assertEquivalentStatementReturned("select count(*) x from src group by cube (k, v)");
        assertEquivalentStatementReturned("select count(*) x from src group by rollup (k, v)");
        assertEquivalentStatementReturned("select count(*) x from src group by grouping sets ((k, v))");
        assertEquivalentStatementReturned("select count(*) x from src group by grouping sets ((k, v), (v))");
        assertEquivalentStatementReturned("select count(*) x from src group by grouping sets (k, v, k)");
        assertEquivalentStatementReturned("select count(*) filter (where x > 4) y from t");
        assertEquivalentStatementReturned("select sum(x) filter (where x > 4) y from t");
        assertEquivalentStatementReturned("select sum(x) filter (where x > 4) y, sum(x) filter (where x < 2) z from t");
        assertEquivalentStatementReturned(
                "select sum(distinct x) filter (where x > 4) y, sum(x) filter (where x < 2) z from t");
        assertEquivalentStatementReturned("select sum(x) filter (where x > 4) over (partition by y) z from t");
        assertEquivalentStatementReturned("" +
                "with a (id) as (with x as (select 123 from z) select * from x) " +
                "   , b (id) as (select 999 from z) " +
                "select * from a join b using (id)");
        assertEquivalentStatementReturned("with recursive t as (select * from x) select * from t");
        assertEquivalentStatementReturned("select * from information_schema.tables");
        assertEquivalentStatementReturned("show catalogs");
        assertEquivalentStatementReturned("show schemas");
        assertEquivalentStatementReturned("show schemas from sys");
        assertEquivalentStatementReturned("show tables");
        assertEquivalentStatementReturned("show tables from information_schema");
        assertEquivalentStatementReturned("show tables like '%'");
        assertEquivalentStatementReturned("show tables from information_schema like '%'");
        assertEquivalentStatementReturned("show functions");
        assertEquivalentStatementReturned("select cast('123' as bigint), try_cast('foo' as bigint)");
        assertEquivalentStatementReturned("select * from a.b.c");
        assertEquivalentStatementReturned("select * from a.b.c.e.f.g");
        assertEquivalentStatementReturned("select \"TOTALPRICE\" \"my price\" from \"$MY\"\"ORDERS\"");
        assertEquivalentStatementReturned("select * from foo tablesample system (10+1)");
        assertEquivalentStatementReturned(
                "select * from foo tablesample system (10) join bar tablesample bernoulli (30) on a.id = b.id");
        assertEquivalentStatementReturned(
                "select * from foo tablesample system (10) join bar tablesample bernoulli (30) on not(a.id > b.id)");
        assertEquivalentStatementReturned("create table foo as (select * from abc)");
        assertEquivalentStatementReturned("create table if not exists foo as (select * from abc)");
        assertEquivalentStatementReturned("create table foo with (a = 'apple', b = 'banana') as select * from abc");
        assertEquivalentStatementReturned("create table foo comment 'test' with (a = 'apple') as select * from abc");
        assertEquivalentStatementReturned("create table foo as select * from abc WITH NO DATA");
        assertEquivalentStatementReturned("create table foo as (with t(x) as (values 1) select x from t)");
        assertEquivalentStatementReturned(
                "create table if not exists foo as (with t(x) as (values 1) select x from t)");
        assertEquivalentStatementReturned("create table foo as (with t(x) as (values 1) select x from t) WITH DATA");
        assertEquivalentStatementReturned(
                "create table if not exists foo as (with t(x) as (values 1) select x from t) WITH DATA");
        assertEquivalentStatementReturned("create table foo as (with t(x) as (values 1) select x from t) WITH NO DATA");
        assertEquivalentStatementReturned(
                "create table if not exists foo as (with t(x) as (values 1) select x from t) WITH NO DATA");
        assertEquivalentStatementReturned("create table foo(a) as (with t(x) as (values 1) select x from t)");
        assertEquivalentStatementReturned(
                "create table if not exists foo(a) as (with t(x) as (values 1) select x from t)");
        assertEquivalentStatementReturned("create table foo(a) as (with t(x) as (values 1) select x from t) WITH DATA");
        assertEquivalentStatementReturned(
                "create table if not exists foo(a) as (with t(x) as (values 1) select x from t) WITH DATA");
        assertEquivalentStatementReturned(
                "create table foo(a) as (with t(x) as (values 1) select x from t) WITH NO DATA");
        assertEquivalentStatementReturned(
                "create table if not exists foo(a) as (with t(x) as (values 1) select x from t) WITH NO DATA");
        assertEquivalentStatementReturned("drop table foo");
        assertEquivalentStatementReturned("insert into foo select * from abc");
        assertEquivalentStatementReturned("delete from foo");
        assertEquivalentStatementReturned("delete from foo where a = b");
        assertEquivalentStatementReturned("values ('a', 1, 2.2), ('b', 2, 3.3)");
        assertEquivalentStatementReturned("table foo");
        assertEquivalentStatementReturned("table foo order by x limit 10");
        assertEquivalentStatementReturned("(table foo)");
        assertEquivalentStatementReturned("(table foo) limit 10");
        assertEquivalentStatementReturned("(table foo limit 5) limit 10");
        assertEquivalentStatementReturned("select * from a limit all");
        assertEquivalentStatementReturned("select * from a order by x limit all");
        assertEquivalentStatementReturned("select * from a union select * from b");
        assertEquivalentStatementReturned("table a union all table b");
        assertEquivalentStatementReturned("(table foo) union select * from foo union (table foo order by x)");
        assertEquivalentStatementReturned("table a union table b intersect table c");
        assertEquivalentStatementReturned("(table a union table b) intersect table c");
        assertEquivalentStatementReturned("table a union table b except table c intersect table d");
        assertEquivalentStatementReturned("(table a union table b except table c) intersect table d");
        assertEquivalentStatementReturned("((table a union table b) except table c) intersect table d");
        assertEquivalentStatementReturned("(table a union (table b except table c)) intersect table d");
        assertEquivalentStatementReturned("table a intersect table b union table c");
        assertEquivalentStatementReturned("table a intersect (table b union table c)");
        assertEquivalentStatementReturned("alter table foo rename to bar");
        assertEquivalentStatementReturned("alter table a.b.c rename to d.e.f");
        assertEquivalentStatementReturned("alter table a.b.c rename column x to y");
        assertEquivalentStatementReturned("alter table a.b.c add column x bigint");
        assertEquivalentStatementReturned("alter table a.b.c add column x bigint comment 'large x'");
        assertEquivalentStatementReturned("alter table a.b.c add column x bigint with (weight = 2)");
        assertEquivalentStatementReturned(
                "alter table a.b.c add column x bigint comment 'xtra' with (compression = 'LZ4', special = true)");
        assertEquivalentStatementReturned("alter table a.b.c drop column x");
        assertEquivalentStatementReturned("create schema test");
        assertEquivalentStatementReturned("create schema if not exists test");
        assertEquivalentStatementReturned("create schema test with (a = 'apple', b = 123)");
        assertEquivalentStatementReturned("drop schema test");
        assertEquivalentStatementReturned("drop schema test cascade");
        assertEquivalentStatementReturned("drop schema if exists test");
        assertEquivalentStatementReturned("drop schema if exists test restrict");
        assertEquivalentStatementReturned("alter schema foo rename to bar");
        assertEquivalentStatementReturned("alter schema foo.bar rename to baz");
        assertEquivalentStatementReturned("create table test (a boolean, b bigint, c double, d varchar, e timestamp)");
        assertEquivalentStatementReturned("create table test (a boolean, b bigint comment 'test')");
        assertEquivalentStatementReturned("create table if not exists baz (a timestamp, b varchar)");
        assertEquivalentStatementReturned("create table test (a boolean, b bigint) with (a = 'apple', b = 'banana')");
        assertEquivalentStatementReturned("create table test (a boolean, b bigint) comment 'test' with (a = 'apple')");
        assertEquivalentStatementReturned(
                "create table test (a boolean with (a = 'apple', b = 'banana'), b bigint comment 'bla' with (c = 'cherry')) comment 'test' with (a = 'apple')");
        assertEquivalentStatementReturned("drop table test");
        assertEquivalentStatementReturned("create view foo as with a as (select 123) select * from a");
        assertEquivalentStatementReturned("create or replace view foo as select 123 from t");
        assertEquivalentStatementReturned("drop view foo");
        assertEquivalentStatementReturned("insert into t select * from t");
        assertEquivalentStatementReturned("insert into t (c1, c2) select * from t");
        assertEquivalentStatementReturned("start transaction");
        assertEquivalentStatementReturned("start transaction isolation level read uncommitted");
        assertEquivalentStatementReturned("start transaction isolation level read committed");
        assertEquivalentStatementReturned("start transaction isolation level repeatable read");
        assertEquivalentStatementReturned("start transaction isolation level serializable");
        assertEquivalentStatementReturned("start transaction read only");
        assertEquivalentStatementReturned("start transaction read write");
        assertEquivalentStatementReturned("start transaction isolation level read committed, read only");
        assertEquivalentStatementReturned("start transaction read only, isolation level read committed");
        assertEquivalentStatementReturned("start transaction read write, isolation level serializable");
        assertEquivalentStatementReturned("commit");
        assertEquivalentStatementReturned("commit work");
        assertEquivalentStatementReturned("rollback");
        assertEquivalentStatementReturned("rollback work");
        assertEquivalentStatementReturned("call foo()");
        assertEquivalentStatementReturned("call foo(123, a => 1, b => 'go', 456)");
        assertEquivalentStatementReturned("grant select on foo to alice with grant option");
        assertEquivalentStatementReturned("grant all privileges on foo to alice");
        assertEquivalentStatementReturned("revoke grant option for select on foo from alice");
        assertEquivalentStatementReturned("revoke all privileges on foo from alice");
        assertEquivalentStatementReturned("show grants on table t");
        assertEquivalentStatementReturned("show grants on t");
        assertEquivalentStatementReturned("show grants");
        assertEquivalentStatementReturned("prepare p from select * from (select * from T) \"A B\"");
        assertEquivalentStatementReturned("SELECT * FROM table1 WHERE a >= ALL (VALUES 2, 3, 4)");
        assertEquivalentStatementReturned("SELECT * FROM table1 WHERE a <> ANY (SELECT 2, 3, 4)");
        assertEquivalentStatementReturned("SELECT * FROM table1 WHERE a = SOME (SELECT id FROM table2)");
        assertEquivalentStatementReturned("select CASE WHEN a > 3 THEN 'a' else 'b' end as x from foo");
        assertEquivalentStatementReturned("SELECT COALESCE(NULL, 1, 2)");

        // new lines
        assertEquivalentStatementReturned("" +
                "select depname, empno, salary\n" +
                ", count(*) over ()\n" +
                ", avg(salary) over (partition by depname)\n" +
                ", rank() over (partition by depname order by salary desc)\n" +
                ", sum(salary) over (order by salary rows unbounded preceding)\n" +
                ", sum(salary) over (partition by depname order by salary rows between current row and 3 following)\n" +
                ", sum(salary) over (partition by depname range unbounded preceding)\n" +
                ", sum(salary) over (rows between 2 preceding and unbounded following)\n" +
                "from emp");
        assertEquivalentStatementReturned("grant delete, select on foo to public");
        assertEquivalentStatementReturned("revoke insert, delete on foo from public"); // check support for public
        assertEquivalentStatementReturned("SELECT sum(IF(x > 1, x)), sum(x) FROM (VALUES 1, 1, 0, 2, 3, 3) t(x)");
        assertEquivalentStatementReturned("SELECT a,\nCASE a\nWhen 1 THEN 'one'\nWHEN 2 THEN 'two'\nELSE 'many'\nEND");
        assertEquivalentStatementReturned("SELECT NULLIF(4,4) AS Same, NULLIF(5,7) AS Different");
        assertEquivalentStatementReturned(
                "select EXISTS(select 1 from (values (null, null)) t(a, b) where t.a=t2.b GROUP BY t.b) from (values 1, 2) t2(b)");
        assertEquivalentStatementReturned("SELECT TRY(CAST(origin_zip AS BIGINT)) FROM shipping");
        assertEquivalentStatementReturned("select *\nfrom customer\nwhere city in ('Paris','London')");
        assertEquivalentStatementReturned("SELECT COUNT(CustomerID), Country\nFROM Customers\nGROUP BY Country");

        assertEquivalentStatementReturned("select *\nfrom customer\nWHERE Address IS NOT NULL");
        assertEquivalentStatementReturned(
                "select EXISTS(select 1 from (values (1, 2), (1, 2), (null, null), (3, 3)) t(a, b) where t.a=t2.b GROUP BY t.b) from (values 1, 2) t2(b)");
        assertEquivalentStatementReturned(
                "select * from (values 1, 2) t2(b), LATERAL (select t.a from (values 1, 1, 3) t(a) where t.a=t2.b GROUP BY t.a)");
        assertEquivalentStatementReturned(
                "SELECT EXISTS(SELECT 1 FROM (VALUES null, 10) t(x) WHERE y > x OR y + 10 > x) FROM (values (11)) t2(y)");
        assertEquivalentStatementReturned("set SESSION customer = 'old_value'");
        assertEquivalentStatementReturned("select *\nfrom customer\nwhere city = ?");
        assertEquivalentStatementReturned(
                "select (select count(*) from (values 1, 2, 3,4,5) t(a) where t.a = t2.a + (-t2.b) + 1 group by a limit 1) from (values (1.0, 1.0),(1.0, 2.0),(1.0, 2.0)) t2(a,b)");
        assertEquivalentStatementReturned("ANALYZE mytable");
        assertEquivalentStatementReturned(
                "SELECT timezone_hour(TIMESTAMP '2001-08-22 03:04:05.321' at time zone 'Asia/Oral')");
    }

    private void assertEquivalentQueryReturned(final String query) throws Exception {
        Query original = queryOperations.parseQuery(query);
        Query visited = (Query) original.accept(new MutateAstVisitor<>(), null);
        Assertions.assertEquals(original, visited);
    }

    private void assertEquivalentStatementReturned(final String statement) throws Exception {
        Statement original = new SqlParser().createStatement(statement,
                new ParsingOptions(ParsingOptions.DecimalLiteralTreatment.AS_DOUBLE));
        Statement visited = (Statement) original.accept(new MutateAstVisitor<>(), null);
        Assertions.assertEquals(original, visited);
    }
}
