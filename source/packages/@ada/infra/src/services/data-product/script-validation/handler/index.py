###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import subprocess, json, os, logging
from pathlib import Path
import shortuuid

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

logger = logging.getLogger(name="script-validation/handler")
logger.setLevel(LOG_LEVEL)

TASK_DIR = str(Path(os.path.dirname(os.path.realpath(__file__))).parent.absolute())
TASK_BIN_DIR = str(Path(TASK_DIR).joinpath('bin').absolute())
os.environ["PATH"] += os.pathsep + TASK_DIR + os.pathsep + TASK_BIN_DIR

# only has bin directory when it is packaged into the lambda
IS_IN_LAMBDA=os.path.isdir(TASK_BIN_DIR)

BANDIT_CMD_ARGS = [
  "-",
  "--format", "json",
  "--severity-level", "medium",
  # Do NOT allow user to ignore via "nosec"
  "--ignore-nosec",
]

def generate_error_uuid ():
  return shortuuid.ShortUUID().random(length=10)

def scan_script(script_source: str):
  logger.info("scanning script:", extra={ 'scriptSource': script_source })

  if IS_IN_LAMBDA:
    BANDIT_CMD = ["python", TASK_BIN_DIR+"/bandit", *BANDIT_CMD_ARGS]
  else:
    BANDIT_CMD = ["bandit", *BANDIT_CMD_ARGS]

  try:
    bandit_process = subprocess.run(BANDIT_CMD, stdout=subprocess.PIPE, input=script_source, encoding='utf-8', env={
      "PYTHONPATH": os.environ["PATH"] + os.pathsep + TASK_DIR,
      "PATH": os.environ["PATH"]
    })

    output = bandit_process.stdout
    logger.debug("bandit response: %s", str(output))

    return bandit_output_to_report(json.loads(output))
  except ValidateScriptError as exception:
    raise exception
  except Exception as exception:
    raise ScanToolError(exception)

def bandit_output_to_report(output) -> dict:
  try:
    metric = output['metrics']['<stdin>']

    def get_metric(key: str, default_value: any):
      if (key in metric):
        return metric[key]
      return default_value

    return {
      'passed': len(output['results']) == 0 and len(output['errors']) == 0,
      'errors': output['errors'],
      'generatedAt': output['generated_at'],
      'metrics': {
        'confidence': {
          'LOW': get_metric('CONFIDENCE.LOW', 0),
          'MEDIUM': get_metric('CONFIDENCE.MEDIUM', 0),
          'HIGH': get_metric('CONFIDENCE.HIGH', 0),
        },
        'severity': {
          'LOW': get_metric('SEVERITY.LOW', 0),
          'MEDIUM': get_metric('SEVERITY.MEDIUM', 0),
          'HIGH': get_metric('SEVERITY.HIGH', 0),
        },
        'loc': get_metric('loc', '-'),
        'nosec': get_metric('nosec', 0),
        'skippedTests': get_metric('skipped_tests', 0),
      },
      'results': list(map(lambda x: ({
        'code': x['code'],
        'columnOffset': x['col_offset'],
        'issueConfidence': x['issue_confidence'],
        'issueSeverity': x['issue_severity'],
        'issueText': x['issue_text'],
        'cwe': x['issue_cwe'],
        'lineNumber': x['line_number'],
        'lineRange': x['line_range'],
        'moreInfo': x['more_info'],
        'testId': x['test_id'],
        'testName': x['test_name'],
      }), output['results']))
    }
  except Exception as exception:
    raise ParsingError(exception)

def handler(event, context=None): # NOSONAR
  try:
    logger.debug(json.dumps(event))
    body = json.loads(event['body'])

    script_source = None
    if 'scriptSource' in body:
      script_source = body['scriptSource']

    if (script_source == None):
      raise InvalidRequestError(details='Missing script source')

    report = scan_script(script_source)

    return ApiResponse(script_source=script_source, report=report)

  except ValidateScriptError as exception:
    return ApiErrorResponse(exception)
  except Exception as exception:
    return ApiErrorResponse(InternalServerError(cause=exception))


CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
}

def ApiResponse(*, script_source: str, report: dict) -> dict: # NOSONAR
  logger.info('Successfully validated script', extra={
    'scriptSource': script_source,
    'report': str(report),
  })
  return {
    'statusCode': 200,
    'body': json.dumps({
      'scriptSouce': script_source,
      'report': report,
    }),
    'headers': CORS_HEADERS,
  }

class ValidateScriptError(Exception):
  def __init__(self, *, status_code: int, message: str, details: str, cause: Exception = None):
    self.name = self.__class__.__name__
    self.statusCode = status_code
    self.message = message
    self.details = details
    self.cause = cause
    super().__init__(self.message)

class InvalidRequestError(ValidateScriptError):
  def __init__(self, *, details: str):
    super().__init__(status_code=400, message='Invalid request', details=details)
class InternalServerError(ValidateScriptError):
  def __init__(self, *, message: str = 'Internal server error', details: str = None, cause: Exception):
    super().__init__(status_code=500, message=message, details=str(cause) if details == None else details, cause=cause)

class ScanToolError(InternalServerError):
  def __init__(self, cause: Exception):
    super().__init__(message='Scan tool error', details=str(cause), cause=cause)

class ParsingError(InternalServerError):
  def __init__(self, cause: Exception):
    super().__init__(message='Failed to parse vulnerability report', details=str(cause), cause=cause)


def ApiErrorResponse(exception: ValidateScriptError) -> dict:  # NOSONAR
  error_id = generate_error_uuid()
  logger.exception("Failed to scan script " + exception.message, extra=dict({ 'errorId': error_id }))

  if (exception.statusCode >= 500):
    return {
      'statusCode': 409, # Mask 5XX internal server errors to 409 (CONFLICT) to prevent exposing details to maliscous parties
      'body': json.dumps({
        'name': 'Error',
        'message': 'Failed to service request',
        'details': error_id,
        'errorId': error_id,
      }),
      'headers': CORS_HEADERS,
    }
  else:
    return {
      'statusCode': exception.statusCode,
      'body': json.dumps({
        'name': exception.name,
        'message': exception.message,
        'details': exception.details,
        'cause': str(exception.cause) if exception.cause != None else None,
        'errorId': error_id,
      }),
      'headers': CORS_HEADERS,
    }
