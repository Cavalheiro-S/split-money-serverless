import { GetUserCommand, NotAuthorizedException } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { cognitoClient } from "../../libs/cognito";
import { AuthExceptions } from "../../enums/exceptions/auth";

export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const accessToken = event.headers.authorization?.split(" ")[1];

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

        const command = new GetUserCommand({
            AccessToken: accessToken
        });

        const { Username, UserAttributes } = await cognitoClient.send(command);

        if (!Username || !UserAttributes) {
            throw new Error("Dados do usuário não encontrados");
        }

        // Transforma o array de atributos em um objeto
        const userData = UserAttributes.reduce((acc, attr) => {
            if (attr.Name && attr.Value) {
                acc[attr.Name] = attr.Value;
            }
            return acc;
        }, {} as Record<string, string>);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Dados do usuário obtidos com sucesso",
                data: {
                    id: Username,
                    ...userData
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
                    message: "Erro ao obter dados do usuário",
                    details: error.message
                }
            }),
        };
    }
}; 