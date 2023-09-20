/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CfnParameter, CfnRule, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Mfa } from 'aws-cdk-lib/aws-cognito';

enum UserPoolAddOnsAdvancedSecurityModeEnum {
  AUDIT = 'AUDIT',
  ENFORCED = 'ENFORCED',
  OFF = 'OFF',
}

export type UserPoolAddOnsAdvancedSecurityMode = keyof typeof UserPoolAddOnsAdvancedSecurityModeEnum;

/**
 * Input Parameters
 * Does not extend construct class to avoid that it change the name of the input parameter.
 * To be used in the main stack
 */
export class InputParameters {
  public readonly adminEmail: string;

  public readonly adminPhoneNumber: string;

  public readonly autoAssociateAdmin: string;

  public readonly adminMFA: Mfa;

  public readonly advancedSecurityMode: UserPoolAddOnsAdvancedSecurityMode;

  public readonly sendAnonymousData: string;

  constructor(scope: Construct) {
    const adminEmail = new CfnParameter(scope, 'adminEmail', {
      type: 'String',
      description:
        'The email address of the administrator. This has to be a valid address, you will receive the temporary password to this address.',
      // try to get the default value from the context, so that it will not break the CI/CD
      default: scope.node.tryGetContext('adminEmail'),
      allowedPattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
      constraintDescription: ' must be a valid email address.',
    });
    this.adminEmail = adminEmail.valueAsString;

    const defaultAdminPhoneNumber = scope.node.tryGetContext('adminPhoneNumber') ?? '+15555550123';

    const adminPhoneNumber = new CfnParameter(scope, 'adminPhoneNumber', {
      type: 'String',
      description:
        'The phone number of the administrator. Must be a valid phone number in E.164 format (e.g. +15555550123) that can receive OTP messages if MFA is enabled. Change the default value to your phone number if you want to enable this functionality',
      default: defaultAdminPhoneNumber,
      allowedPattern: '^\\+[1-9]\\d{1,14}$',
      constraintDescription: ' must be a valid phone number in E.164 format, e.g. +15555550123',
    });
    this.adminPhoneNumber = adminPhoneNumber.valueAsString;

    const adminMFA = new CfnParameter(scope, 'adminMFA', {
      type: 'String',
      description: 'Indicates if Multi-Factor Authentication (MFA) is enabled for root administrator.',
      default: scope.node.tryGetContext('adminMFA') || Mfa.OPTIONAL,
      allowedValues: ['OPTIONAL', 'ON'],
    });
    this.adminMFA = adminMFA.valueAsString as Mfa;

    new CfnRule(scope, 'adminMFAPhoneNumberRule', {
      ruleCondition: Fn.conditionEquals(this.adminMFA, 'ON'),
      assertions: [
        {
          assert: Fn.conditionNot(Fn.conditionEquals(adminPhoneNumber, defaultAdminPhoneNumber)),
          assertDescription:
            'When Multi-Factor Authentication (MFA) is enabled, a valid phone number of the administrator must be provided',
        },
      ],
    });

    const advancedSecurityMode = new CfnParameter(scope, 'advancedSecurityMode', {
      type: 'String',
      description: 'The advanced security mode for cognito user pool',
      default: scope.node.tryGetContext('advancedSecurityMode') || UserPoolAddOnsAdvancedSecurityModeEnum.ENFORCED,
      allowedValues: Object.values(UserPoolAddOnsAdvancedSecurityModeEnum),
    });
    this.advancedSecurityMode = advancedSecurityMode.valueAsString as UserPoolAddOnsAdvancedSecurityMode;

    const autoAssociateAdmin = new CfnParameter(scope, 'autoAssociateAdmin', {
      type: 'String',
      description:
        'Indicates if the admin role is automatically mapped to the users from external identity providers if the email matches the admin email address provided as parameter during the deployment.',
      default: 'true',
      allowedValues: ['true', 'false'],
    });
    this.autoAssociateAdmin = autoAssociateAdmin.valueAsString;

    const sendAnonymousData = new CfnParameter(scope, 'sendAnonymousData', {
      type: 'String',
      description:
        'Send anonymized operational metrics to AWS. We use this data to better understand how customers use this solution and related services and products. Choose No to opt out of this feature.',
      default: 'Yes',
      allowedValues: ['Yes', 'No'],
    });
    this.sendAnonymousData = sendAnonymousData.valueAsString;
  }
}
