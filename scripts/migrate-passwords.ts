import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
);

async function migratePasswords() {
    try {
        // Fetch all users that have a plain text password
        const { data: users, error } = await supabase
            .from('users')
            .select('*')

        if (error) {
            throw error;
        }

        console.log(`Found ${users.length} users to migrate`);

        // Update each user's password
        for (const user of users) {
            if (!user.password) {
                console.log(`Skipping user ${user.email} - no password found`);
                continue;
            }

            const hashedPassword = await bcrypt.hash(user.password, 10);

            const { error: updateError } = await supabase
                .from('users')
                .update({
                    password: hashedPassword // Remove the plain text password
                })
                .eq('id', user.id);

            if (updateError) {
                console.error(`Failed to update user ${user.email}:`, updateError);
                continue;
            }

            console.log(`Successfully migrated password for user ${user.email}`);
        }

        console.log('Password migration completed');

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migratePasswords();
