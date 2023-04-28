###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################

import base64
import json

import handlers.sampling as sampling

class SamplingTestHelpers:
  @staticmethod
  def pull_data_sample(source_type, source_details):
      return sampling.handler({
          "Payload": {
              "sampleSize": 10,
              "dataProduct": {
                  "dataProductId": "test-data-product",
                  "domainId": "test-domain",
                  "sourceType": source_type,
                  "sourceDetails": base64.b64encode(json.dumps(source_details).encode("utf-8")),
              },
              "callingUser": {
                  "userId": "darthvader",
                  "groups": ["sith", "skywalker"]
              }
          }
      }, None)

  @staticmethod
  def pull_scheduled_data_sample(source_type, source_details):
      return sampling.handler({
          "Payload": {
              "sampleSize": 10,
              "dataProduct": {
                  "dataProductId": "test-data-product",
                  "domainId": "test-domain",
                  "sourceType": source_type,
                  "sourceDetails": base64.b64encode(json.dumps(source_details).encode("utf-8")),
                  "updateTrigger": {
                      "triggerType": "SCHEDULE",
                      "scheduleRate": "rate(1 month)",
                      "updatePolicy": "APPEND"
                  }
              },
              "callingUser": {
                  "userId": "darthvader",
                  "groups": ["sith", "skywalker"]
              }
          }
      }, None)