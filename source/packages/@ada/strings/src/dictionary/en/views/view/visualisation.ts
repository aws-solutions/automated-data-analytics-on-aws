/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export const VISUALISATION = {
  title: 'Deploy Visualization solution - Apache Superset on AWS',
  nav: 'Visualization',

  htmlBody: `<p>This feature allows you to deploy Apache Superset on AWS solution as an data analytics and visualization platform for Automated Data Analytics on AWS (ADA) solution. You can use Apache Superset to ingest data from ADA data products and help ADA users explore and visualize their data sets.</p>
  <p><b>Note: </b>Apache Superset is offered by an AWS Partner Solution <b>Apache Superset On AWS</b> and is a standalone solution that runs alongside the ADA solution, serving as the visualization platform to ADA.</p>
  <p><b>How to deploy Apache Superset on AWS</b></p>
  <p>Before deploying, read the following deployment guides for the solutions that will be deployed, and make sure your AWS account is set up for this deployment.
  <ul>
  <li>Amazon Virtual Private Cloud on AWS - <a href="https://aws-ia.github.io/cfn-ps-aws-vpc/">Deployment Guide</a></li>
  <li>Apache Superset on AWS - <a href="https://aws-ia.github.io/cfn-ps-apache-superset/">Deployment Guide</a></li>
  </ul>
  <p><b>Note:</b> You must deploy the <b>Apache Superset on AWS</b> solution in the same AWS account where the ADA solution is deployed.</p>
  <ol>
  <li>Click <b>Deploy Apache Superset</b> to start the deployment. The deployment takes place in an AWS CodeBuild build. After the deployment is initiated, you can monitor the deployment progress from AWS CodeBuild console.</li>
  <li>After the deployment is completed, navigate to the AWS CloudFormation console and nagivate to the <b>superset</b> stack to verify that it has been deployed successfully.</li>
  <li>On the Outputs tab, under <b>SupersetConsole</b>, copy the URL and open it in a browser. This URL points to Apache Superset's web console. The default user name and password are below. You must change the admin password after the first login.
  <ul>
  <li>Username: admin</li>
  <li>Password: admin</li>
  </ul>
  </li>
  </ol>
  <p><b>Connect to the data products in Ada</b></p>
  <p>To connect to the data products in Ada:
  <ol>
  <li>From the ADA user profile, create an API key for the ADA user who will access ADA data using Apache Superset. </li>
  <li>Open Apache Superset and choose <b>Settings→Database Connections</b> and click <b>+Database</b> button.</li>
  <li>From the Supported Databases drop-down list, choose <b>Other</b>. and enter the following URI in the SQLALCHEMY URI field:
  <pre>awsathena+rest://api-key&lt;Ada API Key&gt;:1234@athena.&lt;AWS Region&gt;.amazonaws.com:443?catalog_name=&lt;ADA Data Product Domain Identifier&gt;&s3_staging_dir=s3%3A//</pre>
  </li>
  <li>Edit the Display Name from <b>Other</b> to <i>Ada [Data Product Domain Name]</i>.</li>
  <li>Click <b>Test Connection</b> to make sure Apache Superset can connect to the ADA data product.</li>
  <li>Once confirmed, click <b>Connect</b> to create this database connection. You can now start using Apache Superset to analyze data from the ADA platform.</li>
  </ol>
  </p>
  <p><b>NOTE:</b> Deploying the Apache Superset on AWS solution will require user access to the AWS Management Console and an intermediate level of knowledge of AWS service administration. Make sure you have sufficient permissions and access rights before starting the deployment process.</p>
  `,
  NOTIFY: {
    error: {
      header: 'Failed to start deploying visualisation solution',
    },
    success: {
      header: 'Successfully started visualisation solution deployment',
      content: 'Monitor status of the deployment with provided details',
    },
  },

  HELP: {
    ROOT: {
      header: 'Deploy visualization solution - Apache Superset on AWS',
    },
  },
} as const;
