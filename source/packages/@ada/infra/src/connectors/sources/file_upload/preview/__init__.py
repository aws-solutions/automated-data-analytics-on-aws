###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
from handlers.common import * # NOSONAR

from ...amazon_s3.preview.pull_samples import pull_samples

# port functionality from S3 connector
UPLOAD = IConnector(
  pull_samples=pull_samples
)
