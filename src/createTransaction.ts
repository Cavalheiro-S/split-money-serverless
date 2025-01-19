import type { APIGatewayProxyEventV2 } from "aws-lambda";

export const createTransaction = async (event: APIGatewayProxyEventV2) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Create new Transaction",
      event: event
    }),
  };
};
