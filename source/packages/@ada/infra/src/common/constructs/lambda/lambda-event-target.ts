/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import * as events from 'aws-cdk-lib/aws-events';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { TargetBaseProps, bindBaseTargetConfig } from 'aws-cdk-lib/aws-events-targets';

/**
 * Customize the Lambda Event Target
 */
interface LambdaFunctionProps extends TargetBaseProps {
    /**
     * The event to send to the Lambda
     *
     * This will be the payload sent to the Lambda Function.
     *
     * @default the entire EventBridge event
     */
    readonly event?: events.RuleTargetInput;
}

/**
 * Use an AWS Lambda function as an event rule target.
 * Modification of LambdaFunction from 'aws-events-targets' to not add a permission on 
 * the target lambda function for every Data Product created, in order to not overload 
 * the lambda policy size limit of the target Lambda Function. 
 */
export class EventLambdaTargetFunction implements events.IRuleTarget {
    // eslint-disable-next-line no-empty-function
    constructor(private readonly handler: lambda.IFunction, private readonly props: LambdaFunctionProps = {}) {
    }

    /**
     * Returns a RuleTarget that can be used to trigger this Lambda as a
     * result from an EventBridge event.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public bind(_rule: events.IRule, _id?: string): events.RuleTargetConfig {
        return {
            ...bindBaseTargetConfig(this.props),
            arn: this.handler.functionArn,
            input: this.props.event,
            targetResource: this.handler,
        };
    }
}