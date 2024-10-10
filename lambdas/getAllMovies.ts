import { Handler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

// Create the DynamoDB Document Client
const ddbDocClient = createDDbDocClient();

export const handler: Handler = async (event) => {
  try {
    console.log("Event: ", JSON.stringify(event));

    const commandOutput = await ddbDocClient.send(new ScanCommand({
      TableName: process.env.TABLE_NAME, // Use the TABLE_NAME environment variable
    }));

    // Return the scanned items as a response
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ data: commandOutput.Items }), // Return the scanned items
    };
  } catch (error) {
    console.error("Error fetching movies: ", error);
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
    };
  }
};

// Helper function to create the DynamoDB Document Client
function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  return DynamoDBDocumentClient.from(ddbClient);
}
