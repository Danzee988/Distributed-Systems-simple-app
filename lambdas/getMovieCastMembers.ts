import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", JSON.stringify(event));
    const queryParams = event.queryStringParameters;
    
    if (!queryParams) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Missing query parameters" }),
      };
    }

    if (!queryParams.movieId) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Missing movie Id parameter" }),
      };
    }

    const movieId = parseInt(queryParams.movieId);

    // Query to fetch the cast data
    let commandInput: QueryCommandInput = {
      TableName: process.env.CAST_TABLE_NAME,
      KeyConditionExpression: "movieId = :m",
      ExpressionAttributeValues: { ":m": movieId },
    };

    // Add conditions based on roleName or actorName if present
    if ("roleName" in queryParams) {
      commandInput = {
        ...commandInput,
        IndexName: "roleIx",
        KeyConditionExpression: "movieId = :m and begins_with(roleName, :r)",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":r": queryParams.roleName,
        },
      };
    } else if ("actorName" in queryParams) {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "movieId = :m and begins_with(actorName, :a)",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":a": queryParams.actorName,
        },
      };
    }

    // Fetch the cast information
    const castCommandOutput = await ddbDocClient.send(new QueryCommand(commandInput));
    const castData = castCommandOutput.Items;

    // Check if 'facts=true' and fetch additional movie details
    interface MovieDetails {
      title?: string;
      genre_ids?: number[];
      overview?: string;
    }
    
    let movieDetails: MovieDetails = {};
    if (queryParams.facts === 'true') {
      const movieCommandOutput = await ddbDocClient.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME, // Table holding movie details
          Key: { id: movieId },
        })
      );
      movieDetails = movieCommandOutput.Item || {};
    }

    const responseData = {
      cast: castData,
      ...(queryParams.facts === 'true' && {
        title: movieDetails.title,
        genre_ids: movieDetails.genre_ids,
        overview: movieDetails.overview,
      }),
    };

    // Return the response
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: responseData }),
    };

  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Function to create the DynamoDB Document Client
function createDocumentClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = { wrapNumbers: false };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
