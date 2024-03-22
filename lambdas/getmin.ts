import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        
        const parameters = event?.pathParameters;
        const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
        const awardBody = parameters?.awardBody ? parameters.awardBody: undefined;


        const queryParams = event.queryStringParameters;
        const min = queryParams?.min? parseInt(queryParams.min) : undefined;


        if (!movieId || !awardBody) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Movie ID and Award Body are required" }),
            };
        }


        const commandOutput = await ddbDocClient.send(
            new QueryCommand({
                TableName: process.env.MIN_TABLE_NAME,
                KeyConditionExpression: "movieId = :movieId and awardBody = :awardBody",
                FilterExpression: "numAwards >= :min",
                ExpressionAttributeValues: {
                    ":movieId": movieId,
                    ":awardBody": awardBody,
                    ":min": min,
                },
            })
        );

        if (!commandOutput.Items || commandOutput.Items.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({ message: "No awards found for the given movie ID and award body" }),
            };
        }

        const body = {
            data: commandOutput.Items,
        };
        return {
            statusCode: 200,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(body),
        };
    } catch (error: any) {
        console.log(JSON.stringify(error));
        return {
            statusCode: 500,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ error }),
        };
    }
};

function createDDbDocClient() {
    const ddbClient = new DynamoDBClient({ region: process.env.REGION });
    const marshallOptions = {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    };
    const unmarshallOptions = {
        wrapNumbers: false,
    };
    const translateConfig = { marshallOptions, unmarshallOptions };
    return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}