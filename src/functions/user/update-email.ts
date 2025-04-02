import { UpdateUserAttributesCommand, NotAuthorizedException } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { cognitoClient } from "../../libs/cognito";
import { AuthExceptions } from "../../enums/exceptions/auth";

export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const accessToken = event.headers.authorization?.split(" ")[1];
        const { email } = JSON.parse(event.body || "{}");

        if (!accessToken) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    error: {
                        code: AuthExceptions.Unauthorized,
                        message: "Token não fornecido",
                        details: "O token de acesso é obrigatório"
                    }
                }),
            };
        }

        if (!email) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: {
                        code: AuthExceptions.BadRequest,
                        message: "E-mail não fornecido",
                        details: "O e-mail é obrigatório"
                    }
                }),
            };
        }

        const command = new UpdateUserAttributesCommand({
            AccessToken: accessToken,
            UserAttributes: [
                {
                    Name: "email",
                    Value: email
                }
            ]
        });

        await cognitoClient.send(command);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "E-mail atualizado com sucesso",
                data: {
                    email
                }
            })
        };
    } catch (error: any) {
        console.log({ error });

        if (error instanceof NotAuthorizedException) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    error: {
                        code: AuthExceptions.Unauthorized,
                        message: "Token inválido ou expirado",
                        details: error.message
                    }
                }),
            };
        }

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: {
                    code: AuthExceptions.Default,
                    message: "Erro ao atualizar e-mail do usuário",
                    details: error.message
                }
            }),
        };
    }
}; 