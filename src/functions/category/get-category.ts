import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']
type Category = Tables['categories']['Row']

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    try {
        const userId = event.requestContext.authorizer.jwt.claims.sub;
        if (!userId || typeof userId !== 'string' || userId.length === 0) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    message: "Unauthorized",
                }),
            };
        }

        const { data: categories, error } = await supabase
            .from("categories")
            .select("*")
            .eq("user_id", userId) as {
                data: Category[] | null;
                error: any;
            };

        if (error) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Error fetching categories",
                    error
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Categories fetched successfully",
                data: categories
            }),
        };
    }
    catch (error) {
        console.log({ error });

        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Error fetching categories",
                error
            })
        }
    }
};
