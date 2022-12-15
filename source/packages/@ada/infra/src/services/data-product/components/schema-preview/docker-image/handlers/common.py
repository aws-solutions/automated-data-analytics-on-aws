###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
from dataclasses import dataclass
from typing import Mapping, Callable, List, Optional, Type, Union
from typing_extensions import TypedDict, NewType, Literal
from csv import Dialect
from awsglue.dynamicframe import DynamicFrame

# Ensure this remains in sync with DataSetIds.DEFAULT in typescript
DEFAULT_DATASET_ID = 'ada_default_dataset'

VARCHAR_255 = 'varchar(255)'
DECIMAL_20_5 = 'decimal(20,5)'

class InternalError(Exception):
    pass

class DateRangeException(Exception):
    pass

class InvalidScheduleRateException(Exception):
    pass

class NoSourceDataFoundException(Exception):
    pass

class UnsupportedSourceTypeException(Exception):
    pass


class UnsupportedDataFormatException(Exception):
    pass

class UnsupportedSourceDataException(Exception):
    pass


ICallingUser = TypedDict('ICallingUser', {
    'userId': str,
    'groups': List[str],
})

ICallingUserProcessed = TypedDict('ICallingUser', {
  'hashed': str,
  'sanitized': str,
})

IS3Location = TypedDict('IS3Location', {
  'bucket': str,
  'key': str,
})
"""S3 Location dict with 'bucket' and 'key' attributes"""

ICsvMetadata = TypedDict('ICsvMetadata', {
  'delimiter': Type[Dialect.delimiter],
  'quotechar': Type[Dialect.quotechar],
  'escapechar': Type[Dialect.escapechar],
  'quoting': Type[Dialect.quoting],
  'doublequote': Type[Dialect.doublequote],
  'skipinitialspace': Type[Dialect.skipinitialspace],
  'lineterminator': Type[Dialect.lineterminator],
})

UClassification = Union[
  Literal['parquet'],
  Literal['csv'],
  Literal['json'],
]

UTriggerType = Union[
  Literal['AUTOMATIC'],
  Literal['ON_DEMAND'],
  Literal['SCHEDULE'],
]

@dataclass(init=True, frozen=True)
class Sample:
  name: str
  df: DynamicFrame
  classification: UClassification
  s3_path: Optional[str] = None
  metadata: Optional[str] = None


ISourceDetails = NewType('ISourceDetails', dict)
"""Dict containing source details for a given data product"""

IUpdateTrigger = TypedDict('IUpdateTrigger', {
  'triggerType': UTriggerType,
  'scheduleRate': str,
})
"""Dict containing update trigger for a given data product"""

IDataProduct = TypedDict('IDataProduct', {
  'sourceType': str,
  'sourceDetails': ISourceDetails,
  'updateTrigger': IUpdateTrigger,
})

IGoogleCreds = NewType('IGoogleCreds', any)
"""Google service account credentials"""

@dataclass
class IPullSamplesInput:
  source_details: ISourceDetails
  """The source details dict for data product for which sample data will be pulled"""
  update_trigger: IUpdateTrigger
  """The update trigger dict for the data product for which sample data will be pulled"""
  sample_size: int
  """The number of rows to sample"""
  boto3_session: any
  """The boto3 session with assumed iam role"""

IPullSamplesReturn = List[Sample]

IPullSampleCallback = Callable[[IPullSamplesInput], IPullSamplesReturn]

@dataclass
class IConnector:
  pull_samples: IPullSampleCallback
  """
  Callback for specific connector to pull sample data from source based
  for a given data product
  """

IConnectorMapping = Mapping[str, IConnector]
"""Mapping of connector ids to implementation"""
