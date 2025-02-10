import { CodeDeliveryFailureException, InvalidPasswordException, SignUpCommand, AdminDeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { cognitoClient } from "../../libs/cognito";
import { z } from "zod";
import { supabase } from "../../libs/supabase";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2)
})

export const handler = async (event: APIGatewayProxyEventV2) => {

  try {
    const { success, data, error } = schema.safeParse(JSON.parse(event.body || "{}"));
    if (!success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid request body",
          error: error.issues
        }),
      };
    }

    const command = new SignUpCommand({
      ClientId: process.env.COGNITO_CLIENT_ID,
      Username: data.email,
      Password: data.password,
      UserAttributes: [
        {
          Name: "email",
          Value: data.email
        },
        {
          Name: "name",
          Value: data.name
        }
      ]
    })

    const { UserSub } = await cognitoClient.send(command);

    const response = await supabase
      .from("users")
      .insert({
        id: UserSub,
        email: data.email,
        name: data.name,
        password: data.password,
        loginMethod: "cognito",
        balance: 0,
        updatedAt: new Date(),
      })

    console.log(response);
    
    if (response.error) {
      // Delete the user from Cognito if Supabase insertion fails
      await cognitoClient.send(new AdminDeleteUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: data.email
      }));

      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Error creating user",
          error: response.error
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Created new User",
        userId: UserSub
      }),
    };
  } catch (error) {
    if (error instanceof InvalidPasswordException) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid Password",
          error
        }),
      };
    }

    if (error instanceof CodeDeliveryFailureException) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Code Delivery Failure",
          error
        }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error creating user",
        error
      }),
    };
  }
};
