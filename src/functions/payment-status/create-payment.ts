import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";
import { v4 as uuidv4 } from "uuid";

const schema = z.object({
    status: z.string(),
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
        const id = uuidv4();
        const payload = {
            id,
            status: data.status,
            createdAt: new Date(),
            updatedAt: new Date()
        }

        const response = await supabase.from("payment_status").insert(payload).select("*")

        if (response.error) {

            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Error creating payment status",
                    error: response.error
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Create new payment status",
                data: response.data
            }),
        };
    }
    catch (error) {
        console.log({ error });

        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Error creating payment status",
                error
            })
        }
    }
};
