import { ConfirmSignUpCommand, CodeMismatchException, ExpiredCodeException, UserNotFoundException } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { cognitoClient } from "../../libs/cognito";
import { z } from "zod";
import { AuthExceptions } from "../../enums/exceptions/auth";

const schema = z.object({
    email: z.string().email("Email inválido"),
    code: z.string().min(6, "O código deve ter 6 dígitos").max(6, "O código deve ter 6 dígitos"),
})

export const handler = async (event: APIGatewayProxyEventV2) => {
    try {
        const { data, success, error } = schema.safeParse(JSON.parse(event.body || "{}"));

        if (!success) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: {
                        code: AuthExceptions.InvalidInput,
                        message: "Dados inválidos",
                        details: error
                    }
                }),
            };
        }

        const command = new ConfirmSignUpCommand({
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: data.email,
            ConfirmationCode: data.code
        });

        await cognitoClient.send(command);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Email confirmado com sucesso"
            })
        };
    } catch (error: any) {
        console.log({ error });

        if (error instanceof CodeMismatchException) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: {
                        code: AuthExceptions.InvalidConfirmationCode,
                        message: "Código de confirmação inválido",
                        details: error.message
                    }
                }),
            };
        }

        if (error instanceof ExpiredCodeException) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: {
                        code: AuthExceptions.ExpiredConfirmationCode,
                        message: "Código de confirmação expirado",
                        details: error.message
                    }
                }),
            };
        }

        if (error instanceof UserNotFoundException) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: {
                        code: AuthExceptions.UserNotFound,
                        message: "Usuário não encontrado",
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
                    message: "Erro ao confirmar email",
                    details: error.message
                }
            }),
        };
    }
}; 