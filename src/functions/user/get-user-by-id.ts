import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    try {
        const { id } = event.pathParameters || {};

        if (!id) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: {
                        code: "INVALID_INPUT",
                        message: "ID não fornecido",
                        details: "O ID do usuário é obrigatório"
                    }
                }),
            };
        }

        const { data, error } = await supabase
            .from("users")
            .select(`
                id,
                email,
                name,
                loginMethod,
                balance,
                createdAt,
                updatedAt
            `)
            .eq("id", id)
            .single();

        if (error) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: {
                        code: "USER_NOT_FOUND",
                        message: "Usuário não encontrado",
                        details: error.message
                    }
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Dados do usuário obtidos com sucesso",
                data
            })
        };
    } catch (error: any) {
        console.log({ error });

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Erro ao obter dados do usuário",
                    details: error.message
                }
            }),
        };
    }
}; 