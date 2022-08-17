Use this page to create a data product to import, transform and query data sources. Currently, the solution does not support editing or updating existing data product configuration.

Enter the following details:

- **Domain**: Choose a domain from the dropdown. You will need to associate a data product with a domain.
- **Name**: Data product name needs to be unique within a domain and only alphanumeric characters or underscores (_) are allowed. It must start with a letter, and have a maxmimum length of 256 characters.
- **Description**: Enter a description for the data product.
- **Source Type**: Select one of the following source types:
  - File Upload (csv, json or parquet file types allowed)
  - Amazon S3 (supports folder level import with multiple schema)
  - Amazon Kinesis Stream
  - Google Analytics (Note: custom dimensions and metrics are supported through the free entry field)
  - Google BigQuery (Select the location URL to provide access manually or by uploading a Service Account json file)
  - Google Storage (Select the location URL to provide access manually or by uploading a Service Account json file)
- **Automatically detect PII**: Toggle this option to automatically detects private information when data is imported, such as phone number, address, credit card details, etc. Data is redacted during the query run phase based on business attributes configured in the governance page.

**Update trigger**

Depending on the source type, you can schedule updates. Select from one of the following triggers:

- **On Demand**: Only import the data at the time of creating the new data product. If you want to refresh the data, you will need to manually trigger an update.
- **Schedule**: Choose the interval you would like data to be refreshed. This includes hourly, daily, weekly, monthly, or a custom window
- **Automatic**: Refreshes data continuously.
**Note**: Setting the trigger to Automatic can result in large operating costs.