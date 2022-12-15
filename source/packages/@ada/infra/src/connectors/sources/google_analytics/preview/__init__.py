###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
from handlers.common import * # NOSONAR
from .pull_samples import pull_samples

GOOGLE_ANALYTICS = IConnector(
  pull_samples=pull_samples
)
