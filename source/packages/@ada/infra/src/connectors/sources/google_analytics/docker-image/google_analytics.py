###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import time
import os
from collections import namedtuple
from apiclient.discovery import build
from oauth2client.service_account import ServiceAccountCredentials

class GoogleAnalytics():
    ga_service = namedtuple('gaService', ['name', 'version', 'scopes'])
    _services = {
        'reporting': ga_service(name='analyticsreporting',
                               version='v4',
                               scopes=['https://www.googleapis.com/auth/analytics.readonly']),
        'management': ga_service(name='analytics',
                                version='v3',
                                scopes=['https://www.googleapis.com/auth/analytics'])
    }

    def __init__(self, key_file=None):
        self.file_location = key_file if key_file else os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")

    def get_service_object(self, name):
        service = GoogleAnalytics._services[name]
        credentials = ServiceAccountCredentials.from_json_keyfile_name(self.file_location,
                                                                           service.scopes)
        return build(service.name, service.version, credentials=credentials)

    def get_management_report(self,
                              view_id,
                              since,
                              until,
                              metrics,
                              dimensions):

        analytics = self.get_service_object(name='management')

        return analytics.data().ga().get(
            ids=view_id,
            start_date=since,
            end_date=until,
            metrics=metrics,
            dimensions=dimensions).execute()

    def get_analytics_report(self,
                             view_id,
                             since,
                             until,
                             sampling_level,
                             dimensions,
                             metrics,
                             page_size,
                             include_empty_rows):

        analytics = self.get_service_object(name='reporting')

        #https://developers.google.com/analytics/devguides/reporting/core/v4/rest/v4/reports/batchGet

        report_request = {
            'viewId': view_id,
            'dateRanges': [{'startDate': since, 'endDate': until}],
            'samplingLevel': sampling_level or 'LARGE',
            'dimensions': dimensions,
            'metrics': metrics,
            'pageSize': page_size or 10000,
            'includeEmptyRows': include_empty_rows or False
        }

        response = (analytics
                    .reports()
                    .batchGet(body={'reportRequests': [report_request]})
                    .execute())

        if response.get('reports'):
            report = response['reports'][0]
            rows = report.get('data', {}).get('rows', [])

            while report.get('nextPageToken'):
                time.sleep(1)
                report_request.update({'pageToken': report['nextPageToken']})
                response = (analytics
                    .reports()
                    .batchGet(body={'reportRequests': [report_request]})
                    .execute())
                report = response['reports'][0]
                rows.extend(report.get('data', {}).get('rows', []))

            if report['data']:
                report['data']['rows'] = rows
            return report
        else:
            return {}