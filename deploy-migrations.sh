#!/bin/bash

# Load environment variables
source .env.local

# Use pooler connection for better reliability
export PGPASSWORD="kE2RCNmEcwrWgh8R"
PSQL_CONN="psql -h aws-1-us-east-2.pooler.supabase.com -U postgres.nomiiqzxaxyxnxndvkbe -d postgres -p 6543"

# Get all migration files in chronological order (by timestamp in filename)
migrations=($(ls -1 supabase/migrations/*.sql | sort -t'_' -k1))

echo "Found ${#migrations[@]} migration files"
echo "============================================"

# Track already applied migrations
declare -A applied
applied["20251214022657_001_core_schema.sql"]=1

# Apply each migration
for migration in "${migrations[@]}"; do
    filename=$(basename "$migration")
    
    # Skip if already applied
    if [[ ${applied[$filename]} ]]; then
        echo "⊙ Skipped (already applied): $filename"
        continue
    fi
    
    echo ""
    echo "Applying: $filename"
    echo "--------------------------------------------"
    
    $PSQL_CONN -f "$migration" 2>&1
    
    if [ $? -eq 0 ]; then
        echo "✓ Success: $filename"
        applied[$filename]=1
    else
        echo "✗ Failed: $filename"
        echo "Continuing to next migration..."
    fi
done

echo ""
echo "============================================"
echo "Migration deployment completed!"
