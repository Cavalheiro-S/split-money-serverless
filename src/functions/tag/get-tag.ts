import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.type";

type Tables = Database['public']['Tables']
type Tag = Tables['tags']['Row']

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

        const { data: tags, error } = await supabase
            .from("tags")
            .select("*")
            .eq("user_id", userId) as {
                data: Tag[] | null;
                error: any;
            };

        if (error) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Error fetching tags",
                    error
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Tags fetched successfully",
                data: tags
            }),
        };
    }
    catch (error) {
        console.log({ error });

        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Error fetching tags",
                error
            })
        }
    }
};
