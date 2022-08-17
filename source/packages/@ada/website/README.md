# Solution Website

> This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

This package contains the Web UI for the deployed solution and is accessible via secured CloudFront domain endpoint once the solution has fully deployed.

The website is built using the open-source [Northstar](https://northstar.aws-prototyping.cloud/#/About%20NorthStar) project developed and mainatained by AWS.

## Local Development

### Prerequisites

Make sure you have a copy of `runtime-config.js` in the `public` directory that points to the desired deployed backend.

You can retrieve this by curling your cloudfront domain:

`curl https://dxxxxxxxxxx.cloudfront.net/runtime-config.js > public/runtime-config.js`

This should result in a `runtime-config.js` file of the following format:

```
window['runtime-config'] = {
  "userPoolId": "<region>_<id>",
  "userPoolClientId": "<client_id>",
  "apiUrl": "https://<api_id>.execute-api.<region>.amazonaws.com/prod/",
  "region": "<region>",
  "oauthScopes": [
    "phone",
    "profile",
    "openid",
    "email",
    "aws.cognito.signin.user.admin"
  ],
  "oauthDomain": "ada-domain-<unique_domain_id>.auth.<region>.amazoncognito.com",
  "ouathResponseType": "code",
  "athenaProxyApiUrl": "<proxy_api_domain>.cloudfront.net:443"
};
```

### `yarn start`

Runs the app in the development mode with hot-reloading enable to support live development of the website components.

> Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `yarn test`

Runs unit tests and generate coverage reports.

### `yarn run build`

Builds the app for production to the `build` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.

> Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
