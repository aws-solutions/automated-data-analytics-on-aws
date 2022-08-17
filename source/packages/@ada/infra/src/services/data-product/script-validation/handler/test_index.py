###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import json, os
from .index import scan_script, handler, bandit_output_to_report

BAD_SCRIPT = """
from subprocess_Popen import subprocess as subprocess
subprocess.Popen('touch bad.txt', shell = True)
"""

NOSEC_SCRIPT = """
from subprocess_Popen import subprocess as subprocess # nosec
subprocess.Popen('touch bad.txt', shell = True) # nosec
"""

GOOD_SCRIPT = """
def apply_transform(input_frame, **kwargs):
  return [input_frame]
"""

INVALID_SCRIPT = """
def apply_transform(foo), **karwgs):
  reutrn foo
"""

def test_should_report_bad_script():
  report = scan_script(BAD_SCRIPT)
  assert report['passed'] == False
  assert len(report['results']) == 1
  assert report['metrics'] == {
    'confidence': { 'LOW': 1, 'MEDIUM': 0, 'HIGH': 1 },
    'severity': { 'LOW': 1, 'MEDIUM': 1, 'HIGH': 0 },
    'loc': 2,
    'skippedTests': 0,
    'nosec': 0,
  }
  assert report['results'][0] == {
    'code': "2 from subprocess_Popen import subprocess as subprocess\n3 subprocess.Popen('touch bad.txt', shell = True)\n",
    'columnOffset': 0,
    'issueConfidence': 'LOW',
    'issueSeverity': 'MEDIUM',
    'cwe': { 'id': 78, 'link': 'https://cwe.mitre.org/data/definitions/78.html' },
    'lineNumber': 3,
    'lineRange': [3],
    'issueText': 'Function call with shell=True parameter identified, possible security issue.',
    'moreInfo': 'https://bandit.readthedocs.io/en/1.7.4/plugins/b604_any_other_function_with_shell_equals_true.html',
    'testId': 'B604',
    'testName': 'any_other_function_with_shell_equals_true',
  }

def test_should_report_bad_script_with_nosec():
  report = scan_script(NOSEC_SCRIPT)
  assert report['passed'] == False
  assert len(report['results']) == 1

def test_should_report_bad_for_invalid_script():
  report = scan_script(INVALID_SCRIPT)
  assert report['passed'] == False
  assert len(report['results']) == 0
  assert len(report['errors']) == 1
  assert report['errors'][0]['reason'] == 'syntax error while parsing AST from file'

def test_should_report_ok_for_good_script():
  report = scan_script(GOOD_SCRIPT)
  assert report['passed'] == True
  assert len(report['results']) == 0

def test_handler_bad_script():
  response = handler({ 'body': json.dumps({ 'scriptSource': BAD_SCRIPT }) })
  print(response)
  assert response['statusCode'] == 200

def test_handler_good_script():
  response = handler({ 'body': json.dumps({ 'scriptSource': GOOD_SCRIPT }) })
  report = json.loads(response['body'])['report']
  print(response)
  assert report['passed'] == True
  assert len(report['errors']) == 0
  assert len(report['results']) == 0
  assert response['statusCode'] == 200

def test_handler_invalid_script():
  response = handler({ 'body': json.dumps({ 'scriptSource': INVALID_SCRIPT }) })
  report = json.loads(response['body'])['report']
  print(response)
  assert response['statusCode'] == 200
  assert report['passed'] == False
  assert len(report['errors']) == 1
  assert len(report['results']) == 0
  assert report['errors'][0]['reason'] == 'syntax error while parsing AST from file'

def test_handler_error():
  response = handler({ 'body': '{}' })
  print(response)
  assert response['statusCode'] == 400
  error = json.loads(response['body'])
  assert error['name'] == 'InvalidRequestError'

def test_handler_500_error_as_409():
  try:
    # override os path to force 500 error
    __PATH__ = os.environ["PATH"]
    os.environ["PATH"] = 'barf'

    response = handler({ 'body': json.dumps({ 'scriptSource': GOOD_SCRIPT }) })
    print(response)
    assert response['statusCode'] == 409
    error = json.loads(response['body'])
    assert error['name'] == 'Error'
    assert error['message'] == 'Failed to service request'
    assert error['details'] == error['errorId']
    assert len(error['errorId']) == 10
  finally:
    os.environ["PATH"] = __PATH__
