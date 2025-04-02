import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { z } from "zod";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']
type PaymentStatus = Tables['payment_status']['Row']
type PaymentStatusUpdate = Tables['payment_status']['Update']

const schema = z.object({
    status: z.string(),
})


export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    try {
        const { id } = event.pathParameters || {};
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
        const payload: PaymentStatusUpdate = {
            status: data.status,
            updatedAt: new Date(),
        }

        const { data: updatedPayment, error: updateError } = await supabase
            .from("payment_status")
            .update(payload)
            .eq("id", id)
            .select()
            .single() as {
                data: PaymentStatus | null;
                error: any;
            };

        if (updateError) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Error update payment status",
                    error: updateError
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Updated payment status",
                data: updatedPayment
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
