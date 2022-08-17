/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  AccountRecovery,
  CfnUserPool,
  CfnUserPoolRiskConfigurationAttachment,
  CfnUserPoolUser,
  Mfa,
  ResourceServerScope,
  StringAttribute,
  UserPool,
} from 'aws-cdk-lib/aws-cognito';
import { CfnOutput, CfnResource, NestedStackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CustomCognitoAttributes, DefaultClaims, ROOT_ADMIN_ID } from '@ada/common';
import {
  ExtendedNestedStack,
  UserPoolAddOnsAdvancedSecurityMode,
  addCfnNagSuppressions,
  getUniqueNameWithSolution,
} from '@ada/cdk-core';

export interface CognitoAuthStackProps extends NestedStackProps {
  adminEmailAddress: string;
  adminPhoneNumber?: string;
  adminMFA: Mfa;
  advancedSecurityMode: UserPoolAddOnsAdvancedSecurityMode;
}

export interface AdaUserPoolProps {
  selfSignUpEnabled: boolean;
  advancedSecurityMode: UserPoolAddOnsAdvancedSecurityMode;
}

/**
 * Cognito authentication stack
 */
export class CognitoAuthStack extends ExtendedNestedStack {
  public readonly userPool: UserPool;

  public readonly cognitoDomain: string;

  public readonly userIdScope: string;

  public readonly adaCognitoProps: AdaUserPoolProps;

  constructor(scope: Construct, id: string, props: CognitoAuthStackProps) {
    super(scope, id, props);

    this.adaCognitoProps = {
      selfSignUpEnabled: false,
      advancedSecurityMode: props.advancedSecurityMode,
    };

    this.userPool = new UserPool(this, 'UserPool', {
      selfSignUpEnabled: this.adaCognitoProps.selfSignUpEnabled,
      mfa: props.adminMFA,
      mfaSecondFactor: {
        sms: true,
        otp: false,
      },
      customAttributes: {
        [CustomCognitoAttributes.CLAIMS]: new StringAttribute({ minLen: 1, maxLen: 2048, mutable: true }),
        [CustomCognitoAttributes.GROUPS]: new StringAttribute({ minLen: 1, maxLen: 2048, mutable: true }),
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      // Default for UserPool in CDK is to retain, however the UserPool serves no purpose outside of
      // the solution so it should be destoyed.
      removalPolicy: RemovalPolicy.DESTROY,
    });

    addCfnNagSuppressions(this.userPool.node.findChild('smsRole').node.defaultChild as CfnResource, [
      {
        id: 'W11',
        reason:
          'Allowing * resource on permissions policy since its used by Cognito to send SMS messages via sns:Publish',
      },
    ]);

    // NOTE: for now support only cognito domain prefix, can be extedned to add support for custom domains
    const domain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        // domain name is globally unique based on globalHash, but does not include nodeHash to prevent breaking
        // external IdP settings when moved in CDK tree.
        domainPrefix: getUniqueNameWithSolution(this, 'domain', 'lower', { separator: '-', includeNodeHash: true }),
      },
    });
    this.cognitoDomain = `${domain.domainName}.auth.${this.region}.amazoncognito.com`;

    const adminUserAttributes = [
      { name: 'email_verified', value: 'true' },
      { name: 'email', value: props.adminEmailAddress },
      { name: `custom:${CustomCognitoAttributes.CLAIMS}`, value: DefaultClaims.ROOT },
      { name: 'preferred_username', value: ROOT_ADMIN_ID },
      { name: 'phone_number_verified', value: 'true' },
      { name: 'phone_number', value: props.adminPhoneNumber! },
    ];

    new CfnUserPoolUser(this, 'AdminUser', { //NOSONAR (S1848) - cdk construct is used
      userPoolId: this.userPool.userPoolId,
      desiredDeliveryMediums: ['EMAIL'],
      forceAliasCreation: true,
      userAttributes: adminUserAttributes,
      username: props.adminEmailAddress,
    });

    const cfnUserPool = this.userPool.node.defaultChild as CfnUserPool;

    // `addPropertyOverride` with IResolable is not propagating as cross-stack parameter between root and
    // cognito nested stack. To force this relationship use CfnOutput which correctly defines the
    // parameter in nested stack and propagates value.
    new CfnOutput(this, 'advancedSecurityModeOutput', { value: props.advancedSecurityMode }); //NOSONAR (typescript:S1848) - cdk construct is used
    cfnUserPool.addPropertyOverride('UserPoolAddOns.AdvancedSecurityMode', props.advancedSecurityMode);

    new CfnUserPoolRiskConfigurationAttachment(this, 'CognitoUserPoolRiskConfiguration', {
      clientId: 'ALL',
      userPoolId: this.userPool.userPoolId,
      accountTakeoverRiskConfiguration: {
        actions: {
          // NOTE: to add notification SES configuration is required
          highAction: {
            eventAction: 'BLOCK',
            notify: false,
          },
          mediumAction: {
            eventAction: 'MFA_IF_CONFIGURED',
            notify: false,
          },
          lowAction: {
            eventAction: 'NO_ACTION',
            notify: false,
          },
        },
      },
      compromisedCredentialsRiskConfiguration: {
        actions: {
          eventAction: 'BLOCK',
        },
      },
    });

    const adaResourceServerIdentifier = 'ada';
    const userIdScope = new ResourceServerScope({
      scopeName: 'userid',
      scopeDescription: 'scope used by user that issue their own tokens',
    });
    this.userPool.addResourceServer('AdaResourceServer', {
      identifier: adaResourceServerIdentifier,
      scopes: [userIdScope],
    });

    this.userIdScope = `${adaResourceServerIdentifier}/${userIdScope.scopeName}`;
  }
}

export default CognitoAuthStack;
