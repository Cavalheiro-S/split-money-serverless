import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']
type Tag = Tables['tags']['Row']
type TagUpdate = Tables['tags']['Update']

const schema = z.object({
    id: z.string(),
    description: z.string(),
})

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    try {
        const body = JSON.parse(event.body || "{}");
        const { success, data, error } = schema.safeParse(body);
        if (error || !success) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Invalid data",
                    error
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

        // Verify the tag exists and belongs to the user
        const { data: existingTag, error: fetchError } = await supabase
            .from("tags")
            .select("*")
            .eq("id", data.id)
            .eq("user_id", userId)
            .single() as {
                data: Tag | null;
                error: any;
            };

        if (fetchError || !existingTag) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: "Tag not found or unauthorized",
                    error: fetchError
                }),
            };
        }

        const payload: TagUpdate = {
            description: data.description,
            updated_at: new Date(),
        }

        const { data: updatedTag, error: updateError } = await supabase
            .from("tags")
            .update(payload)
            .eq("id", data.id)
            .eq("user_id", userId)
            .select()
            .single() as {
                data: Tag | null;
                error: any;
            };

        if (updateError) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Error updating tag",
                    error: updateError
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Tag updated successfully",
                data: updatedTag
            }),
        };
    }
    catch (error) {
        console.log({ error });

        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Error updating tag",
                error
            })
        }
    }
};
