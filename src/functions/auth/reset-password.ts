import { ConfirmForgotPasswordCommand, CodeMismatchException, ExpiredCodeException, UserNotFoundException } from "@aws-sdk/client-cognito-identity-provider";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { cognitoClient } from "../../libs/cognito";
import { z } from "zod";
import { AuthExceptions } from "../../enums/exceptions/auth";

const schema = z.object({
    email: z.string().email("Email inválido"),
    code: z.string().min(6, "O código deve ter 6 dígitos").max(6, "O código deve ter 6 dígitos"),
    newPassword: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
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

        const command = new ConfirmForgotPasswordCommand({
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: data.email,
            ConfirmationCode: data.code,
            Password: data.newPassword
        });

        await cognitoClient.send(command);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Senha alterada com sucesso"
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
                        message: "Código de recuperação inválido",
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
                        message: "Código de recuperação expirado",
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
                    message: "Erro ao resetar senha",
                    details: error.message
                }
            }),
        };
    }
}; 