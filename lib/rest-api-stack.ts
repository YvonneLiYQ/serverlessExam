import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { movies, movieCasts, movieAwards, movieCrew } from "../seed/movies";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as node from "aws-cdk-lib/aws-lambda-nodejs";

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tables
    const moviesTable = new dynamodb.Table(this, "MoviesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
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

    const movieAwardsTable = new dynamodb.Table(this, "MovieAwardsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "awardBody", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieAwards",
    });
 
    const movieCrewTable = new dynamodb.Table(this, "MovieCrewTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "crewRole", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieCrew",
    });

    // Functions
    const getMovieByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetMovieByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getMovieById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          MOVIES_TABLE_NAME: moviesTable.tableName,
          CAST_TABLE_NAME: movieCastsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const getAllMoviesFn = new lambdanode.NodejsFunction(
      this,
      "GetAllMoviesFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getAllMovies.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: moviesTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const getMovieCastMembersFn = new lambdanode.NodejsFunction(
      this,
      "GetCastMemberFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getMovieCastMember.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: movieCastsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );

    const deleteMovieByIdFn = new lambdanode.NodejsFunction(
      this,
      "DeleteMovieByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/deleteMovieById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: moviesTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );
    const getMoviesByAwardBodyAndMovieIdFn = new lambdanode.NodejsFunction(
      this,
      "getMoviesByAwardBodyAndMovieIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getMoviesByAwardBodyAndMovieId.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          AWARD_TABLE_NAME: movieAwardsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );
    const getMoviesAwardByAwardBodyFn
    = new lambdanode.NodejsFunction(
      this,
      "getMoviesAwardByAwardBodyFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/getMoviesAwardByAwardBody.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          AWARD_TABLE_NAME: movieAwardsTable.tableName,
          REGION: "eu-west-1",
        },
      }
    );
    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      environment: {
          REGION: cdk.Aws.REGION,
      },
    };
    
    

    const getminFn = new node.NodejsFunction(this, "Translate", {
      ...appCommonFnProps,
      entry: "./lambdas/translate.ts",
      environment: {
          ...appCommonFnProps.environment, 
          MIN_TABLE_NAME: movieAwardsTable.tableName, 
      },
    }
    )
    

    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [moviesTable.tableName]: generateBatch(movies),
            [movieCastsTable.tableName]: generateBatch(movieCasts),
            [movieAwardsTable.tableName]: generateBatch(movieAwards),
            [movieCrewTable.tableName]: generateBatch(movieCrew),


          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [moviesTable.tableArn, movieCastsTable.tableArn, movieAwardsTable.tableArn, movieCrewTable.tableArn]
      }),
    });

    const api = new apig.RestApi(this, "RestAPI", {
      description: "demo api",
      deployOptions: {
        stageName: "dev",
      },
      // 👇 enable CORS
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const moviesEndpoint = api.root.addResource("movies");
    moviesEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllMoviesFn, { proxy: true })
    );

    const movieCastEndpoint = moviesEndpoint.addResource("cast");
    movieCastEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieCastMembersFn, { proxy: true })
    );

    const movieEndpoint = moviesEndpoint.addResource("{movieId}");
    movieEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieByIdFn, { proxy: true })
    );

    movieEndpoint.addMethod(
      "DELETE",
      new apig.LambdaIntegration(deleteMovieByIdFn, { proxy: true })
    );

    const awardsEndpoint = api.root.addResource("awards");
    const awardEndpoint = awardsEndpoint.addResource("{awardBody}");
    awardEndpoint .addMethod(
      "GET",
      new apig.LambdaIntegration(getMoviesAwardByAwardBodyFn, { proxy: true })
    );
    const awardMoviesEndpoint = awardEndpoint.addResource("movies");
    const awardMovieEndpoint = awardMoviesEndpoint.addResource("{movieId}");
    awardMovieEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMoviesByAwardBodyAndMovieIdFn, { proxy: true })
    );
    const getmin = awardMovieEndpoint.addResource('min');
    getmin.addMethod('GET', new apig.LambdaIntegration(getminFn));
      }
    }

  
    // Permissions;
    moviesTable.grantReadData(getMovieByIdFn);
    moviesTable.grantReadData(getAllMoviesFn);
     moviesTable.grantReadWriteData(deleteMovieByIdFn)
    movieCastsTable.grantReadData(getMovieCastMembersFn);
    movieCastsTable.grantReadData(getMovieByIdFn);
    movieAwardsTable.grantReadData(getMoviesByAwardBodyAndMovieIdFn);

  }
}
