import { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
import { supabase } from "../../libs/supabase";
import { Database } from "../../types/database/database.types";

type Tables = Database['public']['Tables']
type PaymentStatus = Tables['payment_status']['Row']

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer) => {
    try {
        const { data, error } = await supabase
            .from("payment_status")
            .select("*") as {
                data: PaymentStatus[] | null;
                error: any;
            };

        if (error) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Error fetching payment status",
                    error: error.message,
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Get payment status",
                data,
            }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Unexpected error",
                error: error instanceof Error ? error.message : "Unknown error",
            }),
        };
    }
};
