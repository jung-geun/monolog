#!/bin/sh
set -e

echo "🚀 Starting Next.js server..."

# Start Next.js standalone server in background
node server.js &
SERVER_PID=$!

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s "http://localhost:3000" > /dev/null 2>&1; then
    echo "✅ Server is ready!"
    break
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "  Attempt $RETRY_COUNT/$MAX_RETRIES..."
  sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "⚠️ Server did not become ready in time, skipping init"
else
  # Initialize ISR cache if NOTION_DATASOURCE_ID is available
  if [ -n "$NOTION_DATASOURCE_ID" ]; then
    echo "🔧 NOTION_DATASOURCE_ID found, initializing ISR cache..."

    INIT_URL="http://localhost:3000/api/init?secret=$TOKEN_FOR_REVALIDATE"

    # Retry init call a few times
    INIT_RETRIES=3
    INIT_COUNT=0

    while [ $INIT_COUNT -lt $INIT_RETRIES ]; do
      INIT_RESPONSE=$(curl -s -w "\n%{http_code}" "$INIT_URL" 2>&1)
      HTTP_CODE=$(echo "$INIT_RESPONSE" | tail -n 1)
      BODY=$(echo "$INIT_RESPONSE" | head -n -1)

      if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ ISR cache initialized successfully"
        echo "$BODY"
        break
      else
        INIT_COUNT=$((INIT_COUNT + 1))
        echo "⚠️ Init attempt $INIT_COUNT failed (HTTP $HTTP_CODE)"
        if [ $INIT_COUNT -lt $INIT_RETRIES ]; then
          sleep 2
        fi
      fi
    done

    if [ $INIT_COUNT -eq $INIT_RETRIES ]; then
      echo "❌ Failed to initialize ISR cache after $INIT_RETRIES attempts"
    fi
  else
    echo "ℹ️ NOTION_DATASOURCE_ID not set, skipping ISR cache initialization"
  fi
fi

echo "🎯 Server is running. Waiting for requests..."

# Wait for the server process
wait $SERVER_PID