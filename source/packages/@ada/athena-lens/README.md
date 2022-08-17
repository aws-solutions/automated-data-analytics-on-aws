# Athena Lens Lambdas

Athena User Defined Functions. UDFs allow you to create custom functions to process records or groups of records.

To use a UDF in Athena, you write a USING EXTERNAL FUNCTION clause before a SELECT statement in a SQL query. The SELECT statement references the UDF and defines the variables that are passed to the UDF when the query runs. The SQL query invokes a Lambda function using the Java runtime when it calls the UDF. UDFs are defined within the Lambda function as methods in a Java deployment package. Multiple UDFs can be defined in the same Java deployment package for a Lambda function. You also specify the name of the Lambda function in the USING EXTERNAL FUNCTION clause.

For more information https://github.com/awslabs/aws-athena-query-federation/wiki/How_To_Build_A_Connector_or_UDF

## Prerequisites
- Java 1.8+
- Apache Maven

## Development

### Building the project
```
mvn clean install
```

### Run Tests
```
mvn clean test
```

### Clean
```
mvn clean
```
