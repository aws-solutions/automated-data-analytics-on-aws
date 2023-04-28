###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
from handlers.common import * # NOSONAR
from .pull_samples import pull_samples

CLOUDTRAIL = IConnector(
  pull_samples=pull_samples
)
