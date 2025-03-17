import { supabase } from "../../libs/supabase";

export const handler = async () => {
    try {

        const { data, error } = await supabase
            .from("payment_status")
            .select("*", { count: "exact" });

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
