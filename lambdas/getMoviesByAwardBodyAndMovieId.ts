import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { MovieAward } from "../shared/types";
const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
type ResponseBody = {
  
    award?: MovieAward[];
  
};
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
    // 获取路径参数
    const awardBody = event.pathParameters?.awardBody;
    const movieId = event.pathParameters?.movieId
      ? parseInt(event.pathParameters.movieId)
      : undefined;

    if (!awardBody || !movieId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Missing awardBody or movieId in path parameters" }),
        };
    }


    if (isNaN(movieId)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Invalid movieId" }),
        };
    }

    try {
        const queryCommand = new QueryCommand({
            TableName: process.env.AWARD_TABLE_NAME,
            KeyConditionExpression: "movieId = :movieId AND awardBody = :awardBody",
            ExpressionAttributeValues: {
                ":movieId": parsedMovieId,
                ":awardBody": awardBody,
            },
        });

        const { Items } = await ddbDocClient.send(queryCommand);

        if (Items && Items.length > 0) {
            return {
                statusCode: 200,
                body: JSON.stringify(Items),
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Awards not found for this movieId and awardBody" }),
            };
        }
    } catch (error) {
        console.error("Error fetching awards:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: "Error fetching awards", error: error.message }),
        };
    }
};
