Ada root admin user can deploy Apache Superset on AWS solution as a data analytics and visualization solution to work alongside ADA and provide other Ada users a lightweight and an intuitive way to explore and visualize their data sets.

Apache Superset on AWS solution is a standalone solution that is offered by an AWS Partner Solution “Apache Superset On AWS” (https://aws-ia.github.io/cfn-ps-apache-superset/).

NOTE: ADA only facilitates a convenient way of deploying AWS Partner Solutions “Amazon Virtual Private Cloud on AWS” and “Apache Superset On AWS” from its published source and artifacts. Both AWS Partner solutions are standalone solutions and do not form any part of the Automated Data Analytics Solution.

For ADA root admin users who want to deploy this, we recommend reading the deployment guides of both solutions and making sure your AWS account is configured for the deployment.

Once the Apache Superset solution is deployed, there will be two new stacks in AWS CloudFormation Console named: “superset-vpc” and “superset”. You can monitor the deployment process from AWS CodeBuild console and the progress is not displayed on the ADA web user interface.
