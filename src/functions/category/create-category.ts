import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.type";

type Tables = Database['public']['Tables']
type Category = Tables['categories']['Row']
type CategoryInsert = Tables['categories']['Insert']

const schema = z.object({
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
        
        const id = uuidv4();
        const payload: CategoryInsert = {
            id,
            description: data.description,
            updated_at: new Date(),
            user_id: userId,
        }

        const { data: category, error: createError } = await supabase.from("categories").insert(payload).select().single() as {
            data: Category | null;
            error: any;
        };

        if (createError) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Error creating category",
                    error: createError
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Category created successfully",
                data: category
            }),
        };
    }
    catch (error) {
        console.log({ error });

        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Error creating category",
                error
            })
        }
    }
};
