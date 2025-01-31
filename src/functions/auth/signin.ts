import { InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { cognitoClient } from "../../libs/cognito";

export const handler = async (event: APIGatewayProxyEventV2) => {

    try {

        const body = JSON.parse(event.body || "{}");

        const command = new InitiateAuthCommand({
            ClientId: process.env.COGNITO_CLIENT_ID,
            AuthFlow: "USER_PASSWORD_AUTH",
            AuthParameters: {
                USERNAME: body.email,
                PASSWORD: body.password
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
                message: "User logged in",
                token: AuthenticationResult.AccessToken,
                refreshToken: AuthenticationResult.RefreshToken,
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Error login",
                error
            }),
        };
    }
};
