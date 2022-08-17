# Cypress e2e Testing 

## Pre-req:
- Google Chrome installed


## Folder structure
Reference: https://docs.cypress.io/guides/references/configuration#Folders-Files

```
.
├── downloads (Path to folder where files downloaded during a test are saved
)
├── fixtures (for static data in json format you want to load into tests)
├── integration (tests are located here and run in the order of the folder number)
│   ├── 1-DataProduct
│   └── 999-Delete
├── plugins (cypress plugins eg. clip board)
├── results (test results)
├── screenshots  (failed test screenshots)
│   └── 1-DataProduct
│       └── createDataProduct.ts
├── support (any code abstractions should go into command.ts, eg. we have amplify login as a command)
├── testing-data 
└── videos
```


## Local testing 

headless mode
```
yarn run cypress run --config baseUrl=https://dXXXXXXXXXX.cloudfront.net/ --env baseApiUrl=https://XXXXXXXXXXXX.execute-api.us-west-2.amazonaws.com/prod/,username='username',password='Hello123!',userPoolId=us-west-2_XXXXX,userPoolClientId=4v9quq3sngoqdshh1vu9vlp0vk,testingBucket=s3testingBucket-2345 --browser chrome
```

with browser open plus cypress gui open
```
yarn run cypress open --config baseUrl=https://dXXXXXXXXXX.cloudfront.net/ --env baseApiUrl=https://XXXXXXXXXXXX.execute-api.us-west-2.amazonaws.com/prod/,username='username',password='Hello123!',userPoolId=us-west-2_XXXXX,userPoolClientId=4v9quq3sngoqdshh1vu9vlp0vk,testingBucket=s3testingBucket-2345 --browser chrome
```
Note: 

`testingBucket` is the s3 bucket location of a file you provide to run as an s3 sourced data product.

`baseApiUrl` is the backend api urls

`baseUrl` is the cloudfront hosted url

## Further Configuration
source/cypress.json is the file to configure general cypress features such as retries, default timeouts, reporters, output paths, enabling video recording and experimental studio, etc. 


## Licenses for testing-data
The testing data `social-generated-data.csv` has been generated with a tool that's distributed with an MIT license. [CSV Generator License](https://github.com/cyrilbois/Web-CSV-Generator/blob/master/LICENSE)