import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
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

        // First check if the category exists and belongs to the user
        const { data: existingCategory, error: fetchError } = await supabase
            .from("categories")
            .select("*")
            .eq("id", id)
            .eq("user_id", userId)
            .single();

        if (fetchError || !existingCategory) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: "Category not found or unauthorized",
                    error: fetchError
                }),
            };
        }

        // Check if there are any transactions using this category
        const { data: transactionsUsingCategory, error: transactionCheckError } = await supabase
            .from("transactions")
            .select("id")
            .eq("category_id", id)
            .eq("user_id", userId)
            .limit(1);

        if (transactionCheckError) {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    message: "Error checking category dependencies",
                    error: transactionCheckError
                }),
            };
        }

        if (transactionsUsingCategory && transactionsUsingCategory.length > 0) {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    message: "Cannot delete category with dependent transactions",
                    code: "CATEGORY_HAS_DEPENDENT_TRANSACTIONS",
                }),
            };
        }


        const { error: deleteError } = await supabase
            .from("categories")
            .delete()
            .eq("id", id)
            .eq("user_id", userId);

        if (deleteError) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Error deleting category",
                    error: deleteError
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Category deleted successfully",
                id: id
            }),
        };
    }
    catch (error) {
        console.log({ error });

        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Error deleting category",
                error
            })
        }
    }
};
