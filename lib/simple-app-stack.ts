import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { movies, movieCasts } from "../seed/movies";
import { Construct } from 'constructs';

export class SimpleAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the DynamoDB table
    const moviesTable = new dynamodb.Table(this, "MoviesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Movies",
    });

    const movieCastsTable = new dynamodb.Table(this, "MovieCastTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "actorName", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieCast",
    });

    movieCastsTable.addLocalSecondaryIndex({
      indexName: "roleIx",
      sortKey: { name: "roleName", type: dynamodb.AttributeType.STRING },
    });

    // Initialize the table with data
    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [moviesTable.tableName]: generateBatch(movies),
            [movieCastsTable.tableName]: generateBatch(movieCasts),  // Added
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [moviesTable.tableArn, movieCastsTable.tableArn],
      }),
    });

    // Create the GetMovieById Lambda function
    const getMovieByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getMovieById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: moviesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    // Create a URL for the GetMovieById function
    const getMovieByIdURL = getMovieByIdFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
      },
    });

    // Grant read access to the GetMovieById function
    moviesTable.grantReadData(getMovieByIdFn);

    // Create the GetAllMovies Lambda function
    const getAllMoviesFn = new lambdanode.NodejsFunction(
      this,
      "GetAllMoviesFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getAllMovies.ts`, // Path to the new Lambda function
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: moviesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    // Create a URL for the GetAllMovies function
    const getAllMoviesURL = getAllMoviesFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ["*"],
      },
    });

    // Grant read access to the GetAllMovies function
    moviesTable.grantReadData(getAllMoviesFn);

    const getMovieCastMembersFn = new lambdanode.NodejsFunction(
      this,
      "GetCastMemberFn",
    {
            architecture: lambda.Architecture.ARM_64,
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: `${__dirname}/../lambdas/getMovieCastMembers.ts`,
            timeout: cdk.Duration.seconds(10),
            memorySize: 128,
            environment: {
              CAST_TABLE_NAME: movieCastsTable.tableName,
              REGION: "eu-west-1",
    },
    }
    );

        const getMovieCastMembersURL = getMovieCastMembersFn.addFunctionUrl({
          authType: lambda.FunctionUrlAuthType.NONE,
          cors: {
            allowedOrigins: ["*"],
    },
    });   

    movieCastsTable.grantReadData(getMovieCastMembersFn);


    // Output the URLs for the functions
    new cdk.CfnOutput(this, "Get Movie Function URL", { value: getMovieByIdURL.url });
    new cdk.CfnOutput(this, "Get All Movies Function URL", { value: getAllMoviesURL.url });
    new cdk.CfnOutput(this, "Get Movie Cast Url", {value: getMovieCastMembersURL.url,});}
}
