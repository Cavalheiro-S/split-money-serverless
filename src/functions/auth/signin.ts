import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { cognitoClient } from "../../libs/cognito";
import { z } from "zod";

const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
})

export const handler = async (event: APIGatewayProxyEventV2) => {

    try {

        const { data, success, error } = schema.safeParse(JSON.parse(event.body || "{}"));

        if (!success) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Invalid input",
                    error
                }),
            };
        }

        const command = new InitiateAuthCommand({
            ClientId: process.env.COGNITO_CLIENT_ID,
            AuthFlow: "USER_PASSWORD_AUTH",
            AuthParameters: {
                USERNAME: data.email,
                PASSWORD: data.password
            }
        })

        const { AuthenticationResult } = await cognitoClient.send(command);


        if (!AuthenticationResult) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    message: "Invalid credentials",
                }),
            };
        }
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Success",
                accessToken: AuthenticationResult.AccessToken,
                refreshToken: AuthenticationResult.RefreshToken,
            })
        };
    } catch (error: any) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Error login",
                error: error.message || error,
            }),
        };
    }
};
