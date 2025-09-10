import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.type";

type Tables = Database['public']['Tables']
type Category = Tables['categories']['Row']
type CategoryUpdate = Tables['categories']['Update']

const schema = z.object({
    id: z.string(),
    description: z.string().min(3).max(50),
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

        // Verify the category exists and belongs to the user
        const { data: existingCategory, error: fetchError } = await supabase
            .from("categories")
            .select("*")
            .eq("id", data.id)
            .eq("user_id", userId)
            .single() as {
                data: Category | null;
                error: any;
            };

        if (fetchError || !existingCategory) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: "Category not found or unauthorized",
                    error: fetchError
                }),
            };
        }

        const payload: CategoryUpdate = {
            description: data.description,
            updated_at: new Date(),
        }

        const { data: updatedCategory, error: updateError } = await supabase
            .from("categories")
            .update(payload)
            .eq("id", data.id)
            .eq("user_id", userId)
            .select()
            .single() as {
                data: Category | null;
                error: any;
            };

        if (updateError) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Error updating category",
                    error: updateError
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Category updated successfully",
                data: updatedCategory
            }),
        };
    }
    catch (error) {
        console.log({ error });

        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Error updating category",
                error
            })
        }
    }
};
