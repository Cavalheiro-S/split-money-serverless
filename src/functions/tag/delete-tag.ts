import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    try {
        const { id } = event.pathParameters || {};
        if (!id) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Invalid id",
                }),
            };
        }

        const userId = event.requestContext.authorizer.jwt.claims.sub;
        if (!userId || typeof userId !== 'string' || userId.length === 0) {
            return {
                statusCode: 401,
                body: JSON.stringify({
                    message: "Unauthorized",
                }),
            };
        }

        // First check if the tag exists and belongs to the user
        const { data: existingTag, error: fetchError } = await supabase
            .from("tags")
            .select("*")
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (fetchError || !existingTag) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: "Tag not found or unauthorized",
                    error: fetchError
                }),
            };
        }

        const { error: deleteError } = await supabase
            .from("tags")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);

        if (deleteError) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Error deleting tag",
                    error: deleteError
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Tag deleted successfully",
                id: id
            }),
        };
    }
    catch (error) {
        console.log({ error });

        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Error deleting tag",
                error
            })
        }
    }
};
