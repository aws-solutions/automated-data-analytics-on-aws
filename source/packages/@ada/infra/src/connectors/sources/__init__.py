from handlers.common import IConnectorMapping

from .amazon_s3.preview import S3
from .file_upload.preview import UPLOAD
from .google_analytics.preview import GOOGLE_ANALYTICS
from .google_bigquery.preview import GOOGLE_BIGQUERY
from .google_storage.preview import GOOGLE_STORAGE
from .amazon_dynamodb.preview import DYNAMODB
from .amazon_cloudwatch.preview import CLOUDWATCH
from .jdbc_mysql5.preview import MYSQL5
from .jdbc_postgresql.preview import POSTGRESQL
from .jdbc_sqlserver.preview import SQLSERVER
from .jdbc_oracle.preview import ORACLE
from .amazon_cloudtrail.preview import CLOUDTRAIL
from .mongodb.preview import MONGODB
from .amazon_redshift.preview import REDSHIFT

CONNECTORS: IConnectorMapping = {
    'S3': S3,
    'UPLOAD': UPLOAD,
    'GOOGLE_ANALYTICS': GOOGLE_ANALYTICS,
    'GOOGLE_BIGQUERY': GOOGLE_BIGQUERY,
    'GOOGLE_STORAGE': GOOGLE_STORAGE,
    "DYNAMODB": DYNAMODB,
    "CLOUDWATCH": CLOUDWATCH,
    "MYSQL5": MYSQL5,
    "POSTGRESQL": POSTGRESQL,
    "SQLSERVER": SQLSERVER,
    "ORACLE": ORACLE,
    "CLOUDTRAIL": CLOUDTRAIL,
    "MONGODB": MONGODB,
    'REDSHIFT': REDSHIFT,
}
