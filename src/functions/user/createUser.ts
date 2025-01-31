import { SignUpCommand } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { cognitoClient } from "../../libs/cognito";

export const handler = async (event: APIGatewayProxyEventV2) => {

  try {

    const body = JSON.parse(event.body || "{}");

    console.log({body});
    

    const command = new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: body.email,
      Password: body.password,
      UserAttributes: [
        {
          Name: "email",
          Value: body.email
        },
        {
          Name: "name",
          Value: body.name
        }
      ]
    })

    const { UserSub } = await cognitoClient.send(command);


    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Created new User",
        userId: UserSub
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error creating user",
        error
      }),
    };
  }
};
