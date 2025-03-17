import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";

const schema = z.object({
    status: z.string(),
})


export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    try {

        const body = JSON.parse(event.body || "{}");
        const { id } = event.pathParameters || {};
        if (!id) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Invalid id",
                }),
            };
        }
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
        const payload = {
            status: data.status,
            createdAt: new Date(),
            updatedAt: new Date()
        }

        const response = await supabase.from("payment_status").update(payload).eq("id", id)

        if (response.error) {

            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Error update payment status",
                    error: response.error
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Updated payment status",
                data: response.data
            }),
        };
    }
    catch (error) {
        console.log({ error });

        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Error update payment status",
                error
            })
        }
    }
};
